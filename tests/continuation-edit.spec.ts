import { expect, test, type Page } from "@playwright/test";
import { newProject, type Project } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

async function open(page: Page, autosave = true, locked = false) {
  const project = newProject();
  project.settings.duration = 8;
  project.html = '<div id="original">Original source</div>';
  project.css = "body{color:white}";
  project.js = "window.renderFrame=()=>{};";
  project.workflow = initialWorkflow(project);
  const scene = project.workflow.scenes[0];
  scene.locked = locked;
  scene.visualDuration = 2;
  scene.visualContinuations = ["one", "two"].map((name, index) => ({
    id: crypto.randomUUID(),
    start: 2 + index * 3,
    duration: 3,
    html: `<div id="${name}">${name}</div>`,
    css: "body{color:cyan}",
    js: `window.renderFrame=t=>document.querySelector('#${name}').textContent=t.toFixed(2);`,
  }));
  project.audio = [
    {
      ...clipFromAudio(synthesizeSound("Ambient loop"), "voice", scene.id),
      length: 8,
    },
  ];
  const saves: Project[] = [];
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: { autosave } } }),
  );
  await page.route("**/api/settingsSet", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  for (const endpoint of ["autosave", "projectSave"])
    await page.route(`**/api/${endpoint}`, (route) => {
      saves.push(route.request().postDataJSON().args[0]);
      return route.fulfill({
        json: { result: endpoint === "projectSave" ? "saved.frame" : true },
      });
    });
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Continuation 1", exact: true })
    .click();
  return {
    project,
    saves,
    scene,
    picker: page.getByRole("combobox", { name: "Source code clip" }),
    panel: page.locator(".code-workbench"),
  };
}

async function replaceCode(page: Page, text: string) {
  await page.locator(".code-workbench .monaco-editor textarea").first().focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(text);
}

test("continuations edit independently in separate and combined editors with switching, persistence and Undo", async ({
  page,
}) => {
  const { project, saves, scene, picker, panel } = await open(page);
  const first = scene.visualContinuations![0].id;
  await panel.getByRole("button", { name: "HTML", exact: true }).click();
  await replaceCode(page, '<div id="one">Edited one</div>');
  await expect
    .poll(() => saves.at(-1)?.workflow?.scenes[0].visualContinuations?.[0].html)
    .toContain("Edited one");
  await panel.getByRole("button", { name: "CSS", exact: true }).click();
  await replaceCode(page, "body{color:magenta}");
  await panel.getByRole("button", { name: "JavaScript", exact: true }).click();
  await replaceCode(
    page,
    "window.renderFrame=t=>document.querySelector('#one').textContent='edited '+t.toFixed(2);",
  );
  await panel.getByRole("button", { name: "ALL", exact: true }).click();
  await expect(panel.locator(".view-lines")).toContainText("magenta");
  await replaceCode(
    page,
    '<!doctype html><html><head><style>body{color:gold}</style></head><body><div id="one">Combined one</div><script>window.renderFrame=()=>{};</script></body></html>',
  );
  await expect
    .poll(() => saves.at(-1)?.workflow?.scenes[0].visualContinuations?.[0].css)
    .toBe("body{color:gold}");
  await picker.selectOption(scene.visualContinuations![1].id);
  await expect(panel.locator(".view-lines")).toContainText('id="two"');
  await picker.selectOption("");
  await expect(panel.locator(".view-lines")).toContainText("Original source");
  await picker.selectOption(first);
  await expect(panel.locator(".view-lines")).toContainText("Combined one");
  await expect.poll(() => saves.at(-1)?.html).toBe(project.html);
  expect(saves.at(-1)!.workflow!.scenes[0].visualContinuations![1]).toEqual(
    scene.visualContinuations![1],
  );
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect(panel.locator(".view-lines")).toContainText("magenta");
});

