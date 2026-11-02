// @vitest-environment node
import { expect, it } from "vitest";
import { chromium } from "playwright";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  rawCanvasTransport,
  RawCanvasUnsupported,
  isolateRawCanvas,
} from "../server/raw-canvas";
import { renderExport } from "../server/export";
import { documentFor } from "../shared/runtime";
import { newProject, type ExportOptions } from "../shared/project";
import type { RenderMetrics } from "../server/export-plan";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;

function fixture(width = 160, height = 90) {
  const project = newProject();
  project.settings = {
    ...project.settings,
    width,
    height,
    fps: 12,
    duration: 1,
  };
  project.html = `<canvas width="${width}" height="${height}"></canvas>`;
  project.css = "canvas{display:block;width:100%;height:100%}";
  project.js = `const c=document.querySelector('canvas'),ctx=c.getContext('2d');window.renderFrame=t=>{
    const g=ctx.createLinearGradient(0,0,c.width,c.height);g.addColorStop(0,'#173c79');g.addColorStop(1,'#d39841');
    ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='white';ctx.font='24px Arial';ctx.fillText('Frame '+t.toFixed(2),5,30);
    ctx.fillStyle='#ff451b';ctx.fillRect(Math.round(t*50),40,24,24);
  };`;
  return project;
}
function decode(args: string[], input?: Buffer) {
  const result = spawnSync(
    ffmpeg,
    ["-v", "error", ...args, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    { input, maxBuffer: 64 * 1024 * 1024 },
  );
  expect(result.status, result.stderr?.toString()).toBe(0);
  return result.stdout;
}

it("direct 4K pixels equal browser PNG pixels at multiple timestamps; network stays blocked", async () => {
  const width = 3840,
    height = 2160;
  const raw = await rawCanvasTransport(width, height);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    const session = await page.context().newCDPSession(page);
    await isolateRawCanvas(session, raw.urlPrefix);
    await page.setContent(
      documentFor(fixture(width, height), {
        export: true,
        exportTransportOrigin: raw.origin,
      }),
    );
    await page.evaluate(() => document.fonts.ready);
    for (const t of [0, 1 / 60, 59 / 60]) {
      await page.evaluate((t) => (window as any).__fsSeek(t), t);
      const actual = await raw.capture(page);
      const png = await session.send("Page.captureScreenshot", {
        format: "png",
        optimizeForSpeed: true,
      });
      const expected = decode(
        ["-f", "image2pipe", "-vcodec", "png", "-i", "pipe:0"],
        Buffer.from(png.data, "base64"),
      );
      expect(actual.length).toBe(width * height * 4);
      expect(actual.equals(expected)).toBe(true);
    }
    // Same origin is permitted by CSP, but native filtering must block paths outside the capability.
    expect(
      await page.evaluate(async (origin) => {
        try {
          await fetch(origin + "/forbidden", { mode: "no-cors" });
          return "allowed";
        } catch {
          return "blocked";
        }
      }, raw.origin),
    ).toBe("blocked");
  } finally {
    await browser.close();
    await raw.close();
  }
}, 60000);

it("rejects overlays, CSS effects, translucent pixels, scaling and extra canvases", async () => {
  const raw = await rawCanvasTransport(160, 90),
    browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 160, height: 90 },
    });
    for (const change of [
      "document.body.insertAdjacentHTML('beforeend','<div>Overlay</div>')",
      "document.querySelector('canvas').style.filter='blur(1px)'",
      "document.querySelector('canvas').style.borderRadius='10px'",
      "document.querySelector('canvas').style.offsetPath='path(\"M 0 0 L 100 100\")'",
      "document.querySelector('canvas').style.transform='scale(.5)'",
      "document.querySelector('canvas').getContext('2d').clearRect(0,0,1,1)",
      "document.body.appendChild(document.createElement('canvas'))",
      "document.head.insertAdjacentHTML('beforeend','<style>body::after{content:\"overlay\"}</style>')",
      "document.documentElement.style.width='80px'",
    ]) {
      await page.setContent(
        documentFor(fixture(), {
          export: true,
          exportTransportOrigin: raw.origin,
        }),
      );
      await page.evaluate((change) => {
        (0, eval)(change);
      }, change);
      await expect(raw.capture(page), change).rejects.toBeInstanceOf(
        RawCanvasUnsupported,
      );
    }
  } finally {
    await browser.close();
    await raw.close();
  }
}, 30000);

const options: ExportOptions = {
  format: "mp4",
  width: 160,
  height: 90,
  fps: 12,
  duration: 1,
  speed: 1,
  quality: 0,
  fit: "fit",
  transparent: false,
  time: 0,
  captureMode: "lossless",
};
it("preserves encoded frame order, restarts for a late overlay, and cleans cancellation", async () => {
  const root = path.resolve("test-results"),
    dir = await fs.mkdtemp(path.join(root, "direct-canvas-"));
  const project = fixture();
  const output = (name: string) => path.join(dir, name + ".mp4");
  const metrics: RenderMetrics[] = [];
  const render = (name: string, rawCanvas: boolean) =>
    renderExport(
      project,
      options,
      output(name),
      ffmpeg,
      new AbortController().signal,
      () => {},
      undefined,
      { rawCanvas, onMetrics: (value) => metrics.push(value) },
    );
  try {
    await render("png", false);
    await render("direct", true);
    expect(metrics.at(-1)?.capture).toBe("rgba");
    expect(
      decode(["-i", output("direct")]).equals(decode(["-i", output("png")])),
    ).toBe(true);
    project.js += `const original=window.renderFrame;window.renderFrame=t=>{original(t);if(t>=.5&&!document.querySelector('#overlay'))document.body.insertAdjacentHTML('beforeend','<div id="overlay" style="position:absolute;top:0;color:red">Overlay</div>')};`;
    const stages: string[] = [];
    await renderExport(
      project,
      options,
      output("fallback"),
      ffmpeg,
      new AbortController().signal,
      (p) => stages.push(p.stage),
      undefined,
      { rawCanvas: true },
    );
    expect(stages).toContain("Using browser compositing");
    await render("overlay-reference", false);
    expect(
      decode(["-i", output("fallback")]).equals(
        decode(["-i", output("overlay-reference")]),
      ),
    ).toBe(true);
    const controller = new AbortController();
    await expect(
      renderExport(
        fixture(),
        options,
        output("cancelled"),
        ffmpeg,
        controller.signal,
        (p) => {
          if (p.stage === "Rendering" && p.done === 2) controller.abort();
        },
        undefined,
        { rawCanvas: true },
      ),
    ).rejects.toThrow("cancelled");
    expect(
      (await fs.readdir(dir)).some(
        (name) => name.includes("partial-") || name === "cancelled.mp4",
      ),
    ).toBe(false);
  } finally {
    if (!dir.startsWith(root + path.sep)) throw Error("Invalid test directory");
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 60000);
