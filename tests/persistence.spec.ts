import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
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