test("invalid combined continuation drafts stay with their clip", async ({
  page,
}) => {
  const { scene, picker, panel } = await open(page);
  await panel.getByRole("button", { name: "ALL", exact: true }).click();
  await replaceCode(
    page,
    '<html><head><script src="unavailable.js"></script></head><body>Draft one</body></html>',
  );
  await expect(panel.locator(".inline-error")).toBeVisible();
  await picker.selectOption(scene.visualContinuations![1].id);
  await expect(panel.locator(".inline-error")).toHaveCount(0);
  await expect(panel.locator(".view-lines")).toContainText('id="two"');
  await picker.selectOption(scene.visualContinuations![0].id);
  await expect(panel.locator(".view-lines")).toContainText("Draft one");
  await panel.getByRole("button", { name: "Discard combined edits" }).click();
  await expect(panel.locator(".inline-error")).toHaveCount(0);
  await expect(panel.locator(".view-lines")).toContainText('id="one"');
});

test("continuation edits follow manual Save before appearing in preview", async ({
  page,
}) => {
  const { panel, saves } = await open(page, false);
  await page.getByRole("slider", { name: "Timeline position" }).fill("2.5");
  const frame = page
    .frameLocator('iframe[title="Animation preview"]')
    .frameLocator('iframe[title="Visual continuation"]')
    .nth(0)
    .locator("#one");
  await expect(frame).toHaveText("0.50");
  await panel.getByRole("button", { name: "JavaScript", exact: true }).click();
  await replaceCode(
    page,
    "window.renderFrame=t=>document.querySelector('#one').textContent='saved '+t.toFixed(2);",
  );
  await expect(panel.locator(".unsaved-code-badge")).toBeVisible();
  await expect(frame).toHaveText("0.50");
  await page.keyboard.press("Control+s");
  await expect(frame).toHaveText("saved 0.50");
  expect(
    saves.at(-1)!.workflow!.scenes[0].visualContinuations![0].js,
  ).toContain("saved");
});

test("continuation edge handles resize joins, extend the timeline, preserve audio and support Undo", async ({
  page,
}) => {
  const { panel, saves, project } = await open(page);
  await page.getByRole("button", { name: "Timeline snapping" }).click();
  const handle = page.getByRole("button", {
    name: "Resize visual segment 1",
    exact: true,
  });
  const box = (await handle.boundingBox())!;
  const ruler = (await page.locator(".ruler").boundingBox())!;
  await page.mouse.move(box.x + 3, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 3 + ruler.width / 8, box.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(
      () => saves.at(-1)?.workflow?.scenes[0].visualContinuations?.[0].duration,
    )
    .toBeCloseTo(4, 2);
  expect(
    saves.at(-1)!.workflow!.scenes[0].visualContinuations![1].start,
  ).toBeCloseTo(6, 2);
  expect(saves.at(-1)!.settings.duration).toBeCloseTo(9, 2);
  await page.getByRole("slider", { name: "Timeline position" }).fill("6.5");
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')
      .frameLocator('iframe[title="Visual continuation"]')
      .nth(1)
      .locator("#two"),
  ).toHaveText("0.50");
  expect(saves.at(-1)!.audio).toEqual(
    project.audio!.map((clip) => ({ ...clip, sourceId: clip.id })),
  );
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect.poll(() => saves.at(-1)?.settings.duration).toBe(8);
  await handle.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  await expect
    .poll(
      () => saves.at(-1)?.workflow?.scenes[0].visualContinuations?.[0].duration,
    )
    .toBe(2);
  expect(saves.at(-1)!.workflow!.scenes[0].visualContinuations![1].start).toBe(
    4,
  );
  await expect(
    panel.getByText("Continuation source is read only."),
  ).toHaveCount(0);
});

test("locked timelines keep continuation code and duration protected", async ({
  page,
}) => {
  const { panel } = await open(page, true, true);
  await expect(
    page.getByRole("button", { name: "Resize visual segment 1" }),
  ).toHaveCount(0);
  await expect(panel).toContainText("This timeline is locked");
});
