import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test("native Find matches literal and multiline code without a separate search mode", async ({ page }) => {
  const lines = [
    "addMesh(vig, new THREE.ShapeGeometry(roundedRect(3.3, 3.9, 1.05), 48), flat(C.blue, 0.30, 'vig'), 0, 0, 0);",
    "addMesh(vig, new THREE.ShapeGeometry(roundedRect(2.85, 3.45, 0.85), 48), flat(C.blue, 0.55, 'vig'), 0, 0, 0);",
  ];
  const project = newProject();
  project.js = `  // ${lines[0]}\n    // ${lines[1]}`;
  let saved = project;
  await page.route("**/api/workspaceGet", r => r.fulfill({ json: { result: project } }));
  await page.route("**/api/settingsGet", r => r.fulfill({ json: { result: { leftView: "code", layoutVersion: 2 } } }));
  await page.route("**/api/settingsSet", r => r.fulfill({ json: { result: true } }));
  await page.route("**/api/autosave", r => {
    saved = r.request().postDataJSON().args[0];
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await page.locator(".editor-tabs").getByRole("button", { name: "JavaScript", exact: true }).click();
  const editor = page.locator(".code-panel .monaco-editor").first();
  await expect(editor).toBeVisible();
  await editor.locator(".view-lines").click();
  await page.keyboard.press("Control+f");
  const find = editor.locator(".find-widget");
  await expect(find).toHaveClass(/visible/);
  const input = find.locator("textarea").first();
  await input.fill(lines.join("\n"));
  await expect(find).toContainText("No results");
  // Exact single-line searches continue to treat punctuation literally.
  await input.fill(lines[0]);
  await expect(find).toContainText("1 of 1");
  await input.fill(project.js);
  await expect(find).toContainText("1 of 1");
  expect(saved.js).toBe(project.js);
  await input.fill(project.js.replaceAll("\n", "\r\n"));
  await expect(find).toContainText("1 of 1");
  // The toolbar Find action uses the same native widget in the expanded editor.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand editor", exact: true }).click();
  await page.getByRole("button", { name: "Find", exact: true }).click();
  const expandedFind = page.locator(".code-workbench-expanded .find-widget");
  await expect(expandedFind).toHaveClass(/visible/);
  await expandedFind.locator("textarea").first().fill(lines[1]);
  await expect(expandedFind).toContainText("1 of 1");
  await expect(page.getByRole("button", { name: "Match code", exact: true })).toHaveCount(0);
  expect(saved.js).toBe(project.js);
});
