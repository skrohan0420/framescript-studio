import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test("director chooses typography despite old disabled settings and identity text permissions", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const project = newProject();
  project.promptDraft = { typographyEnabled: false, textFont: "STALE FONT", screenText: "STALE TITLE",
    identityGuide: "Typography permissions: Text is explicitly disabled. Do not render any on-screen typography." };
  await page.route("**/api/workspaceGet", r => r.fulfill({ json: { result: project } }));
  await page.route("**/api/settingsGet", r => r.fulfill({ json: { result: {} } }));
  await page.route("**/api/settingsSet", r => r.fulfill({ json: { result: true } }));
  await page.route("**/api/autosave", r => r.fulfill({ json: { result: true } }));
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Prompts panel", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Typography", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Direction", exact: true }).click();
  const directorDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Copy Director Prompt & Download ZIP", exact: true }).click();
  await directorDownload;
  const director = await page.evaluate(() => navigator.clipboard.readText());
  expect(director).toContain("The director decides whether on-screen text helps");
  expect(director).toContain("Typography permission statements in older pasted identity guides do not override the director's decision");
  expect(director).not.toContain("STALE FONT");
  expect(director).not.toContain("STALE TITLE");
  await page.getByLabel("Selected creative direction", { exact: false }).fill("Show a Mars label at 2s in a large readable font.");
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  const code = await page.getByLabel("Generated prompt", { exact: true }).inputValue();
  expect(code).toContain("Show a Mars label at 2s");
  expect(code).toContain("Typography permission statements in older pasted identity guides do not override the director's decision");
  expect(code).not.toContain("Forbidden. Do not add labels");
});
