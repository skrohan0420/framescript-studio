import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";

test("audio cards toggle real previews, switch recordings and stop when leaving Audio", async ({
  page,
}) => {
  const project = newProject();
  project.audioLibrary = [
    clipFromAudio(synthesizeSound("Ambient loop"), "music"),
    clipFromAudio(synthesizeSound("Gentle pulse"), "music"),
  ];
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    (window as any).previewPlayers = [];
    HTMLMediaElement.prototype.play = function () {
      if (!(window as any).previewPlayers.includes(this))
        (window as any).previewPlayers.push(this);
      return play.call(this);
    };
  });
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const first = page.getByRole("button", {
    name: "Inspect Ambient loop",
    exact: true,
  });
  const second = page.getByRole("button", {
    name: "Inspect Gentle pulse",
    exact: true,
  });
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).previewPlayers.filter(
            (player: HTMLAudioElement) => !player.paused,
          ).length,
      ),
    )
    .toBe(1);
  await second.click();
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() => (window as any).previewPlayers[0].paused),
  ).toBe(true);
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "false");
  await first.click();
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  expect(
    await page.evaluate(() =>
      (window as any).previewPlayers.every(
        (player: HTMLAudioElement) => player.paused,
      ),
    ),
  ).toBe(true);
  await expect(page.locator(".audio-edit-clip")).toHaveCount(0);
});
