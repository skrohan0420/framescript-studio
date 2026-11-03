import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { exportFixture } from "./export-fixtures";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const destination = path.resolve("test-results/compiled-worker-4k60.mp4");
await fs.mkdir(path.dirname(destination), { recursive: true });
const worker = new Worker(path.resolve("dist-server/export-worker.cjs"), {
  workerData: {
    project: exportFixture("canvas", 4),
    options: {
      format: "mp4",
      width: 3840,
      height: 2160,
      fps: 60,
      duration: 4,
      speed: 1,
      quality: 20,
      fit: "fit",
      transparent: false,
      time: 0,
      captureMode: "lossless",
    },
    destination,
    ffmpeg,
  },
});
let diagnostics: any;
let previous = "";
await new Promise<void>((resolve, reject) => {
  worker.on("error", reject);
  worker.on("message", (message) => {
    if (message.type === "progress") {
      const p = message.progress;
      if (p.stage !== previous) {
        previous = p.stage;
        console.log(p.stage);
      }
      if (p.diagnostics) diagnostics = p.diagnostics;
    }
    if (message.type === "error") reject(Error(message.error));
  });
  worker.on("exit", (code) =>
    code === 0 ? resolve() : reject(Error("Worker exited " + code)),
  );
});
assert.equal(diagnostics?.transport, "http2-stream");
assert.equal(diagnostics.frames, 240);
const decoded = spawnSync(
  ffmpeg,
  ["-v", "error", "-i", destination, "-f", "framemd5", "-"],
  { encoding: "utf8", maxBuffer: 4 * 1024 ** 2 },
);
assert.equal(decoded.status, 0);
assert(decoded.stdout.includes("#dimensions 0: 3840x2160"));
assert(decoded.stdout.includes("#tb 0: 1/60"));
assert.equal(
  decoded.stdout.split(/\r?\n/).filter((line) => line && !line.startsWith("#"))
    .length,
  240,
);
await fs.writeFile(destination + ".json", JSON.stringify(diagnostics, null, 2));
console.log(
  "PASS compiled worker: 240 complete 4K/60 frames through HTTP/2 streaming",
);
