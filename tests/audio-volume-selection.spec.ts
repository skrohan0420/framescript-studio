import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";
test("audio volume controls fit the row and adjust individual clips; source removal keeps the timeline", async ({
  page,
}) => {
  const project = newProject();
  project.audio = [clipFromAudio(synthesizeSound("Success chime"), "voice")];
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  const volume = page.getByRole("slider", {
    name: "voice row 1 volume",
    exact: true,
  });
  await volume.fill("0.4");
  await volume.fill("1.5");
  await expect(page.locator(".audio-row-volume small")).toHaveText("150%");
  await volume.fill("0.4");
  await expect(page.locator(".audio-row-volume small")).toHaveText("40%");
  const row = (await page.locator(".audio-row-label").boundingBox())!,
    slider = (await volume.boundingBox())!;
  expect(slider.x + slider.width).toBeLessThanOrEqual(row.x + row.width);
  await page
    .getByRole("button", { name: "Volume of Success chime", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Selected clip volume", exact: true })
    .fill("1.5");
  await expect(
    page.getByRole("dialog", {
      name: "Clip volume: Success chime",
      exact: true,
    }),
  ).toContainText("150%");
  await page
    .getByRole("button", { name: "Close clip volume", exact: true })
    .click();
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Remove Success chime from library",
      exact: true,
    })
    .click();
  await expect(page.locator(".audio-library-tile")).toHaveCount(0);
  await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
  await volume.fill("0.5");
  await expect(page.locator(".audio-library-tile")).toHaveCount(0);
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect(page.locator(".audio-library-tile")).toHaveCount(1);
});
test("dragging a selection box selects clips and Delete removes them together", async ({
  page,
}) => {
  const project = newProject();
  project.audio = [
    clipFromAudio(synthesizeSound("Success chime"), "voice"),
    { ...clipFromAudio(synthesizeSound("Whoosh"), "sfx"), start: 2 },
  ];
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  const tracks = page.locator(".audio-edit-track");
  const first = (await tracks.first().boundingBox())!,
    last = (await tracks.last().boundingBox())!;
  await page.mouse.move(first.x + first.width - 5, last.y + last.height - 4);
  await page.mouse.down();
  await page.mouse.move(first.x + 2, first.y + 2, { steps: 8 });
  await expect(page.locator(".timeline-selection-box")).toBeVisible();
  await page.mouse.up();
  await expect(
    page.locator('[data-timeline-kind="audio"][data-box-selected="true"]'),
  ).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(page.locator(".audio-edit-clip")).toHaveCount(0);
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect(page.locator(".audio-edit-clip")).toHaveCount(2);
});
