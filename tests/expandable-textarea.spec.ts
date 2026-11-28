import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspaceGet", route => route.fulfill({ json: { result: newProject() } }));
  await page.route("**/api/settingsGet", route => route.fulfill({ json: { result: {} } }));
  await page.route("**/api/settingsSet", route => route.fulfill({ json: { result: true } }));
  await page.route("**/api/autosave", route => route.fulfill({ json: { result: true } }));
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Prompts panel", exact: true }).click();
});

test("full-screen direction edits update the draft and restore selection without closing the drawer", async ({ page }) => {
  await page.getByRole("tab", { name: "Direction", exact: true }).click();
  const source = page.locator("#selected-creative-direction");
  await source.fill("Keep the golden star visible, then reveal its core.");
  await source.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(5, 20));
  await source.locator("..").getByRole("button", { name: "Expand text field", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const editor = dialog.getByRole("textbox");
  await expect(editor).toHaveValue("Keep the golden star visible, then reveal its core.");
  expect(await editor.evaluate(field => [(field as HTMLTextAreaElement).selectionStart, (field as HTMLTextAreaElement).selectionEnd])).toEqual([5, 20]);
  await expect(editor).toHaveAttribute("maxlength", "30000");
  await editor.fill("Reveal the stellar core in three readable beats.");
  await editor.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(7, 18));
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBe(1600);
  expect(bounds?.height).toBe(1000);
  await page.screenshot({ path: "test-results/fullscreen-direction.png" });
  await editor.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(source).toBeFocused();
  await expect(source).toHaveValue("Reveal the stellar core in three readable beats.");
  expect(await source.evaluate(field => [(field as HTMLTextAreaElement).selectionStart, (field as HTMLTextAreaElement).selectionEnd])).toEqual([7, 18]);
  await expect(page.locator(".prompt-drawer")).toBeVisible();
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  expect(await page.getByLabel("Generated prompt", { exact: true }).inputValue()).toContain("Reveal the stellar core in three readable beats.");
});

test("read-only prompt previews expand without permitting edits", async ({ page }) => {
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  await page.getByText("Preview generated prompt", { exact: true }).click();
  const value = await page.getByLabel("Generated prompt", { exact: true }).inputValue();
  await page.getByLabel("Generated prompt", { exact: true }).locator("..").getByRole("button", { name: "Expand text field", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Generated prompt", exact: true });
  const editor = dialog.getByRole("textbox");
  await expect(editor).toHaveValue(value);
  await expect(editor).toHaveAttribute("readonly", "");
  await editor.press("ControlOrMeta+a");
  await editor.press("Backspace");
  await expect(editor).toHaveValue(value);
  await page.getByRole("button", { name: "Close full-screen text editor", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("import text expands inside another dialog and fits a narrow screen", async ({ page }) => {
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  await page.getByRole("button", { name: "Paste full HTML document", exact: true }).click();
  const parent = page.getByRole("dialog", { name: "Paste full HTML document", exact: true });
  await parent.getByLabel("HTML document to import", { exact: true }).fill("<div>Original</div>");
  await page.setViewportSize({ width: 390, height: 850 });
  await parent.getByRole("button", { name: "Expand text field", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "HTML document to import", exact: true });
  await dialog.getByRole("textbox").fill("<div>Updated in full screen</div>");
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect((await dialog.boundingBox())?.width).toBe(390);
  expect((await dialog.boundingBox())?.height).toBe(850);
  // Keyboard focus remains inside the expanded editor.
  await dialog.getByRole("textbox").press("Tab");
  expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: "test-results/fullscreen-text-mobile.png" });
  await dialog.getByRole("textbox").press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(parent).toBeVisible();
  await expect(parent.getByLabel("HTML document to import", { exact: true })).toHaveValue("<div>Updated in full screen</div>");
});
