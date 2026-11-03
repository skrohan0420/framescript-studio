// @vitest-environment node
import { expect, it } from "vitest";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { renderExport } from "../server/export";
import { newProject, type ExportOptions } from "../shared/project";
import type { RenderMetrics } from "../server/export-plan";
import { composeProject } from "../shared/composition";
import { initialWorkflow } from "../shared/workflow";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const options: ExportOptions = {
  format: "mp4",
  width: 160,
  height: 90,
  fps: 10,
  duration: 1,
  speed: 1,
  quality: 20,
  fit: "fit",
  transparent: false,
  time: 0,
  captureMode: "lossless",
};
function fixture() {
  const p = newProject();
  p.settings = { ...p.settings, width: 160, height: 90, fps: 10, duration: 1 };
  p.html = '<canvas width="160" height="90"></canvas>';
  p.css = "canvas{display:block;width:100%;height:100%}";
  p.js =
    "const c=document.querySelector('canvas'),x=c.getContext('2d');window.renderFrame=t=>{x.fillStyle='#143b76';x.fillRect(0,0,160,90);x.fillStyle='#fff';x.fillRect(t*60,20,20,20)}";
  return p;
}
function hash(file: string) {
  const r = spawnSync(
    ffmpeg,
    ["-v", "error", "-i", file, "-f", "framemd5", "-"],
    { encoding: "utf8" },
  );
  expect(r.status).toBe(0);
  return r.stdout
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .join("\n");
}

it("cached scene frames preserve exact encoded output and invalidate only the changed built-in scene", async () => {
  const dir = path.resolve("test-results/export-cache-" + crypto.randomUUID());
  await fs.mkdir(dir, { recursive: true });
  const p = fixture();
  p.settings.duration = 0.5;
  p.workflow = initialWorkflow(p);
  p.workflow.scenes.push({
    ...p.workflow.scenes[0],
    id: "second",
    html: '<div id="box">Second</div>',
    css: "body{background:#143b76;color:white}",
    js: "",
  });
  const metrics: RenderMetrics[] = [];
  try {
    for (const label of ["cold", "warm", "changed"]) {
      if (label === "changed")
        p.workflow.scenes[1].html = '<div id="box">Updated</div>';
      await renderExport(
        composeProject(p),
        options,
        path.join(dir, label + ".mp4"),
        ffmpeg,
        new AbortController().signal,
        () => {},
        undefined,
        {
          cacheFrames: true,
          cacheDirectory: path.join(dir, "cache"),
          rawCanvas: false,
          onMetrics: (m) => metrics.push(m),
        },
      );
    }
    expect(metrics[0].cacheHits).toBe(0);
    expect(metrics[1].cacheHits).toBe(10);
    expect(metrics[2].cacheHits).toBe(5);
    expect(hash(path.join(dir, "warm.mp4"))).toBe(
      hash(path.join(dir, "cold.mp4")),
    );
    expect(hash(path.join(dir, "changed.mp4"))).not.toBe(
      hash(path.join(dir, "warm.mp4")),
    );
    expect(metrics[1].wallMs).toBeGreaterThan(0);
    expect(metrics[1].gpu).toBeTruthy();
    expect(metrics[1].browser).toBeTruthy();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 30_000);

it("direct encoding creates timed video, preserves cancellation and falls back for composited scenes", async () => {
  const dir = path.resolve(
    "test-results/export-webcodecs-" + crypto.randomUUID(),
  );
  await fs.mkdir(dir, { recursive: true });
  const p = fixture();
  try {
    let metrics: RenderMetrics | undefined;
    await renderExport(
      p,
      options,
      path.join(dir, "direct.mp4"),
      ffmpeg,
      new AbortController().signal,
      () => {},
      undefined,
      {
        webCodecs: true,
        onMetrics: (m) => {
          metrics = m;
        },
      },
    );
    expect(metrics!.path).toBe("webcodecs");
    expect(metrics!.encoder).toBe("webcodecs-avc");
    expect(hash(path.join(dir, "direct.mp4")).split("\n")).toHaveLength(10);
    p.html += '<div style="position:absolute;top:0;color:white">Overlay</div>';
    await renderExport(
      p,
      options,
      path.join(dir, "overlay.mp4"),
      ffmpeg,
      new AbortController().signal,
      () => {},
      undefined,
      {
        webCodecs: true,
        rawCanvas: false,
        onMetrics: (m) => {
          metrics = m;
        },
      },
    );
    expect(metrics!.path).toBe("browser");
    expect(metrics!.webCodecsFallback).toContain("compositing");
    const stop = new AbortController();
    stop.abort();
    await expect(
      renderExport(
        fixture(),
        options,
        path.join(dir, "cancel.mp4"),
        ffmpeg,
        stop.signal,
        () => {},
        undefined,
        { webCodecs: true },
      ),
    ).rejects.toThrow(/cancel/i);
    expect((await fs.readdir(dir)).some((n) => n.includes("partial"))).toBe(
      false,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 30_000);

it("reuses completed video byte-for-byte and invalidates it when visual settings change", async () => {
  const dir = path.resolve(
    "test-results/export-complete-cache-" + crypto.randomUUID(),
  );
  await fs.mkdir(dir, { recursive: true });
  const p = fixture();
  const metrics: RenderMetrics[] = [];
  try {
    for (const name of ["cold", "warm", "changed"]) {
      if (name === "changed") p.settings.background = "#ffffff";
      await renderExport(
        p,
        options,
        path.join(dir, name + ".mp4"),
        ffmpeg,
        new AbortController().signal,
        () => {},
        undefined,
        {
          cacheWholeExport: true,
          cacheFrames: false,
          cacheDirectory: path.join(dir, "cache"),
          onMetrics: (m) => metrics.push(m),
        },
      );
    }
    expect(metrics[0].path).not.toBe("cached-video");
    expect(metrics[1].path).toBe("cached-video");
    expect(metrics[2].path).not.toBe("cached-video");
    expect(await fs.readFile(path.join(dir, "warm.mp4"))).toEqual(
      await fs.readFile(path.join(dir, "cold.mp4")),
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 30_000);
