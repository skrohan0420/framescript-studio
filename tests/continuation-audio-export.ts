import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { projectSchema, type ExportOptions } from "../shared/project";
import { composeProject } from "../shared/composition";
import { renderExport } from "../server/export";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const dir = path.resolve("test-results/continuation-audio");
const saved = projectSchema.parse(JSON.parse(await fs.readFile(path.join(dir, "project.json"), "utf8")));
const options: ExportOptions = { format: "mp4", width: 320, height: 180, fps: 10, duration: 5, speed: 1, quality: 24, fit: "fit", transparent: false, time: 0 };
for (const lane of ["music", "sfx"] as const) {
  const project = projectSchema.parse(composeProject({ ...saved, audio: saved.audio!.filter(clip => clip.lane === lane) }));
  const file = path.join(dir, `${lane}.mp4`);
  await renderExport(project, options, file, ffmpeg, new AbortController().signal, () => {});
  const decoded = spawnSync(ffmpeg, ["-v", "error", "-i", file, "-vn", "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], { maxBuffer: 4000000 });
  assert.equal(decoded.status, 0, decoded.stderr.toString());
  const rms = (start: number, end: number) => {
    let sum = 0, count = 0;
    for (let i = Math.floor(start * 48000); i < Math.floor(end * 48000); i++) {
      const sample = decoded.stdout.readFloatLE(i * 4); sum += sample * sample; count++;
    }
    return Math.sqrt(sum / count);
  };
  if (lane === "music") {
    for (const [start, end] of [[1.7, 1.9], [2.01, 2.2], [4.5, 4.7]]) assert(rms(start, end) > 0.001, `Music silent at ${start}`);
  } else {
    assert(rms(0.5, 1.5) < 0.0001, "Effect played before extension");
    assert(rms(2.51, 2.7) > 0.001, "Extension effect missing");
    assert(rms(3.2, 4.2) < 0.0001, "Effect repeated after its end");
  }
  console.log(`PASS ${lane}: real MP4 audio timing and amplitude`);
}
