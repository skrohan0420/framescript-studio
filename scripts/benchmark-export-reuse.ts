import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
const folder = path.resolve(
  "test-results/export-benchmark/reuse-" + Date.now(),
);
await fs.mkdir(folder, { recursive: true });
const results: any[] = [];
async function trial(
  kind: string,
  label: string,
  tuning: Record<string, unknown>,
  duration = 2,
) {
  const id = kind + "-" + label;
  const child = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/profile-export.ts", id],
    {
      env: {
        ...process.env,
        BENCHMARK_SCENE: kind,
        BENCHMARK_DURATION: String(duration),
        BENCHMARK_DIR: folder,
        RENDER_TUNING: JSON.stringify(tuning),
      },
      encoding: "utf8",
      maxBuffer: 4 * 1024 ** 2,
    },
  );
  if (child.status !== 0) throw Error(child.stderr + child.stdout);
  const result = JSON.parse(
    await fs.readFile(path.join(folder, id + ".json"), "utf8"),
  );
  results.push(result);
  console.log(
    JSON.stringify({
      case: id,
      seconds: result.seconds,
      path: result.metrics.path,
      cacheHits: result.metrics.cacheHits,
      tuningMs: result.metrics.tuningMs,
      workers: result.metrics.workers,
    }),
  );
  await fs.writeFile(
    path.join(folder, "results.json"),
    JSON.stringify({ width: 3840, height: 2160, fps: 60, results }, null, 2),
  );
}
console.log("Benchmark output: " + folder);
for (const kind of ["canvas", "three", "mixed"]) {
  const cacheDirectory = path.join(folder, "cache-" + kind);
  for (const label of ["cold", "warm-1", "warm-2"])
    await trial(kind, label, {
      rawCanvas: kind === "canvas",
      cacheFrames: true,
      cacheWholeExport: true,
      cacheDirectory,
    });
}
await trial(
  "canvas",
  "long-legacy",
  { rawCanvas: true, rawStreaming: false, autoTune: false },
  10,
);
await trial(
  "canvas",
  "long-stream-1",
  {
    rawCanvas: true,
    rawStreaming: true,
    autoTune: false,
    failOnFallback: true,
  },
  10,
);
await trial(
  "canvas",
  "long-stream-2",
  {
    rawCanvas: true,
    rawStreaming: true,
    autoTune: false,
    failOnFallback: true,
  },
  10,
);
await trial("canvas", "long-adaptive", { rawCanvas: true, autoTune: true }, 10);
await trial("three", "angle-png-1", { rawCanvas: false, gpu: "angle" });
await trial("three", "angle-png-2", { rawCanvas: false, gpu: "angle" });
console.log("Completed: " + folder);
