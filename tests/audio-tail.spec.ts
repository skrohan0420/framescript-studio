import { expect, test } from "@playwright/test";
import { newProject, type Project } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";
import { audioDragType } from "../shared/audio-library";

test("audio can be stretched and added at the end, leaving a blank visual gap", async ({
  page,
}) => {
  const project = newProject();
  project.settings.duration = 2;
  project.html = '<div id="visual">Two seconds of video</div>';
  project.js = "window.renderFrame=()=>{};";
  project.workflow = initialWorkflow(project);
  const source = {
    ...clipFromAudio(synthesizeSound("Ambient loop"), "voice"),
    id: "recording",
    name: "Long recording",
  };
  project.audioLibrary = [source];
  project.audio = [
    {
      ...source,
      id: "trimmed",
      sourceId: source.id,
      sceneId: project.workflow.selectedId,
      start: 1,
      length: 1,
    },
  ];
  let saved: Project | undefined;
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/autosave", (route) => {
    saved = route.request().postDataJSON().args[0];
    return route.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  const trim = page.getByRole("button", {
    name: "Trim end of Long recording",
    exact: true,
  });
  await trim.focus();
  await trim.press("Shift+ArrowRight");
  await expect.poll(() => saved?.settings.duration).toBe(3);
  expect(saved!.workflow!.scenes[0].visualDuration).toBe(2);
  expect(saved!.audio![0].length).toBe(2);
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect.poll(() => saved?.settings.duration).toBe(2);
  await page
    .getByRole("slider", { name: "Timeline position", exact: true })
    .fill("2");
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Add Long recording to timeline",
      exact: true,
    })
    .click();
  await expect.poll(() => saved?.audio?.length).toBe(2);
  expect(saved!.settings.duration).toBe(10);
  expect(saved!.audio![1]).toMatchObject({ start: 2, length: 8 });
  expect(saved!.workflow!.scenes[0]).toMatchObject({
    duration: 10,
    visualDuration: 2,
  });
  const position = page.getByRole("slider", {
    name: "Timeline position",
    exact: true,
  });
  await position.fill("3");
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("html")).toHaveAttribute(
    "data-fs-visual-gap",
    "",
  );
  await expect(preview.locator("#visual")).toBeHidden();
  await position.fill("1");
  await expect(preview.locator("#visual")).toBeVisible();
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect.poll(() => saved?.settings.duration).toBe(2);
  expect(saved!.audio).toHaveLength(1);
  const transfer = await page.evaluateHandle(
    ({ type, id }) => {
      const data = new DataTransfer();
      data.setData(type, id);
      return data;
    },
    { type: audioDragType, id: source.id },
  );
  const ruler = (await page.locator(".ruler").boundingBox())!;
  await page
    .locator(".audio-edit-track")
    .first()
    .dispatchEvent("drop", {
      dataTransfer: transfer,
      clientX: ruler.x + ruler.width,
    });
  await expect.poll(() => saved?.audio?.length).toBe(2);
  expect(saved!.audio![1]).toMatchObject({ start: 2, length: 8 });
  expect(saved!.settings.duration).toBe(10);
  expect(saved!.workflow!.scenes[0].visualDuration).toBe(2);
  await transfer.dispose();
});
