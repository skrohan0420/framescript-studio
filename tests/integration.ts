import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { newProject, type ExportOptions } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { saveProject, loadProject } from "../server/storage";
import { renderExport } from "../server/export";
import { examples } from "../shared/examples";
const require = createRequire(import.meta.url),
  ffmpeg = require("ffmpeg-static") as string;
const dir = path.resolve("test-results/integration");
await fs.mkdir(dir, { recursive: true });
const project = newProject();
project.settings = {
  ...project.settings,
  width: 320,
  height: 180,
  duration: 1,
  fps: 10,
};
project.css =
  "body{background:#101321}#ball{width:40px;height:40px;background:#a78bfa;position:absolute;top:60px;animation:move 1s linear infinite}@keyframes move{from{left:0}to{left:280px}}";
project.assets = [
  {
    id: "portable",
    name: "square.svg",
    data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/%3E',
  },
];
await saveProject(path.join(dir, "project.frame"), project);
const reopened = await loadProject(path.join(dir, "project.frame"));
assert.deepEqual(reopened, project);
console.log("PASS portable save / reopen");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
let errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setContent(documentFor(reopened));
await page.evaluate(() => (window as any).__fsSeek(0));
const a = await page.screenshot();
const x0 = await page
  .locator("#ball")
  .evaluate((el) => el.getBoundingClientRect().left);
await page.evaluate(() => (window as any).__fsSeek(0.5));
const b = await page.screenshot();
const x1 = await page
  .locator("#ball")
  .evaluate((el) => el.getBoundingClientRect().left);
assert.notDeepEqual(a, b);
assert(x1 - x0 > 100);
await fs.writeFile(path.join(dir, "time-0.png"), a);
await fs.writeFile(path.join(dir, "time-0.5.png"), b);
assert.equal(
  await page.evaluate(() => typeof (window as any).require),
  "undefined",
);
console.log("PASS visible frame difference / CSS seeking / no Node API");
for (const example of examples) {
  await page.goto("about:blank");
  errors = [];
  await page.setContent(documentFor(example));
  await page.evaluate(() => (window as any).__fsSeek(0.5));
  assert.equal(errors.length, 0, example.name + ": " + errors.join(","));
}
await browser.close();
console.log("PASS 10 gallery examples execute");
const base: ExportOptions = {
  format: "mp4",
  width: 320,
  height: 180,
  fps: 10,
  duration: 1,
  speed: 1,
  quality: 24,
  fit: "fit",
  transparent: false,
  time: 0.5,
};
const probe = (file: string) => {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-i", file], {
    encoding: "utf8",
  });
  return result.stderr;
};
for (const speed of [0.5, 1, 2]) {
  const output = path.join(dir, `speed-${speed}.mp4`);
  await fs.rm(output, { force: true });
  await renderExport(
    reopened,
    { ...base, speed },
    output,
    ffmpeg,
    new AbortController().signal,
    () => {},
  );
  const info = probe(output);
  assert(info.includes("320x180"));
  assert(info.includes("10 fps"));
  const match = info.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  assert(match, info);
  const duration = +match[1] * 3600 + +match[2] * 60 + +match[3];
  assert(Math.abs(duration - 1 / speed) < 0.11, info);
  console.log(`PASS MP4 speed ${speed}: ${duration}s, 320x180, 10 fps`);
}
for (const format of ["mkv", "webm", "gif", "sequence", "png"] as const) {
  const output = path.join(dir, "sample." + format);
  await fs.rm(output, { recursive: true, force: true });
  await renderExport(
    reopened,
    { ...base, format },
    output,
    ffmpeg,
    new AbortController().signal,
    () => {},
  );
  if (format === "sequence")
    assert.equal((await fs.readdir(output)).length, 10);
  else assert((await fs.stat(output)).size > 32);
  console.log("PASS real " + format + " output");
}
const controller = new AbortController();
const cancelled = path.join(dir, "cancelled.mp4");
await fs.rm(cancelled, { force: true });
await assert.rejects(() =>
  renderExport(
    reopened,
    { ...base, duration: 10 },
    cancelled,
    ffmpeg,
    controller.signal,
    (p) => {
      if (p.done === 2) controller.abort();
    },
  ),
);
await assert.rejects(() => fs.stat(cancelled));
assert(!(await fs.readdir(dir)).some((f) => f.includes(".partial-")));
console.log("PASS cancellation and partial-file cleanup");
const verifyCancellation = new AbortController();
const verifyOutput = path.join(dir, "cancelled-verification.mp4");
await assert.rejects(() =>
  renderExport(
    reopened,
    { ...base, duration: 0.2 },
    verifyOutput,
    ffmpeg,
    verifyCancellation.signal,
    (progress) => {
      if (progress.stage === "Verifying video") verifyCancellation.abort();
    },
  ),
);
await assert.rejects(() => fs.stat(verifyOutput));
assert(!(await fs.readdir(dir)).some((file) => file.includes(".partial-")));
console.log("PASS verification-stage cancellation and cleanup");
await fs.writeFile(
  path.join(dir, "results.json"),
  JSON.stringify(
    {
      passed: true,
      date: new Date().toISOString(),
      checks: [
        "portable project",
        "frame differences",
        "gallery",
        "mp4 speed metadata",
        "mkv",
        "webm",
        "gif",
        "sequence",
        "png",
        "cancellation",
      ],
    },
    null,
    2,
  ),
);
