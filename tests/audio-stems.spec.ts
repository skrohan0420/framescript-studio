import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { newProject } from "../shared/project";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";

test("exports a real aligned stem ZIP through the editor, queue, worker and download endpoint", async ({
  page,
}) => {
  const p = newProject();
  p.name = "Stem delivery";
  p.settings = { ...p.settings, duration: 1.25, width: 320, height: 180 };
  p.audio = [
    {
      ...clipFromAudio(synthesizeSound("Success chime"), "voice"),
      start: 0.125,
    },
    {
      ...clipFromAudio(synthesizeSound("Ambient loop"), "music"),
      length: 1.25,
    },
  ];
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: p } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  // Simulate a browser suppressing the second automatic download. A real
  // pointer click on the visible anchor must still retrieve the finished ZIP.
  await page.addInitScript(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download.endsWith("-audio-stems.zip")) return;
      original.call(this);
    };
  });
  let videoOptions: any;
  await page.route("**/api/export", (r) => {
    const options = r.request().postDataJSON().args[1];
    if (options.format === "stems") return r.continue();
    videoOptions = options;
    return r.continue();
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  await expect(
    dialog.getByLabel("Download audio stems separately (ZIP)"),
  ).not.toBeChecked();
  await expect(
    dialog.locator('select[aria-label="Export format"] option[value="stems"]'),
  ).toHaveCount(0);
  await dialog.getByLabel("Download audio stems separately (ZIP)").check();
  await expect(dialog.locator(".export-audio-state")).toHaveText("Included");
  await page.screenshot({ path: "test-results/audio-stems-option.png" });
  await dialog.locator(".export-advanced > summary").click();
  await dialog
    .getByLabel("Export file name", { exact: true })
    .fill("Stem delivery");
  await dialog.getByLabel("speed", { exact: true }).fill("2");
  await page.screenshot({ path: "test-results/audio-stems-settings.png" });
  await dialog
    .getByRole("button", { name: "Render & download", exact: true })
    .click();
  const audioDownload = dialog.getByRole("link", {
    name: "Download audio stems ZIP",
    exact: true,
  });
  await expect(audioDownload).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Download export", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("region", { name: "Export files" }),
  ).toContainText("Stem delivery-audio-stems.zip");
  const downloadPromise = page.waitForEvent("download");
  await audioDownload.click();
  const download = await downloadPromise;
  expect(videoOptions.format).toBe("mp4");
  expect(download.suggestedFilename()).toBe("Stem delivery-audio-stems.zip");
  const zip = await fs.readFile((await download.path())!);
  const end = zip.lastIndexOf(Buffer.from("504b0506", "hex"));
  let entry = zip.readUInt32LE(end + 16);
  const files: Record<string, Buffer> = {};
  while (entry < end) {
    const length = zip.readUInt16LE(entry + 28);
    const name = zip.toString("utf8", entry + 46, entry + 46 + length);
    const local = zip.readUInt32LE(entry + 42);
    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + zip.readUInt32LE(entry + 20));
    files[name] =
      zip.readUInt16LE(entry + 10) === 8 ? inflateRawSync(data) : data;
    entry +=
      46 + length + zip.readUInt16LE(entry + 30) + zip.readUInt16LE(entry + 32);
  }
  expect(Object.keys(files).sort()).toEqual([
    "manifest.json",
    "master.wav",
    "music.wav",
    "narration.wav",
    "sfx.wav",
  ]);
  const manifest = JSON.parse(files["manifest.json"].toString());
  expect(manifest.mode).toBe("processed");
  expect(manifest.speed).toBe(2);
  expect(manifest.sampleCount).toBe(30400);
  expect(
    manifest.stems.every((s: any) => s.sampleCount === manifest.sampleCount),
  ).toBe(true);
  await page.screenshot({ path: "test-results/audio-stems-ready.png" });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".export-dock")).toContainText("Download ZIP");
  await page.reload();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(
    page.getByLabel("Download audio stems separately (ZIP)"),
  ).toBeChecked();
});
