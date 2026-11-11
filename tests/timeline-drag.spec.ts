import { expect, test, type Page } from "@playwright/test";
import { newProject, type Project } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

async function openTimeline(page: Page, duration = 20) {
  const project = newProject();
  project.settings.duration = duration;
  project.workflow = initialWorkflow(project);
  const clip = clipFromAudio(
    synthesizeSound("Ambient loop"),
    "voice",
    project.workflow.selectedId,
  );
  project.audio = [
    { ...clip, id: "first", name: "First", start: 0, length: 5 },
    { ...clip, id: "moving", name: "Moving", start: 2, length: 4 },
  ];
  const saved: Project[] = [];
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/autosave", (route) => {
    saved.push(route.request().postDataJSON().args[0]);
    return route.fulfill({ json: { result: true } });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#editor");
  const move = page.getByRole("button", { name: "Move Moving", exact: true });
  await expect(move).toBeVisible();
  return { saved, move };
}

test("audio follows the pointer with stable rows, ignores click jitter and cancels with Escape", async ({
  page,
}) => {
  const { saved, move } = await openTimeline(page);
  await page.getByRole("button", { name: "Timeline snapping" }).click();
  const box = (await move.boundingBox())!;
  const source = page.locator('[data-timeline-id="moving"]');
  const original = (await source.boundingBox())!;
  const x = box.x + 30,
    y = box.y + 20;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 1, y + 1);
  await expect(page.locator(".audio-drag-preview")).toHaveCount(0);
  await page.mouse.move(x + 40, y - 20, { steps: 8 });
  const ghost = page.locator(".audio-drag-preview");
  await expect(ghost).toBeVisible();
  await expect
    .poll(async () =>
      Math.abs((await ghost.boundingBox())!.x - original.x - 40),
    )
    .toBeLessThan(1);
  await expect
    .poll(async () =>
      Math.abs((await ghost.boundingBox())!.y - original.y + 20),
    )
    .toBeLessThan(1);
  await expect(page.locator(".audio-edit-row")).toHaveCount(2);
  expect((await source.boundingBox())!.x).toBeCloseTo(original.x, 0);
  await page.screenshot({ path: "test-results/audio-drag-preview.png" });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(ghost).toHaveCount(0);
  await expect(page.locator(".audio-drop-preview")).toHaveCount(0);
  await expect(page.getByLabel("Start (seconds)", { exact: true })).toHaveValue(
    "2",
  );
  expect(
    saved.at(-1)?.audio?.find((clip) => clip.id === "moving")?.start ?? 2,
  ).toBe(2);
});

test("edge scrolling keeps a stationary drag anchored and drops at the preview time", async ({
  page,
}) => {
  const { saved, move } = await openTimeline(page);
  await page.getByRole("button", { name: "Timeline snapping" }).click();
  await page.getByRole("slider", { name: "Timeline zoom" }).fill("2");
  const viewport = page.locator(".timeline-track-scroll");
  const bounds = (await viewport.boundingBox())!;
  const box = (await move.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 14, box.y + 20, { steps: 8 });
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(60);
  const initialScroll = await viewport.evaluate(
    (element) => element.scrollLeft,
  );
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(initialScroll + 50);
  // Move away from the edge to stop scrolling before inspecting the drop time.
  await page.mouse.move(bounds.x + bounds.width / 2, box.y + 20);
  const previewTime = page.locator(".audio-drag-preview small");
  await expect(previewTime).toBeVisible();
  const beforeWheel = Number((await previewTime.innerText()).replace("s", ""));
  await viewport.evaluate((element) => {
    element.scrollLeft += 80;
  });
  await expect
    .poll(async () => Number((await previewTime.innerText()).replace("s", "")))
    .toBeGreaterThan(beforeWheel + 0.8);
  const expected = Number((await previewTime.innerText()).replace("s", ""));
  await page.mouse.up();
  await expect(page.locator(".audio-drag-preview")).toHaveCount(0);
  await expect
    .poll(
      () => saved.at(-1)?.audio?.find((clip) => clip.id === "moving")?.start,
    )
    .toBeCloseTo(expected, 1);
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect
    .poll(
      () => saved.at(-1)?.audio?.find((clip) => clip.id === "moving")?.start,
    )
    .toBe(2);
});

test("snapping holds through small pointer movements and Alt releases it immediately", async ({
  page,
}) => {
  const { move } = await openTimeline(page);
  const track = (await page.locator(".audio-edit-track").last().boundingBox())!;
  const box = (await move.boundingBox())!;
  const x = box.x + 30,
    y = box.y + 20;
  const snapX = x + (3 / 20) * track.width;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(snapX + 3, y, { steps: 8 });
  const time = page.locator(".audio-drag-preview small");
  await expect(time).toHaveText("5.00s");
  await page.mouse.move(snapX + 10, y);
  await expect(time).toHaveText("5.00s");
  await page.keyboard.down("Alt");
  await expect
    .poll(async () => Number((await time.innerText()).replace("s", "")))
    .toBeGreaterThan(5.1);
  await page.keyboard.up("Alt");
  await page.keyboard.press("Escape");
  await page.mouse.up();
});

test("dragging beyond the end adds scroll space and expands the timeline on drop", async ({
  page,
}) => {
  const { saved, move } = await openTimeline(page);
  await page.getByRole("button", { name: "Timeline snapping" }).click();
  const viewport = page.locator(".timeline-track-scroll");
  const originalPadding = await viewport.evaluate(
    (element) => element.style.paddingRight,
  );
  const maximum = await viewport.evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  const bounds = (await viewport.boundingBox())!;
  const box = (await move.boundingBox())!;
  const clipLeft = await move.evaluate(
    (element) =>
      element.closest(".audio-edit-clip")!.getBoundingClientRect().left,
  );
  const grabOffset = box.x + 30 - clipLeft;
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 20);
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
  });
  await page.mouse.move(bounds.x + bounds.width - 14, box.y + 20);
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(maximum + 40);
  await page.mouse.move(bounds.x + bounds.width / 2, box.y + 20);
  const time = page.locator(".audio-drag-preview small");
  await expect(time).toBeVisible();
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator(".audio-drag-preview").boundingBox())!.x -
          (bounds.x + bounds.width / 2 - grabOffset),
      ),
    )
    .toBeLessThan(1);
  const expected = Number((await time.innerText()).replace("s", ""));
  expect(expected + 4).toBeGreaterThan(20);
  await page.mouse.up();
  await expect
    .poll(() => saved.at(-1)?.settings.duration)
    .toBeCloseTo(expected + 4, 1);
  expect(saved.at(-1)!.workflow!.scenes[0].visualDuration).toBe(20);
  await expect
    .poll(() => viewport.evaluate((element) => element.style.paddingRight))
    .toBe(originalPadding);
});
