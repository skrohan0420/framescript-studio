import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test("Settings opens above the prompt drawer and closes independently", async ({ page }) => {
  await page.route("**/api/workspaceGet", r => r.fulfill({ json: { result: newProject() } }));
  await page.route("**/api/settingsGet", r => r.fulfill({ json: { result: {} } }));
  await page.route("**/api/autosave", r => r.fulfill({ json: { result: true } }));
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Prompts panel", exact: true }).click();
  const drawer = page.locator("#prompt-builder-panel");
  await expect(drawer).toHaveAttribute("data-state", "open");
  await page.locator(".toolbar").getByRole("button", { name: "Project settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Project & application settings" });
  await expect(dialog).toBeVisible();
  // Verify painted stacking, not just DOM visibility: this point overlaps the drawer.
  await expect.poll(() => dialog.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(rect.right - 20, rect.top + 80));
  })).toBe(true);
  await dialog.getByRole("tab", { name: "Editor", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(drawer).toHaveAttribute("data-state", "open");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
});
