// @vitest-environment node
import { expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { renderExport } from "../server/export";
import * as plan from "../server/export-plan";
import { newProject, type ExportOptions } from "../shared/project";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const options: ExportOptions = {
  format: "sequence",
  width: 160,
  height: 90,
  fps: 12,
  duration: 1,
  speed: 1,
  quality: 20,
  fit: "fit",
  transparent: false,
  time: 0,
};
const root = path.resolve("test-results");
it("uses faster capture only for lossy opaque video and honors lossless selection", () => {
  expect(plan.captureFormat({ ...options, format: "mp4" })).toBe("png");
  expect(
    plan.captureFormat({ ...options, format: "mp4", captureMode: "fast" }),
  ).toBe("jpeg");
  expect(
    plan.captureFormat({ ...options, format: "mp4", captureMode: "lossless" }),
  ).toBe("png");
  expect(
    plan.captureFormat(
      { ...options, format: "mp4", quality: 0 },
      { capture: "jpeg" },
    ),
  ).toBe("png");
  expect(
    plan.captureFormat(
      { ...options, format: "webm", transparent: true },
      { capture: "jpeg" },
    ),
  ).toBe("png");
  for (const format of ["png", "sequence", "gif"] as const)
    expect(
      plan.captureFormat({ ...options, format }, { capture: "jpeg" }),
    ).toBe("png");
});
async function folder() {
  const dir = path.join(root, "export-acceleration-" + crypto.randomUUID());
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
async function cleanup(dir: string) {
  if (!dir.startsWith(root + path.sep)) throw Error("Invalid test folder");
  await fs.rm(dir, { recursive: true, force: true });
}
it("reports browser startup failures with repair instructions and cleans partial output", async () => {
  const dir = await folder();
  const stages: string[] = [];
  try {
    await expect(
      renderExport(
        newProject(),
        { ...options, format: "mp4" },
        path.join(dir, "missing.mp4"),
        ffmpeg,
        new AbortController().signal,
        (p) => stages.push(p.stage),
        path.join(dir, "missing-browser.exe"),
      ),
    ).rejects.toThrow("npx playwright install chromium");
    expect(stages).toContain("Starting render browser");
    expect(await fs.readdir(dir)).toEqual([]);
  } finally {
    await cleanup(dir);
  }
});
function decode(args: string[]) {
  const result = spawnSync(
    ffmpeg,
    ["-v", "error", ...args, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    { maxBuffer: 10_000_000 },
  );
  expect(result.status, result.stderr.toString()).toBe(0);
  return result.stdout;
}
it("caps concurrency and preserves sequential replay, networking and snapshots", () => {
  const project = newProject();
  expect(
    plan.renderWorkerCount(project, { ...options, width: 3840, height: 2160 }),
  ).toBeLessThanOrEqual(2);
  expect(plan.renderWorkerCount(project, options, { workers: 1 })).toBe(1);
  project.settings.timing = "replay";
  expect(plan.renderWorkerCount(project, options, { workers: 3 })).toBe(1);
  project.settings.timing = "seek";
  project.settings.network = true;
  expect(plan.renderWorkerCount(project, options)).toBe(1);
  project.settings.network = false;
  expect(plan.renderWorkerCount(project, { ...options, format: "png" })).toBe(
    1,
  );
});
it("selects direct Three.js capture only with explicit hardware graphics and limits 4K GPU readback contention", () => {
  const project = newProject();
  const video = {
    ...options,
    format: "mp4" as const,
    width: 3840,
    height: 2160,
  };
  project.html = '<div><canvas width="3840" height="2160"></canvas></div>';
  project.js = "FrameScript3D.create({});";
  expect(plan.graphicsBackend(project, video, "win32")).toBe("angle");
  expect(
    plan.graphicsBackend(project, { ...video, graphics: "browser" }, "win32"),
  ).toBe("auto");
  expect(plan.graphicsBackend(project, video, "linux")).toBe("auto");
  expect(plan.preferDirectCanvas(project, video)).toBe(false);
  expect(plan.preferDirectCanvas(project, video, "software")).toBe(false);
  expect(plan.preferDirectCanvas(project, video, "angle")).toBe(true);
  expect(
    plan.renderWorkerCount(project, video, { rawCanvas: true, gpu: "angle" }),
  ).toBe(1);
  project.js = 'document.querySelector("canvas").getContext("2d")';
  expect(plan.graphicsBackend(project, video, "win32")).toBe("auto");
  expect(plan.preferDirectCanvas(project, video)).toBe(true);
  project.html = "<div>HTML scene</div>";
  expect(plan.preferDirectCanvas(project, video, "angle")).toBe(false);
});
it("fast parallel PNG capture matches serial pixels, timing and frame order exactly", async () => {
  const dir = await folder(),
    project = newProject();
  project.settings = {
    ...project.settings,
    width: 160,
    height: 90,
    duration: 1,
    fps: 12,
  };
  project.html = '<div id="moving">Frame</div>';
  project.css =
    "#moving{position:absolute;top:20px;font:18px Arial;color:white}";
  project.js =
    "window.renderFrame=t=>{document.body.style.background='rgb('+Math.round(t*220)+',30,70)';document.querySelector('#moving').style.left=t*100+'px'}";
  try {
    for (const fast of [false, true])
      await renderExport(
        project,
        options,
        path.join(dir, fast ? "fast" : "serial"),
        ffmpeg,
        new AbortController().signal,
        () => {},
        undefined,
        { workers: fast ? 3 : 1, capture: fast ? "fast" : "standard" },
      );
    expect((await fs.readdir(path.join(dir, "fast"))).length).toBe(12);
    const serial = decode([
      "-framerate",
      "12",
      "-i",
      path.join(dir, "serial", "frame-%06d.png"),
    ]);
    const fast = decode([
      "-framerate",
      "12",
      "-i",
      path.join(dir, "fast", "frame-%06d.png"),
    ]);
    expect(fast.equals(serial)).toBe(true);
    expect(fast.length).toBe(160 * 90 * 4 * 12);
  } finally {
    await cleanup(dir);
  }
}, 60000);
it("fast snapshot preserves transparent pixels", async () => {
  const dir = await folder(),
    project = newProject();
  project.settings = {
    ...project.settings,
    width: 160,
    height: 90,
    background: "transparent",
  };
  project.html = '<div style="width:10px;height:10px;background:red"></div>';
  project.css = "";
  project.js = "";
  try {
    await renderExport(
      project,
      { ...options, format: "png", transparent: true },
      path.join(dir, "alpha.png"),
      ffmpeg,
      new AbortController().signal,
      () => {},
      undefined,
      { capture: "jpeg" },
    );
    const pixels = decode(["-i", path.join(dir, "alpha.png")]);
    expect([...pixels.subarray(0, 4)]).toEqual([255, 0, 0, 255]);
    expect(pixels[(89 * 160 + 159) * 4 + 3]).toBe(0);
  } finally {
    await cleanup(dir);
  }
}, 30000);
it("faster video preserves frame order and stays close to lossless reference pixels", async () => {
  const dir = await folder(),
    project = newProject();
  project.settings = {
    ...project.settings,
    width: 160,
    height: 90,
    fps: 12,
    duration: 1,
  };
  project.html = '<div id="moving">Frame</div>';
  project.css =
    "#moving{position:absolute;top:20px;font:18px Arial;color:white}";
  project.js =
    "window.renderFrame=t=>{document.body.style.background='rgb('+Math.round(t*220)+',30,70)';document.querySelector('#moving').style.left=t*100+'px'}";
  try {
    await renderExport(
      project,
      options,
      path.join(dir, "reference"),
      ffmpeg,
      new AbortController().signal,
      () => {},
    );
    await renderExport(
      project,
      { ...options, format: "mp4" },
      path.join(dir, "fast.mp4"),
      ffmpeg,
      new AbortController().signal,
      () => {},
    );
    const reference = decode([
      "-framerate",
      "12",
      "-i",
      path.join(dir, "reference", "frame-%06d.png"),
    ]);
    const actual = decode(["-i", path.join(dir, "fast.mp4")]);
    expect(actual.length).toBe(reference.length);
    const frameBytes = 160 * 90 * 4;
    for (let frame = 0; frame < 12; frame++) {
      let error = 0;
      for (let i = frame * frameBytes; i < (frame + 1) * frameBytes; i++)
        error += Math.abs(reference[i] - actual[i]);
      expect(error / frameBytes).toBeLessThan(4);
    }
    const controller = new AbortController();
    await expect(
      renderExport(
        project,
        { ...options, format: "mp4" },
        path.join(dir, "cancelled.mp4"),
        ffmpeg,
        controller.signal,
        (p) => {
          if (p.stage === "Rendering" && p.done === 2) controller.abort();
        },
      ),
    ).rejects.toThrow("cancelled");
    expect(
      (await fs.readdir(dir)).some(
        (name) => name.includes("partial-") || name === "cancelled.mp4",
      ),
    ).toBe(false);
  } finally {
    await cleanup(dir);
  }
}, 60000);
it("automatically retries software when a hardware encoder fails at startup", async () => {
  const dir = await folder();
  const original = plan.videoEncoderArgs;
  const selected = vi
    .spyOn(plan, "selectVideoEncoder")
    .mockResolvedValue("h264_qsv");
  const args = vi
    .spyOn(plan, "videoEncoderArgs")
    .mockImplementation((encoder, quality, preset) =>
      encoder === "libx264"
        ? original(encoder, quality, preset)
        : ["-c:v", "framescript_missing_test_encoder"],
    );
  const stages: string[] = [];
  try {
    await renderExport(
      newProject(),
      { ...options, format: "mp4", duration: 0.25 },
      path.join(dir, "fallback.mp4"),
      ffmpeg,
      new AbortController().signal,
      (progress) => {
        stages.push(progress.stage);
      },
    );
    expect(stages).toContain("Retrying with software encoding");
    expect(
      (await fs.stat(path.join(dir, "fallback.mp4"))).size,
    ).toBeGreaterThan(32);
    expect(
      (await fs.readdir(dir)).some((name) => name.includes(".partial-")),
    ).toBe(false);
  } finally {
    selected.mockRestore();
    args.mockRestore();
    await cleanup(dir);
  }
}, 60000);
