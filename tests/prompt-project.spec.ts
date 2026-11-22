import { test, expect } from "@playwright/test";
import { newProject, projectSchema } from "../shared/project";

test("prompt drafts save with their project and do not leak into new projects", async ({ page }) => {
  let workspace = newProject();
  let saved = workspace;
  await page.route("**/api/workspaceGet", route => route.fulfill({ json: { result: workspace } }));
  await page.route("**/api/settingsGet", route => route.fulfill({ json: { result: {} } }));
  await page.route("**/api/autosave", route => {
    saved = projectSchema.parse(route.request().postDataJSON().args[0]);
    return route.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.evaluate(() => localStorage.setItem("framescript.prompt-draft.v1", JSON.stringify({
    identityGuide: "Old global identity", selectedDirection: "Old global direction",
  })));
  await page.reload();
  await page.getByRole("button", { name: "Prompts panel", exact: true }).click();
  await page.getByRole("tab", { name: "Identity", exact: true }).click();
  const identity = page.getByLabel("Video theme & visual identity guide");
  await expect(identity).toHaveValue("");
  await identity.fill("Project A identity");
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  const direction = page.getByLabel("Selected creative direction", { exact: false });
  await direction.fill("Project A direction");
  await expect.poll(() => saved.promptDraft?.selectedDirection).toBe("Project A direction");
  const projectA = projectSchema.parse(JSON.parse(JSON.stringify(saved)));
  workspace = newProject();
  await page.reload();
  await page.getByRole("button", { name: "Prompts panel", exact: true }).click();
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  await expect(direction).toHaveValue("");
  await page.getByRole("tab", { name: "Identity", exact: true }).click();
  await expect(identity).toHaveValue("");
  workspace = projectA;
  await page.reload();
  await page.getByRole("button", { name: "Prompts panel", exact: true }).click();
  await page.getByRole("tab", { name: "Identity", exact: true }).click();
  await expect(identity).toHaveValue("Project A identity");
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  await expect(direction).toHaveValue("Project A direction");
});
