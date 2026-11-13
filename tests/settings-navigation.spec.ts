import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/projectList", (r) =>
    r.fulfill({ json: { result: [] } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/exportStorage", (r) =>
    r.fulfill({
      json: { result: { files: 3, bytes: 12_000_000, retentionDays: 7 } },
    }),
  );
  await page.route("**/api/recoveryList", (r) =>
    r.fulfill({ json: { result: [] } }),
  );
});

test("home settings exposes application preferences, keyboard navigation and safe project scope", async ({
  page,
}) => {
  let preferences: Record<string, unknown> = {};
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: preferences } }),
  );
  await page.route("**/api/settingsSet", (r) => {
    preferences = { ...preferences, ...r.request().postDataJSON().args[0] };
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Application settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Project & application settings",
  });
  const tabs = dialog.getByRole("tablist", { name: "Settings categories" });
  await expect(tabs.getByRole("tab")).toHaveCount(6);
  for (const name of ["Project", "Brand kit", "Recovery"])
    await expect(tabs.getByRole("tab", { name, exact: true })).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Warm / Stone", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "stone");
  await tabs.getByRole("tab", { name: "Editor", exact: true }).click();
  await dialog.getByLabel("Editor font size").fill("18");
  await expect(dialog.getByLabel("Canvas width")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Keyboard shortcuts", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Keyboard shortcuts", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    tabs.getByRole("tab", { name: "Editor", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Storage", exact: true }).click();
  await dialog.getByRole("button", { name: "Check retained renders" }).click();
  await expect(dialog.getByRole("status")).toContainText("12.0 MB");
  await tabs
    .getByRole("tab", { name: "Storage", exact: true })
    .press("ArrowDown");
  await expect(
    tabs.getByRole("tab", { name: "Appearance", exact: true }),
  ).toBeFocused();
  await page.screenshot({ path: "test-results/settings-home.png" });
  await expect.poll(() => preferences.palette).toBe("stone");
  await expect.poll(() => preferences.fontSize).toBe(18);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".project-home")).toBeVisible();
  await page.keyboard.press("Control+Comma");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "stone");
});

test("editor settings groups project, brand and recovery controls and fits a narrow viewport", async ({
  page,
}) => {
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  let saved: any;
  await page.route("**/api/autosave", (r) => {
    saved = r.request().postDataJSON().args[0];
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page
    .locator(".toolbar")
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Project & application settings",
  });
  await dialog.getByRole("tab", { name: "Project", exact: true }).click();
  await dialog.getByLabel("Canvas width").fill("2560");
  await dialog.getByLabel("Canvas height").fill("1440");
  await expect.poll(() => saved?.settings.width).toBe(2560);
  await expect.poll(() => saved?.settings.height).toBe(1440);
  await expect(
    dialog.getByRole("button", { name: "Save copy as .frame" }),
  ).toBeVisible();
  await dialog.getByRole("tab", { name: "Brand kit", exact: true }).click();
  await dialog
    .getByLabel("Brand name", { exact: true })
    .fill("FrameScript test brand");
  await expect.poll(() => saved?.brand?.name).toBe("FrameScript test brand");
  await dialog.getByRole("tab", { name: "Recovery", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Recovery history", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Recovery history", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    dialog.getByRole("tab", { name: "Recovery", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await dialog.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page.screenshot({ path: "test-results/settings-tabbed.png" });
  const headerBefore = await dialog.locator(".modal-head").boundingBox();
  await dialog.getByRole("tabpanel").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect((await dialog.locator(".modal-head").boundingBox())!.y).toBe(
    headerBefore!.y,
  );
  await page.setViewportSize({ width: 580, height: 720 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.width).toBeLessThanOrEqual(580);
  await page.screenshot({ path: "test-results/settings-tabbed-narrow.png" });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".toolbar")).toBeVisible();
});
