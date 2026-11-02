import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { renderExport } from "../server/export";
import { newProject, type ExportOptions } from "../shared/project";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const label = process.argv[2] ?? "baseline";
const folder = path.resolve("test-results/export-benchmark");
await fs.mkdir(folder, { recursive: true });
const project = newProject();
project.settings = {
  ...project.settings,
  width: 3840,
  height: 2160,
  duration: 1,
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
  duration: 1,
  speed: 1,
  quality: 20,
  fit: "fit",
  transparent: false,
  time: 0,
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
  label.includes("jpeg")
    ? { capture: "jpeg", workers: Number(label.match(/workers(\d)/)?.[1] ?? 2) }
    : label.includes("workers")
    ? { workers: Number(label.match(/workers(\d)/)?.[1] ?? 2) }
    : label === "baseline"
    ? { workers: 1, capture: "standard", encoder: "software", softwarePreset: "medium" }
    : label.includes("software")
    ? { encoder: "software" }
    : label.includes("serial")
      ? { workers: 1 }
      : {},
);
const result = {
  label,
  seconds: (performance.now() - start) / 1000,
  width: 3840,
  height: 2160,
  fps: 60,
  frames: 60,
  stages,
};
await fs.writeFile(
  path.join(folder, label + ".json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
