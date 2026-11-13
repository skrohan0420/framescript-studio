import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";

test("selected audio can be enhanced locally and undone", async ({ page }) => {
  const project = newProject();
  const clip = clipFromAudio(synthesizeSound("Success chime"), "voice");
  project.audio = [clip];
  project.audioLibrary = [{ ...clip, id: "library-original" }];
  await page.route("**/api/workspaceGet", route => route.fulfill({ json: { result: project } }));
  await page.route("**/api/settingsGet", route => route.fulfill({ json: { result: {} } }));
  await page.route("**/api/settingsSet", route => route.fulfill({ json: { result: true } }));
  await page.route("**/api/autosave", route => route.fulfill({ json: { result: true } }));
  await page.goto("/#editor");
  const processed = await page.evaluate(async (data) => {
    const modulePath = "/src/enhance-audio.ts";
    const { enhanceAudio } = await import(modulePath);
    const result = await enhanceAudio(data, true);
    const context = new AudioContext();
    try {
      const decode = (value: string) => context.decodeAudioData(Uint8Array.from(atob(value.split(",")[1]), c => c.charCodeAt(0)).buffer);
      const before = await decode(data), after = await decode(result.data);
      let peak = 0, difference = 0;
      for (let i = 0; i < after.length; i++) {
        peak = Math.max(peak, Math.abs(after.getChannelData(0)[i]));
        difference += Math.abs(after.getChannelData(0)[i] - before.getChannelData(0)[i]);
      }
      return { sameLength: before.length === after.length, sameRate: before.sampleRate === after.sampleRate, sameChannels: before.numberOfChannels === after.numberOfChannels, peak, difference };
    } finally { await context.close(); }
  }, clip.data);
  expect(processed.sameLength && processed.sameRate && processed.sameChannels).toBe(true);
  expect(processed.peak).toBeLessThan(0.892);
  expect(processed.difference).toBeGreaterThan(0);
  const button = page.getByRole("button", { name: "Enhance audio", exact: true });
  await expect(button).toHaveCount(0);
  await page.locator(".audio-edit-clip").first().click();
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveText("Enhanced");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".status-bar .status-notice")).toContainText("Original audio restored");
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".audio-edit-clip").first()).toContainText("Enhanced");
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect(button).toBeEnabled();
  await expect(button).toHaveText("Enhance");
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const library = page.getByRole("region", { name: "Audio library", exact: true });
  const enhanceLibrary = library.getByRole("button", { name: `Enhance ${clip.name}`, exact: true });
  await enhanceLibrary.click();
  await expect(enhanceLibrary).toHaveAttribute("aria-pressed", "true");
  await expect(library.getByLabel(`${clip.name} is enhanced`, { exact: true })).toBeVisible();
  await expect(library.locator(".audio-library-tile")).toHaveCount(1);
  await expect(page.locator(".audio-edit-clip").first()).toContainText("Enhanced");
  await library.getByRole("button", { name: `Compare original ${clip.name}`, exact: true }).click();
  await expect(library.getByRole("button", { name: `Compare enhanced ${clip.name}`, exact: true })).toBeVisible();
  await expect(page.locator(".audio-edit-clip").first()).toContainText("Enhanced");
  await library.getByRole("button", { name: `Compare enhanced ${clip.name}`, exact: true }).click();
});
