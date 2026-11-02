import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
test("export offers resolution/frame-rate/quality presets and keeps custom settings advanced", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
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
  let submitted: any;
  await page.route("**/api/export", (r) => {
    submitted = r.request().postDataJSON().args[1];
    return r.fulfill({ json: { result: null } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  await expect(dialog.getByLabel("width", { exact: true })).not.toBeVisible();
  const resolution = dialog.getByLabel("Export resolution", { exact: true });
  for (const [preset, width, height] of [
    ["480", 854, 480],
    ["720", 1280, 720],
    ["1080", 1920, 1080],
    ["1440", 2560, 1440],
    ["2160", 3840, 2160],
    ["4320", 7680, 4320],
  ] as const) {
    await resolution.selectOption(preset);
    await expect(dialog.locator(".export-output-summary")).toContainText(
      `${width} × ${height}`,
    );
  }
  await resolution.selectOption("2160");
  await dialog.getByLabel("Export frame rate").selectOption("60");
  await dialog.getByLabel("Export quality").selectOption("18");
  await page.screenshot({ path: "test-results/export-presets.png" });
  await resolution.selectOption("custom");
  await expect(dialog.getByLabel("width", { exact: true })).toBeVisible();
  await dialog.getByLabel("width", { exact: true }).fill("1920");
  await dialog.getByLabel("height", { exact: true }).fill("1080");
  await dialog
    .getByRole("button", { name: "Render & download", exact: true })
    .click();
  await expect.poll(() => submitted?.width).toBe(1920);
  expect(submitted.height).toBe(1080);
  expect(submitted.fps).toBe(60);
  expect(submitted.quality).toBe(18);
});
