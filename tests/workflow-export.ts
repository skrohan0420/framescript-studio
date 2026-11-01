import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import {
  newProject,
  projectSchema,
  type ExportOptions,
} from "../shared/project";
import { initialWorkflow, activateScene } from "../shared/workflow";
import { composeProject } from "../shared/composition";
import { documentFor } from "../shared/runtime";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";
import { renderExport } from "../server/export";
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
const dir = path.resolve("test-results/workflow-export");
await fs.mkdir(dir, { recursive: true });
let p = newProject();
p.settings = { ...p.settings, width: 320, height: 180, fps: 10, duration: 0.4 };
p.workflow = initialWorkflow(p);
p.workflow.scenes[0] = {
  ...p.workflow.scenes[0],
  html: "<h1>ONE</h1>",
  css: "body{background:red}",
  js: "",
};
p.workflow.scenes.push({
  ...p.workflow.scenes[0],
  id: "two",
  title: "Two",
  html: '<h1>TWO</h1><img src="asset://test">',
  css: "body{background:blue}img{width:20px;height:20px}",
});
p.assets = [
  {
    id: "test",
    name: "test.svg",
    data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="lime"/%3E%3C/svg%3E',
  },
];
p = { ...p, ...activateScene(p, p.workflow.selectedId) };
const voice = clipFromAudio(
  synthesizeSound("Success chime"),
  "voice",
  p.workflow!.scenes[1].id,
);
voice.length = 0.4;
const music = clipFromAudio(synthesizeSound("Ambient loop"), "music");
music.length = 0.8;
music.fadeIn = 0;
music.fadeOut = 0;
p.audio = [voice, music];
const master = projectSchema.parse(composeProject(p));
assert.equal(master.audio![0].start, 0.4);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  await page.setContent(documentFor(master));
  await page.evaluate(() => (window as any).__fsSeek(0));
  await page.waitForTimeout(100);
  const first = await page.screenshot();
  await page.evaluate(() => (window as any).__fsSeek(0.6));
  await page.waitForTimeout(100);
  const second = await page.screenshot();
  assert.notDeepEqual(first, second);
  const child = page.frames()[2];
  assert.equal(await child.locator("h1").textContent(), "TWO");
  assert(
    (await child
      .locator("img")
      .evaluate((img) => (img as HTMLImageElement).naturalWidth)) > 0,
  );
  await fs.writeFile(path.join(dir, "master-second.png"), second);
} finally {
  await browser.close();
}
console.log("PASS master scene switch and embedded assets");
const base: ExportOptions = {
  format: "mp4",
  width: 320,
  height: 180,
  fps: 10,
  duration: 0.8,
  speed: 1,
  quality: 24,
  fit: "fit",
  transparent: false,
  time: 0,
};
for (const [format, speed] of [
  ["mp4", 0.5],
  ["mp4", 2],
  ["webm", 1],
  ["mkv", 1],
] as const) {
  const file = path.join(dir, `${format}-${speed}.${format}`);
  await fs.rm(file, { force: true });
  await renderExport(
    master,
    { ...base, format, speed },
    file,
    ffmpeg,
    new AbortController().signal,
    () => {},
  );
  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", file], {
    encoding: "utf8",
  }).stderr;
  assert(probe.includes("Audio:"), probe);
  const pcm = spawnSync(
    ffmpeg,
    ["-v", "error", "-i", file, "-map", "0:a:0", "-f", "s16le", "-"],
    { maxBuffer: 4_000_000 },
  );
  assert.equal(pcm.status, 0, pcm.stderr.toString());
  assert(pcm.stdout.some((x) => x !== 0));
  const match = probe.match(/Duration: (\d+):(\d+):(\d+\.\d+)/)!;
  assert(match, probe);
  const duration = +match[1] * 3600 + +match[2] * 60 + +match[3];
  assert(Math.abs(duration - 0.8 / speed) < 0.15, probe);
  console.log(
    `PASS ${format} audible mix at speed ${speed}, duration ${duration}`,
  );
}
const controller = new AbortController(),
  cancelled = path.join(dir, "cancelled.mp4");
await fs.rm(cancelled, { force: true });
await assert.rejects(
  renderExport(master, base, cancelled, ffmpeg, controller.signal, (p) => {
    if (p.stage === "Mixing audio") controller.abort();
  }),
);
await assert.rejects(fs.stat(cancelled));
assert(!(await fs.readdir(dir)).some((f) => f.includes(".partial-")));
console.log("PASS audio cancellation cleanup");
