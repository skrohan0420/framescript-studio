import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test("Home dialogs contain keyboard focus, close with Escape and restore their opener", async ({
  page,
}) => {
  await page.goto("/");
  const opener = page.getByRole("button", {
    name: "Video project",
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole("dialog", {
    name: "Create project",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("New project canvas")).toHaveValue(
    "1920x1080",
  );
  await expect(dialog.getByLabel("New project frame rate")).toHaveValue("30");
  await page.getByRole("button", { name: "Close create project" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("tablet editing fits and switches between library and inspector", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/#editor");
  await expect(
    page.getByRole("button", { name: "Add timeline", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    768,
  );
  const player = await page.locator(".center").boundingBox();
  expect(player!.width).toBeGreaterThan(250);
  await page
    .getByRole("button", { name: "Show inspector", exact: true })
    .click();
  await expect(page.locator(".assistant-panel")).toBeVisible();
  await expect(page.locator(".code-panel")).toBeHidden();
  await page.getByRole("button", { name: "Show library", exact: true }).click();
  await expect(page.locator(".code-panel")).toBeVisible();
  await page.screenshot({ path: "test-results/assessment-fixed-tablet.png" });
});

test("a delayed image cannot be inserted into a replacement project", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (file) {
      (window as any).releaseImage = () => original.call(this, file);
    };
  });
  await page.goto("/#editor");
  await expect(
    page.getByRole("button", { name: "Add timeline", exact: true }),
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "delayed.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
      ),
    });
  await expect
    .poll(() => page.evaluate(() => typeof (window as any).releaseImage))
    .toBe("function");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  const file = await chooser;
  await file.setFiles({
    name: "replacement.frame",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ ...newProject(), name: "Replacement project" }),
    ),
  });
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue("Replacement project");
  await page.evaluate(() => (window as any).releaseImage());
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Project changed during image import" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ASSETS 0", exact: true }),
  ).toBeVisible();
});

test("rename remains consistent after delayed autosave and reload", async ({
  page,
}) => {
  await page.route("**/api/autosave", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Video project", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Create project",
    exact: true,
  });
  const name = "Rename race " + Date.now();
  await dialog.getByLabel("New project name").fill(name);
  await dialog
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("button", { name: "Project home", exact: true }).click();
  await page
    .getByRole("button", { name: "Rename " + name, exact: true })
    .click();
  const rename = page.getByRole("dialog", {
    name: "Rename project",
    exact: true,
  });
  await rename.getByLabel("Project title").fill(name + " updated");
  await rename.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Open " + name + " updated",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open " + name, exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Open " + name + " updated",
      exact: true,
    }),
  ).toBeVisible();
});
