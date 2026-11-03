import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { renderExport } from "../server/export";
import { exportFixture } from "./export-fixtures";
import type { ExportOptions } from "../shared/project";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const duration = Number(process.env.BENCHMARK_DURATION ?? 2);
if (!Number.isFinite(duration) || duration < 1 || duration > 10)
  throw Error("Benchmark duration must be 1–10 seconds");
const folder = path.resolve(
  "test-results/export-benchmark/matrix-" + Date.now(),
);
await fs.mkdir(folder, { recursive: true });
const results: any[] = [];
const base: ExportOptions = {
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
console.log("Benchmark output: " + folder);
for (const kind of ["canvas", "three", "mixed"]) {
  const cacheDirectory = path.join(folder, "cache-" + kind);
  const cases = [
    ["png-1", { rawCanvas: false }],
    ...(kind !== "mixed"
      ? [
          ["direct-1", { rawCanvas: true }],
          ["webcodecs-1", { webCodecs: true, rawCanvas: false }],
        ]
      : [["worker-1", { rawCanvas: false, workers: 1 }]]),
    ["png-2", { rawCanvas: false }],
    ...(kind !== "mixed"
      ? [
          ["direct-2", { rawCanvas: true }],
          ["webcodecs-2", { webCodecs: true, rawCanvas: false }],
        ]
      : [["worker-3", { rawCanvas: false, workers: 3 }]]),
    [
      "cache-cold",
      { rawCanvas: kind !== "mixed", cacheFrames: true, cacheDirectory },
    ],
    [
      "cache-warm-1",
      { rawCanvas: kind !== "mixed", cacheFrames: true, cacheDirectory },
    ],
    [
      "cache-warm-2",
      { rawCanvas: kind !== "mixed", cacheFrames: true, cacheDirectory },
    ],
    ...(kind === "three"
      ? [
          ["angle-direct", { rawCanvas: true, gpu: "angle", workers: 1 }],
          ["single-direct", { rawCanvas: true, workers: 1 }],
        ]
      : []),
  ] as [string, Record<string, unknown>][];
  for (const [label, tuning] of cases) {
    const id = kind + "-" + label;
    const trial = spawnSync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/profile-export.ts", id],
      {
        env: {
          ...process.env,
          BENCHMARK_DIR: folder,
          BENCHMARK_DURATION: String(duration),
          BENCHMARK_SCENE: kind,
          RENDER_TUNING: JSON.stringify(tuning),
        },
        encoding: "utf8",
        maxBuffer: 4 * 1024 ** 2,
      },
    );
    if (trial.status !== 0)
      throw Error(id + ": " + trial.stderr + trial.stdout);
    const result = JSON.parse(
      await fs.readFile(path.join(folder, id + ".json"), "utf8"),
    );
    results.push(result);
    console.log(
      JSON.stringify({
        case: id,
        seconds: result.seconds,
        path: result.metrics.path,
        workers: result.metrics.workers,
        encoder: result.metrics.encoder,
        cacheHits: result.metrics.cacheHits,
        gpu: result.metrics.gpu,
        fallback: result.metrics.webCodecsFallback,
      }),
    );
    await fs.writeFile(
      path.join(folder, "results.json"),
      JSON.stringify(
        { width: 3840, height: 2160, fps: 60, duration, results },
        null,
        2,
      ),
    );
  }
  // Source frames for compression-quality measurements. These are not a timed
  // alternative encoder: they are a full-resolution, lossless reference.
  const source = path.join(folder, kind + "-reference");
  await renderExport(
    exportFixture(kind, duration),
    { ...base, format: "sequence" },
    source,
    ffmpeg,
    new AbortController().signal,
    () => {},
    undefined,
    { rawCanvas: false },
  );
  for (const result of results.filter(
    (r) =>
      r.label.startsWith(kind + "-") && /png-1$|webcodecs-1$/.test(r.label),
  )) {
    const compare = spawnSync(
      ffmpeg,
      [
        "-hide_banner",
        "-i",
        path.join(folder, result.label + ".mp4"),
        "-framerate",
        "60",
        "-i",
        path.join(source, "frame-%06d.png"),
        "-filter_complex",
        "[0:v]setpts=PTS-STARTPTS,format=yuv420p,split[a][c];[1:v]setpts=PTS-STARTPTS,format=yuv420p,split[b][d];[a][b]ssim[ss];[c][d]psnr[ps]",
        "-map",
        "[ss]",
        "-map",
        "[ps]",
        "-an",
        "-f",
        "null",
        "-",
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 ** 2 },
    );
    if (compare.status !== 0)
      throw Error("Quality comparison failed: " + compare.stderr);
    result.quality = {
      ssim: Number(compare.stderr.match(/All:([\d.]+)/)?.[1]),
      psnr: Number(compare.stderr.match(/average:([\d.]+)/)?.[1]),
    };
    await fs.writeFile(
      path.join(folder, result.label + "-quality.txt"),
      compare.stderr,
    );
    console.log(
      JSON.stringify({ case: result.label, quality: result.quality }),
    );
  }
  const reference = results.find((r) => r.label === kind + "-png-1");
  for (const result of results.filter(
    (r) => r.label.startsWith(kind + "-") && r.metrics.path !== "webcodecs",
  ))
    result.matchesBaselinePixels =
      result.decodedPixelHash === reference.decodedPixelHash;
  await fs.writeFile(
    path.join(folder, "results.json"),
    JSON.stringify(
      { width: 3840, height: 2160, fps: 60, duration, results },
      null,
      2,
    ),
  );
}
console.log("Completed: " + path.join(folder, "results.json"));
