import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (route) =>
    route.fulfill({ json: { result: true } }),
  );
});

test("manual startup opens the code editor and preview", async ({ page }) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.goto("/#editor");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#ball"),
  ).toBeVisible();
});

test("recovery restores a replaced workspace and two editing tabs cannot silently overwrite each other", async ({
  page,
  context,
}) => {
  await page.goto("/#editor");
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toBeVisible();
  const first = "Recovery original " + Date.now();
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill(first);
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue("Untitled animation");
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Recovery history", exact: true })
    .click();
  const recovery = page.getByRole("dialog", {
    name: "Recovery history",
    exact: true,
  });
  await recovery
    .locator("article")
    .filter({ hasText: first })
    .first()
    .getByRole("button", { name: "Restore version" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(first);
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
  const second = await context.newPage();
  await second.goto("/#editor");
  await expect(
    second.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(first);
  await expect(second.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
  // The second tab's startup autosave establishes a newer workspace version.
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill("Preserve this tab");
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace save failed",
  );
  await expect(
    page.getByRole("button", { name: "Download this workspace", exact: true }),
  ).toBeVisible();
  await second.reload();
  await expect(
    second.getByRole("textbox", { name: "Project name", exact: true }),
  ).toHaveValue(first);
  await second.close();
});

test("production workspace exposes waveform trim controls and brand kit persists", async ({
  page,
}) => {
  const project = newProject();
  project.workflow = initialWorkflow(project);
  const clip = clipFromAudio(
    synthesizeSound("Success chime"),
    "voice",
    project.workflow.selectedId,
  );
  clip.name = "Production narration";
  project.audio = [clip];
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Media panel", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Audio timeline" }),
  ).toBeVisible();
  const move = page.getByRole("button", {
    name: "Move Production narration",
    exact: true,
  });
  await move.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("status").filter({ hasText: "starts at 0.10s" }),
  ).toBeAttached();
  const track = page.locator(".audio-edit-track").first(),
    box = await track.boundingBox();
  const trim = page.getByRole("button", {
    name: "Trim end of Production narration",
    exact: true,
  });
  const handle = await trim.boundingBox();
  expect(box).toBeTruthy();
  expect(handle).toBeTruthy();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle!.x + handle!.width / 2 - box!.width * 0.02,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.up();
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Brand name", { exact: true })
    .fill("FrameScript brand");
  await page.getByLabel("Brand primary", { exact: true }).fill("#336699");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
  await page.unroute("**/api/workspaceGet");
  const saved = await page.evaluate(
    async () =>
      (
        await (
          await fetch("/api/workspaceGet", {
            method: "POST",
            headers: {
              "X-FrameScript": "1",
              "Content-Type": "application/json",
            },
            body: '{"args":[]}',
          })
        ).json()
      ).result,
  );
  expect(saved.brand.primary).toBe("#336699");
  expect(saved.audio[0].start).toBeCloseTo(0.1);
  expect(saved.audio[0].length).toBeLessThan(clip.length);
  await page.screenshot({ path: "test-results/production-improvements.png" });
});

test("Save completion leaves edits made during its request dirty", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/projectSave", async (r) => {
    await response;
    await r.fulfill({ json: { result: "Submitted.frame" } });
  });
  await page.goto("/#editor");
  const title = page.getByRole("textbox", {
    name: "Project name",
    exact: true,
  });
  await title.fill("Submitted revision");
  const request = page.waitForRequest("**/api/projectSave");
  await page
    .getByRole("button", { name: "Save (Ctrl+S)", exact: true })
    .click();
  await request;
  await title.fill("Newer edit while saving");
  release();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Code saved and applied locally" }),
  ).toBeVisible();
  await expect(page.locator(".dirty")).toHaveText("●");
});
