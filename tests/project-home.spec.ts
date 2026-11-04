import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
test("manual save records code versions that can be restored", async ({
  page,
}) => {
  await page.goto("/#editor");
  await expect(
    page.getByRole("textbox", { name: "Project name" }),
  ).toBeVisible();
  const setup = await page.request.post("/api/projectSave", {
    headers: { "X-FrameScript": "1" },
    data: { args: [newProject(), { create: true }] },
  });
  expect(setup.ok()).toBe(true);
  await page.reload();
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  const settings = page.getByRole("dialog");
  const settingSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settingsSet") &&
      response.request().postData()?.includes('"autosave":false') === true,
  );
  await settings.getByLabel("Workspace save mode").selectOption("manual");
  await settingSaved;
  await settings.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  const panel = page.locator(".code-workbench");
  await panel.getByRole("button", { name: "JavaScript", exact: true }).click();
  const editor = panel.locator(".monaco-editor");
  const replaceCode = async (value: string) => {
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText(value);
  };
  const save = async (shortcut = false) => {
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/projectSave") && response.ok(),
    );
    if (shortcut) await page.keyboard.press("Control+s");
    else
      await page
        .getByRole("button", { name: "Save (Ctrl+S)", exact: true })
        .click();
    await saved;
    await expect(page.getByLabel("Workspace save status")).toHaveText(
      "Manual save",
    );
  };
  const firstCode =
    'const savedVersion = 1; document.body.dataset.applied = "first";';
  let downloads = 0;
  page.on("download", () => downloads++);
  await replaceCode(firstCode);
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("#ball")).toBeVisible();
  await expect(preview.locator("body")).not.toHaveAttribute(
    "data-applied",
    "first",
  );
  await save(true);
  await expect(preview.locator("body")).toHaveAttribute(
    "data-applied",
    "first",
  );
  await replaceCode("const savedVersion = 3;");
  await expect(page.getByLabel("Workspace save status")).toContainText(
    "Unsaved changes",
  );
  await expect(panel.getByText("Unsaved code", { exact: true })).toBeVisible();
  await expect(editor.locator(".code-gutter-modified").first()).toBeVisible();
  const workspace = await page.request.post("/api/workspaceGet", {
    headers: { "X-FrameScript": "1" },
    data: { args: [] },
  });
  expect((await workspace.json()).result.js).toBe(firstCode);
  await expect(preview.locator("body")).toHaveAttribute(
    "data-applied",
    "first",
  );
  const changes = panel.getByRole("button", { name: "Show code changes" });
  const options = panel.getByRole("button", { name: "Code editor options" });
  await options.click();
  await changes.click();
  const diff = panel.locator(".monaco-diff-editor");
  await expect(diff.locator(".line-delete.view-lines")).toContainText(
    "const savedVersion = 1;",
  );
  await expect(diff.locator(".line-insert").first()).toBeVisible();
  await diff
    .locator(".editor.modified .view-lines")
    .filter({ hasText: "const savedVersion = 3;" })
    .first()
    .click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("const savedVersion = 2;");
  await options.click();
  await changes.click();
  await expect(editor.locator(".view-lines")).toContainText(
    "const savedVersion = 2;",
  );
  await save();
  await expect(preview.locator("body")).not.toHaveAttribute(
    "data-applied",
    "first",
  );
  expect(downloads).toBe(0);
  await expect(panel.getByText("Unsaved code", { exact: true })).toHaveCount(0);
  await expect(editor.locator(".code-gutter-modified")).toHaveCount(0);
  await options.click();
  await panel
    .getByRole("button", { name: "Code history", exact: true })
    .click();
  const history = page.getByRole("dialog", { name: "Code history" });
  await history.getByLabel("Preview language").selectOption("js");
  await expect(history.locator("pre")).toHaveText("const savedVersion = 2;");
  await history.getByLabel("Saved version").selectOption({ index: 1 });
  await expect(history.locator("pre")).toHaveText(firstCode);
  await history.getByRole("button", { name: "Restore code" }).click();
  await expect(editor.locator(".view-lines")).toContainText(
    "const savedVersion = 1;",
  );
  await expect(page.getByLabel("Workspace save status")).toContainText(
    "Unsaved changes",
  );
  await panel
    .getByRole("button", { name: "Expand editor", exact: true })
    .click();
  const saveMode = panel.getByLabel("Workspace save mode");
  await expect(saveMode).toHaveValue("manual");
  const autosaved = page.waitForResponse(
    (response) => response.url().endsWith("/api/autosave") && response.ok(),
  );
  const modeSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settingsSet") &&
      response.request().postData()?.includes('"autosave":true') === true,
  );
  await saveMode.selectOption("auto");
  await Promise.all([autosaved, modeSaved]);
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
  await options.click();
  await panel
    .getByRole("button", { name: "Code history", exact: true })
    .click();
  await expect(
    history.getByLabel("Saved version").locator("option").first(),
  ).toContainText("Autosave");
  await page.reload();
  await expect(editor.locator(".code-gutter-modified").first()).toBeVisible();
  await options.click();
  await changes.click();
  await expect(diff.locator(".line-delete.view-lines")).toContainText(
    "const savedVersion = 2;",
  );
  await expect(diff.locator(".line-insert").first()).toBeVisible();
});
test("home creates, saves, renames, duplicates, restores and permanently deletes projects", async ({
  page,
}) => {
  const name = "Orbit " + Date.now();
  await page.goto("/");
  await expect(page).toHaveTitle("Projects · FrameScript Studio");
  const favicon = await page.request.get("/favicon.svg");
  expect(favicon.ok()).toBe(true);
  expect(favicon.headers()["content-type"]).toContain("image/svg+xml");
  await expect(
    page.getByRole("heading", { name: "Let’s make something move." }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Create project A blank canvas for your next idea",
    })
    .click();
  const create = page.getByRole("dialog", {
    name: "Create project",
    exact: true,
  });
  await create.getByLabel("New project name").fill(name);
  await create
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(name);
  await expect(page).toHaveTitle(`${name} · FrameScript Studio`);
  await page.getByRole("button", { name: "Project home", exact: true }).click();
  await expect(page).toHaveTitle("Projects · FrameScript Studio");
  await expect(
    page.getByRole("button", { name: `Open ${name}`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Rename ${name}`, exact: true })
    .click();
  const rename = page.getByRole("dialog", {
    name: "Rename project",
    exact: true,
  });
  await rename.getByLabel("Project title").fill(name + " updated");
  await rename.getByRole("button", { name: "Save name", exact: true }).click();
  await page
    .getByRole("button", { name: `Duplicate ${name} updated`, exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Open ${name} updated copy`,
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: `Move ${name} updated to trash`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Open ${name} updated`, exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: `Move ${name} updated copy to trash`,
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  const deleteCopy = page.getByRole("button", {
    name: `Delete ${name} updated copy forever`,
    exact: true,
  });
  await deleteCopy.click();
  const confirmDelete = page.getByRole("alertdialog", {
    name: "Delete project forever?",
  });
  await expect(confirmDelete).toContainText(`${name} updated copy`);
  const cancelDelete = confirmDelete.getByRole("button", { name: "Cancel" });
  await expect(cancelDelete).toBeFocused();
  await cancelDelete.click();
  await expect(deleteCopy).toBeFocused();
  await deleteCopy.click();
  await confirmDelete.getByRole("button", { name: "Delete forever" }).click();
  await expect(deleteCopy).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Restore ${name} updated`, exact: true }),
  ).toBeVisible();
  await expect(deleteCopy).toHaveCount(0);
  await page
    .getByRole("button", { name: `Restore ${name} updated`, exact: true })
    .click();
  await page.getByRole("button", { name: "All projects", exact: true }).click();
  await page
    .getByRole("button", { name: `Open ${name} updated`, exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(name + " updated");
});
test("home presents a searchable grid and list layout", async ({ page }) => {
  const names = [
    "Stellar origins",
    "A journey through space",
    "The smallest things",
    "Motion study 04",
    "Solar currents",
    "Beyond the visible",
    "A new perspective",
    "Particles in motion",
  ];
  await page.route("**/api/projectList", (route) =>
    route.fulfill({
      json: {
        result: names.map((name, index) => ({
          id: index + ".frame",
          name,
          updated: Date.now() - index * 86400000,
          duration: 20 + index * 5,
          width: 3840,
          height: 2160,
          scenes: index + 1,
        })),
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".home-project-card")).toHaveCount(8);
  await page.screenshot({ path: "test-results/project-home.png" });
  await page.getByLabel("Search projects").fill("Stellar");
  await expect(page.locator(".home-project-card")).toHaveCount(1);
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.locator(".home-project-grid")).toHaveClass(/list/);
});
