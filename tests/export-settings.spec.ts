import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test("export failure is visible in the dialog and retry clears it", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  let attempts = 0;
  await page.route("**/api/export", (r) =>
    ++attempts === 1
      ? r.fulfill({
          status: 400,
          json: {
            result: {
              error:
                "Rendering browser is unavailable. Run npx playwright install chromium, then restart FrameScript Studio and retry the export.",
            },
          },
        })
      : r.fulfill({ json: { result: null } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  const render = dialog.getByRole("button", {
    name: "Render & download",
    exact: true,
  });
  await render.click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Rendering browser is unavailable",
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "npx playwright install chromium",
  );
  await expect(dialog.locator(".export-progress")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Export current timeline", exact: true })
    .click();
  await render.click();
  await expect.poll(() => attempts).toBe(2);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
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
  const capture = dialog.getByLabel("Export capture mode");
  await expect(capture).toHaveValue("fast");
  await dialog
    .getByLabel("Export format", { exact: true })
    .selectOption("webm");
  await dialog.getByLabel("Export transparency", { exact: true }).check();
  await expect(capture).toBeDisabled();
  await expect(capture).toHaveValue("lossless");
  await dialog.getByLabel("Export transparency", { exact: true }).uncheck();
  await dialog.getByLabel("Export format", { exact: true }).selectOption("mp4");
  await expect(capture).toBeEnabled();
  await expect(capture).toHaveValue("fast");
  await capture.selectOption("lossless");
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
  expect(submitted.captureMode).toBe("lossless");
});
