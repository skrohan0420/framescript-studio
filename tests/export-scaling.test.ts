// @vitest-environment node
import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { renderExport } from "../server/export";
import { newProject } from "../shared/project";

const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;

it.each([
  [160, 90, "fit", false],
  [640, 360, "fit", false],
  [160, 90, "fit", true],
  [640, 360, "fit", true],
  [160, 160, "fit", false],
  [160, 160, "fill", false],
  [160, 160, "stretch", false],
] as const)("scales a viewport-fitted scene to %sx%s with %s (standard: %s)", async (width, height, fit, standard) => {
  const dir = path.resolve("test-results", "export-scaling-" + crypto.randomUUID());
  await fs.mkdir(dir, { recursive: true });
  try {
    const project = newProject();
    project.settings = { ...project.settings, width: 320, height: 180, duration: 0.1 };
    project.html = '<div id="frame"><div id="center"></div></div>';
    project.css = `html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}
      #frame{position:fixed;left:0;top:0;width:320px;height:180px;background:#00ff00;transform-origin:0 0}
      #center{position:absolute;left:140px;top:70px;width:40px;height:40px;background:#ff0000}`;
    project.js = `function fit(){document.querySelector('#frame').style.transform='scale('+Math.min(innerWidth/320,innerHeight/180)+')'}
      fit();addEventListener('resize',fit);window.renderFrame=()=>{};`;
    const file = path.join(dir, "frame.png");
    await renderExport(project, {
      format: "png", width, height, fps: 60, duration: 0.1, speed: 1,
      quality: 20, fit, transparent: false, time: 0,
    }, file, ffmpeg, new AbortController().signal, () => {}, undefined,
    { capture: standard ? "standard" : "fast", failOnFallback: true });
    const png = await fs.readFile(file);
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([width, height]);
    const decoded = spawnSync(ffmpeg, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 2_000_000 });
    expect(decoded.status, decoded.stderr.toString()).toBe(0);
    const pixel = (x: number, y: number) => [...decoded.stdout.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)];
    expect(pixel(width / 2, height / 2)).toEqual([255, 0, 0]);
    expect(pixel(width - 2, Math.floor(height / 2))).toEqual([0, 255, 0]);
    expect(pixel(2, 2)).toEqual(fit === "fit" && width === height ? [0, 0, 0] : [0, 255, 0]);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}, 30000);
