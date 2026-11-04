import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";

test("an unavailable editor bundle leaves the preview and workspace usable", async ({
  page,
}) => {
  const project = newProject();
  project.html = '<h1 id="available">Preview remains available</h1>';
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { leftView: "code", layoutVersion: 2 } } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/*CodeEditor*", (r) => r.abort("failed"));
  await page.goto("/#editor");
  await expect(
    page.getByRole("button", {
      name: "Reload workspace to retry",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Workspace error", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')
      .locator("#available"),
  ).toHaveText("Preview remains available");
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill("Still editable");
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue("Still editable");
});
test("reload restores manual code, project name and legacy narration", async ({
  page,
}) => {
  const p = newProject();
  p.workflow = initialWorkflow(p);
  p.workflow.scenes[0].narration = "Preserve imported narration.";
  await page.route(
    "**/api/workspaceGet",
    (r) => r.fulfill({ json: { result: p } }),
    { times: 1 },
  );
  await page.goto("/#editor");
  const name = "Persistent workspace " + Date.now();
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Code editor options" }).click();
  await page
    .getByRole("button", { name: "Paste full HTML document", exact: true })
    .click();
  const paste = page.getByRole("dialog", {
    name: "Paste full HTML document",
    exact: true,
  });
  await paste
    .getByLabel("HTML document to import")
    .fill('<h1 id="persisted">Persistent code</h1>');
  await paste.getByRole("button", { name: "Apply pasted document" }).click();
  const load = async () =>
    (
      await (
        await page.request.post("/api/workspaceGet", {
          headers: { "X-FrameScript": "1" },
          data: { args: [] },
        })
      ).json()
    ).result;
  await expect
    .poll(async () => {
      const saved = await load();
      return [saved?.name, saved?.html, saved?.workflow?.scenes[0]?.narration];
    })
    .toEqual([
      name,
      '<h1 id="persisted">Persistent code</h1>',
      "Preserve imported narration.",
    ]);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(name);
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')
      .locator("#persisted"),
  ).toHaveText("Persistent code");
  expect((await load()).workflow.scenes[0].narration).toBe(
    "Preserve imported narration.",
  );
});
