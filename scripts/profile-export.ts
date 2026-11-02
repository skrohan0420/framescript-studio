import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cpus, totalmem, freemem, availableParallelism } from "node:os";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { RenderMetrics, RenderTuning } from "../server/export-plan";
import { renderExport } from "../server/export";
import { newProject, type ExportOptions } from "../shared/project";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const label = process.argv[2] ?? "profile";
if (!/^[a-zA-Z0-9_-]+$/.test(label))
  throw Error("Use a filename-safe benchmark label");
const tuning: RenderTuning = JSON.parse(process.env.RENDER_TUNING ?? "{}");
let metrics: RenderMetrics | undefined;
const folder = path.resolve("test-results/export-benchmark");
await fs.mkdir(folder, { recursive: true });
const duration = Number(process.env.BENCHMARK_DURATION ?? 1);
const hardware = {
  cpu: cpus()[0]?.model,
  logicalCpus: availableParallelism(),
  totalMemory: totalmem(),
  freeMemoryBefore: freemem(),
  node: process.version,
};
const project = newProject();
project.settings = {
  ...project.settings,
  width: 3840,
  height: 2160,
  duration,
  fps: 60,
};
project.html = '<canvas id="scene" width="3840" height="2160"></canvas>';
project.css =
  "body{background:#101321}canvas{display:block;width:100%;height:100%}";
project.js = `const c=document.querySelector('canvas'),ctx=c.getContext('2d');window.renderFrame=t=>{ctx.fillStyle='#101321';ctx.fillRect(0,0,3840,2160);const g=ctx.createRadialGradient(1920,1080,0,1920,1080,1800);g.addColorStop(0,'#24457a');g.addColorStop(1,'#101321');ctx.fillStyle=g;ctx.fillRect(0,0,3840,2160);for(let i=0;i<300;i++){const a=i*2.39996+t*.5,r=40+Math.sqrt(i)*95;ctx.fillStyle=i%3?'#84caff':'#ffcd84';ctx.beginPath();ctx.arc(1920+Math.cos(a)*r,1080+Math.sin(a)*r*.55,3+i%7,0,Math.PI*2);ctx.fill()}ctx.fillStyle='white';ctx.font='bold 140px Arial';ctx.fillText('4K · 60 fps',120+Math.sin(t)*100,300)};`;
const options: ExportOptions = {
  format: "mp4",
  width: 3840,
  height: 2160,
  fps: 60,
  duration,
  speed: 1,
  quality: 20,
  fit: "fit",
  transparent: false,
  time: 0,
  captureMode: "lossless",
};
const start = performance.now(),
  stages: { stage: string; atSeconds: number; done: number }[] = [];
await renderExport(
  project,
  options,
  path.join(folder, label + ".mp4"),
  ffmpeg,
  new AbortController().signal,
  (progress) => {
    if (stages.at(-1)?.stage !== progress.stage) {
      const item = {
        stage: progress.stage,
        atSeconds: (performance.now() - start) / 1000,
        done: progress.done,
      };
      stages.push(item);
      console.log(JSON.stringify(item));
    }
  },
  undefined,
  {
    ...tuning,
    onMetrics: (value) => {
      metrics = value;
    },
  },
);
const seconds = (performance.now() - start) / 1000;
const verification = spawnSync(
  ffmpeg,
  [
    "-v",
    "error",
    "-i",
    path.join(folder, label + ".mp4"),
    "-map",
    "0:v:0",
    "-f",
    "framemd5",
    "-",
  ],
  { encoding: "utf8", maxBuffer: 10_000_000 },
);
if (verification.status !== 0)
  throw Error("Frame verification failed: " + verification.stderr);
const hashes = verification.stdout
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"));
if (hashes.length !== Math.ceil(duration * 60))
  throw Error("Incorrect decoded frame count");
if (
  !verification.stdout.includes("#dimensions 0: 3840x2160") ||
  !verification.stdout.includes("#tb 0: 1/60")
)
  throw Error("Incorrect video dimensions or frame rate");
await fs.writeFile(path.join(folder, label + ".framemd5"), verification.stdout);
const result = {
  label,
  tuning,
  metrics,
  hardware,
  options,
  seconds,
  renderFps: hashes.length / seconds,
  decodedFrames: hashes.length,
  decodedPixelHash: createHash("sha256")
    .update(hashes.join("\n"))
    .digest("hex"),
  metricNote:
    "seek/capture/decode sums overlap across workers; pipelineMs is wall time. backpressure overlaps capture. seconds includes startup, verification and cleanup, excludes extra framemd5 validation.",
  width: 3840,
  height: 2160,
  fps: 60,
  frames: Math.ceil(duration * 60),
  stages,
};
await fs.writeFile(
  path.join(folder, label + ".json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
