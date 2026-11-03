import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/recover", (route) =>
    route.fulfill({ json: { result: null } }),
  );
});

test("recovery stays nonblocking and acknowledged snapshots do not reappear", async ({
  page,
}) => {
  let snapshot = { ...newProject(), name: "Recovered project" };
  await page.route("**/api/recover", (route) =>
    route.fulfill({ json: { result: snapshot } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  const banner = page.getByRole("region", { name: "Autosave recovery" });
  await expect(banner).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "ALL", exact: false }).first().click();
  await banner.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#ball"),
  ).toBeVisible();
  await expect(banner).toHaveCount(0);
  snapshot = { ...snapshot, name: "Newer autosave" };
  await page.reload();
  await expect(banner).toContainText("Newer autosave");
  await banner
    .getByRole("button", { name: "Restore workspace", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue(
    "Newer autosave",
  );
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#ball"),
  ).toBeVisible();
  await expect(banner).toHaveCount(0);
});
test("local Node backend saves, reopens, imports assets and downloads an MP4", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#ball"),
  ).toBeVisible();
  const [projectDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save (Ctrl+S)", exact: true }).click(),
  ]);
  const projectFile = await projectDownload.path();
  expect(projectFile).toBeTruthy();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Open project", exact: true }).click(),
  ]);
  await chooser.setFiles(projectFile!);
  await expect(page.getByRole("status")).toContainText("Project opened");
  await page.locator("input[type=file]").setInputFiles({
    name: "reference.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>',
    ),
  });
  await expect(page.getByRole("textbox", { name: "Asset name" })).toHaveValue(
    "reference.svg",
  );
  await page.getByRole("button", { name: "Insert image into HTML" }).click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("img"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Export", exact: false })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  await dialog.locator(".export-advanced > summary").click();
  await dialog
    .getByLabel("Export resolution", { exact: true })
    .selectOption("custom");
  await dialog
    .getByLabel("Export frame rate", { exact: true })
    .selectOption("custom");
  for (const [label, value] of [
    ["width", "320"],
    ["height", "180"],
    ["duration", "0.4"],
    ["Custom frame rate", "10"],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  const [video] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Render & download" }).click(),
  ]);
  expect(video.suggestedFilename()).toMatch(/\.mp4$/);
  expect(await video.failure()).toBeNull();
  await video.saveAs("test-results/web-workflow.mp4");
  await expect(
    page.getByRole("status").filter({ hasText: "Export verified" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/web-workspace.png" });
});
test("workspace executes preview, timeline, combined source and inspector", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await expect(page.getByText("LIVE PREVIEW", { exact: true })).toBeVisible();
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("#ball")).toBeVisible();
  const y0 = await preview
    .locator("#ball")
    .evaluate((el) => el.getBoundingClientRect().y);
  await page.getByRole("slider", { name: "Timeline position" }).fill("1");
  await page.waitForTimeout(100);
  const y1 = await preview
    .locator("#ball")
    .evaluate((el) => el.getBoundingClientRect().y);
  expect(Math.abs(y1 - y0)).toBeGreaterThan(100);
  await page.getByRole("button", { name: "ALL", exact: false }).first().click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page
    .getByRole("button", { name: "Select element", exact: true })
    .click();
  await preview.locator("#ball").click();
  await expect(page.getByText("div #ball", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Examples", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/workspace.png", fullPage: true });
});
test("failed preview preserves last valid frame and visual edits update source", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("#ball")).toBeVisible();
  await page
    .getByRole("button", { name: "Select element", exact: true })
    .click();
  await preview.locator("#ball").click();
  await expect(page.getByText("div #ball", { exact: true })).toBeVisible();
  const width = page
    .locator(".properties label")
    .filter({ has: page.locator("span", { hasText: /^width$/ }) })
    .locator("input");
  await width.fill("200px");
  await width.blur();
  await expect(preview.locator("#ball")).toHaveCSS("width", "200px");
  await page
    .getByRole("button", { name: "JavaScript", exact: false })
    .first()
    .click();
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    'throw new Error("intentional validation failure")',
  );
  await expect(page.locator(".preview-error")).toContainText(
    "intentional validation failure",
  );
  await expect(preview.locator("#ball")).toBeVisible();
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: null } }),
  );
});
