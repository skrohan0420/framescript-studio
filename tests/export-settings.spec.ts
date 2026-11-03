import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test("simple export preserves timeline resolution and FPS with automatic quality-first defaults", async ({
  page,
}) => {
  const project = newProject();
  project.settings = {
    ...project.settings,
    width: 3840,
    height: 2160,
    fps: 60,
    duration: 34.56643749999999,
  };
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
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
  await expect(dialog.locator(".export-output-summary")).toContainText(
    "3840 × 2160",
  );
  await expect(dialog.locator(".export-output-summary")).toContainText(
    "60 fps",
  );
  await expect(dialog.locator(".export-auto-note")).toContainText(
    "Automatic · quality first",
  );
  await expect(
    dialog.getByLabel("Export resolution", { exact: true }),
  ).not.toBeVisible();
  await page.screenshot({ path: "test-results/export-simple-4k.png" });
  await dialog.locator(".export-advanced > summary").click();
  for (const name of [
    "Output",
    "Image quality",
    "Timing",
    "Performance & compatibility",
  ]) {
    await expect(
      dialog.getByRole("region", { name, exact: true }),
    ).toBeVisible();
  }
  await expect(dialog.getByLabel("duration", { exact: true })).toHaveValue(
    "34.566",
  );
  await expect(dialog.getByLabel("width", { exact: true })).not.toBeVisible();
  await expect(
    dialog.getByLabel("Quality CRF (lower is better)", { exact: true }),
  ).not.toBeVisible();
  await dialog
    .getByRole("region", { name: "Output", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/export-advanced-groups.png" });
  await dialog.locator(".export-advanced > summary").click();
  await dialog
    .getByRole("button", { name: "Render & download", exact: true })
    .click();
  await expect.poll(() => submitted?.captureMode).toBe("lossless");
  expect(submitted).toMatchObject({
    width: 3840,
    height: 2160,
    fps: 60,
    quality: 18,
    graphics: "auto",
    acceleration: "auto",
  });
  expect(submitted.duration).toBe(project.settings.duration);
});

test("export hover help explains capture and compression without changing defaults", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  await expect(dialog.getByLabel("Export capture mode")).not.toBeVisible();
  await expect(
    dialog.getByLabel("Export format", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/export-simple.png" });
  await dialog.locator(".export-advanced > summary").click();
  await dialog.getByLabel("Export capture mode").hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toContainText("final 4K/60 video");
  await expect(dialog.getByLabel("Export capture mode")).toHaveValue(
    "lossless",
  );
  await dialog
    .getByRole("button", { name: "About rendering", exact: true })
    .focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "About quality", exact: true })
    .click();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Higher quality · 18");
  await expect(tooltip).toContainText("Higher quality · 18 · selected");
  await expect(dialog.getByLabel("Export quality")).toHaveValue("18");
  await tooltip.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(tooltip).toBeVisible();
  await page.screenshot({ path: "test-results/export-quality-help.png" });
  await page.keyboard.press("Escape");
  for (const [name, detail] of [
    ["About encoding", "separate from graphics acceleration"],
    ["About graphics acceleration", "meshes, lights and particles"],
  ]) {
    await dialog.getByRole("button", { name, exact: true }).focus();
    await expect(page.getByRole("tooltip")).toContainText(detail);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  }
  await expect(
    dialog.getByLabel("Export encoding", { exact: true }),
  ).toHaveValue("auto");
  await expect(
    dialog.getByLabel("Export graphics acceleration", { exact: true }),
  ).toHaveValue("auto");
  await page.setViewportSize({ width: 390, height: 850 });
  await dialog
    .getByRole("button", { name: "About graphics acceleration", exact: true })
    .click();
  await expect(page.getByRole("tooltip")).toBeVisible();
  const bounds = await page.getByRole("tooltip").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(850);
  await dialog
    .getByRole("button", { name: "About graphics acceleration", exact: true })
    .click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

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
  await expect(capture).not.toBeVisible();
  await expect(dialog.getByLabel("width", { exact: true })).not.toBeVisible();
  await dialog.locator(".export-advanced > summary").click();
  await expect(capture).toHaveValue("lossless");
  await dialog
    .getByLabel("Export format", { exact: true })
    .selectOption("webm");
  await dialog.getByLabel("Export transparency", { exact: true }).check();
  await expect(capture).toBeDisabled();
  await expect(capture).toHaveValue("lossless");
  await dialog.getByLabel("Export transparency", { exact: true }).uncheck();
  await dialog.getByLabel("Export format", { exact: true }).selectOption("mp4");
  await expect(capture).toBeEnabled();
  await expect(capture).toHaveValue("lossless");
  await capture.selectOption("lossless");
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
  await dialog.getByLabel("Reuse rendered frames", { exact: true }).check();
  const graphics = dialog.getByLabel("Export graphics acceleration", {
    exact: true,
  });
  const graphicsChoice = (await graphics
    .locator('option[value="hardware"]')
    .isEnabled())
    ? "hardware"
    : "auto";
  await graphics.selectOption(graphicsChoice);
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
  expect(submitted.reuseFrames).toBe(true);
  expect(submitted.graphics).toBe(graphicsChoice);
});
