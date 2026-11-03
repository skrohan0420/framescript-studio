import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { renderExport } from "../server/export";
import { exportFixture } from "./export-fixtures";
import type { ExportOptions } from "../shared/project";
const folder = path.resolve(
  "test-results/export-benchmark/scene-reuse-" + Date.now(),
);
await fs.mkdir(folder, { recursive: true });
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const options: ExportOptions = {
  format: "mp4",
  width: 3840,
  height: 2160,
  fps: 60,
  duration: 2,
  speed: 1,
  quality: 20,
  fit: "fit",
  transparent: false,
  time: 0,
  captureMode: "lossless",
};
const results: any[] = [];
for (const label of ["cold", "warm", "edited"]) {
  let metrics: any;
  const start = performance.now();
  const output = path.join(folder, label + ".mp4");
  await renderExport(
    exportFixture("mixed", 2, label === "edited"),
    options,
    output,
    ffmpeg,
    new AbortController().signal,
    () => {},
    undefined,
    {
      cacheFrames: true,
      cacheWholeExport: false,
      rawCanvas: false,
      cacheDirectory: path.join(folder, "cache"),
      onMetrics: (m) => {
        metrics = m;
      },
    },
  );
  const seconds = (performance.now() - start) / 1000;
  const hashes = spawnSync(
    ffmpeg,
    ["-v", "error", "-i", output, "-f", "framemd5", "-"],
    { encoding: "utf8", maxBuffer: 1024 ** 2 },
  );
  if (hashes.status !== 0) throw Error(hashes.stderr);
  results.push({ label, seconds, metrics });
  await fs.writeFile(path.join(folder, label + ".framemd5"), hashes.stdout);
  console.log(
    JSON.stringify({
      label,
      seconds,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
    }),
  );
}
await fs.writeFile(
  path.join(folder, "results.json"),
  JSON.stringify(
    { width: 3840, height: 2160, fps: 60, duration: 2, results },
    null,
    2,
  ),
);
console.log(folder);
