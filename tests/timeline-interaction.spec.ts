import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { newProject, type Project } from "../shared/project";
import { initialWorkflow, totalDuration } from "../shared/workflow";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

function fixture(): Project {
  if (process.env.FRAMESCRIPT_TIMELINE_FIXTURE)
    return JSON.parse(
      readFileSync(process.env.FRAMESCRIPT_TIMELINE_FIXTURE, "utf8"),
    );
  const p = newProject();
  p.settings.duration = 6;
  p.workflow = initialWorkflow(p);
  p.workflow.scenes.push({
    ...p.workflow.scenes[0],
    id: "second",
    title: "A second scene with a long title",
    duration: 2,
  });
  const voice = clipFromAudio(synthesizeSound("Ambient loop"), "voice");
  voice.length = 4;
  p.audio = [voice];
  return p;
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: fixture() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { theme: "light" } } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Preview all timelines", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Timeline position" }),
  ).toBeVisible();
});

test("Ctrl+wheel zooms only over the timeline and keeps page zoom unchanged", async ({
  page,
}) => {
  const zoom = page.getByRole("slider", { name: "Timeline zoom" });
  const canvas = page.locator(".timeline-track-canvas");
  await canvas.hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await expect(zoom).toHaveValue("1.25");
  await page.mouse.wheel(0, 120);
  await expect(zoom).toHaveValue("1");
  await page.keyboard.up("Control");
  await page.mouse.wheel(0, -120);
  await expect(zoom).toHaveValue("1");
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
});

test("zoom buttons cover the wider range and the ruler keeps useful time labels", async ({ page }) => {
  const slider = page.getByRole("slider", { name: "Timeline zoom" });
  const zoomOut = page.getByRole("button", { name: "Zoom out timeline", exact: true });
  const zoomIn = page.getByRole("button", { name: "Zoom in timeline", exact: true });
  await zoomOut.click();
  await expect(slider).toHaveValue("0.75");
  await zoomOut.click();
  await zoomOut.click();
  await expect(slider).toHaveValue("0.25");
  await expect(zoomOut).toBeDisabled();
  await zoomIn.click();
  await expect(slider).toHaveValue("0.5");
  await slider.fill("24");
  await zoomIn.click();
  await expect(slider).toHaveValue("32");
  await expect(zoomIn).toBeDisabled();
  await expect(page.getByLabel("Timeline zoom level", { exact: true })).toHaveText("32×");
  const viewport = page.locator(".timeline-track-scroll");
  await viewport.evaluate((element) => { element.scrollLeft = 4000; });
  const ruler = page.locator(".ruler");
  await expect.poll(async () => Number((await ruler.locator("span").first().innerText()).replace("s", ""))).toBeGreaterThan(2);
  expect(await ruler.locator("span").count()).toBeLessThan(40);
  await page.screenshot({ path: "test-results/timeline-zoom-controls.png" });
});

test("the ruler has a fixed tail after the clips and scrolling does not grow it", async ({ page }) => {
  const viewport = page.locator(".timeline-track-scroll");
  const marks = page.locator(".ruler span");
  const lastTime = async () => Number((await marks.last().innerText()).replace("s", ""));
  await expect.poll(lastTime).toBeGreaterThan(totalDuration(fixture()));
  await expect(marks.filter({ hasText: /^10s$/ })).toBeInViewport();
  await viewport.evaluate((element) => { element.scrollLeft = element.scrollWidth - element.clientWidth; });
  await expect.poll(lastTime).toBe(30);
  const width = await viewport.evaluate((element) => element.scrollWidth);
  await viewport.evaluate((element) => { element.scrollLeft = element.scrollWidth - element.clientWidth; });
  await expect.poll(lastTime).toBe(30);
  expect(await viewport.evaluate((element) => element.scrollWidth)).toBe(width);
  await expect.poll(async () => {
    const ruler = (await page.locator(".timeline-ruler-marks").boundingBox())!;
    const bounds = (await viewport.boundingBox())!;
    return Math.abs(ruler.x + ruler.width - bounds.x - bounds.width);
  }).toBeLessThan(2);
  await expect(page.getByRole("slider", { name: "Timeline position" })).toHaveAttribute("max", "8");
});

test("playhead snapping aligns to audio edges and Alt bypasses it", async ({
  page,
}) => {
  const ruler = (await page.locator(".ruler").boundingBox())!;
  const duration = totalDuration(fixture());
  const edge = fixture().audio![0].start + fixture().audio![0].length;
  const x = ruler.x + (ruler.width * edge) / duration + 4;
  const position = page.getByRole("slider", { name: "Timeline position" });
  await page.mouse.move(x, ruler.y + 12);
  await page.mouse.down();
  await expect(page.locator(".timeline-snap-guide")).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(async () => Number(await position.inputValue()))
    .toBeCloseTo(edge, 3);
  await page.keyboard.down("Alt");
  await page.mouse.click(x, ruler.y + 12);
  await page.keyboard.up("Alt");
  await expect
    .poll(async () => {
      const box = (await page.locator(".timeline-cursor").boundingBox())!;
      return Math.abs(box.x + box.width / 2 - x);
    })
    .toBeLessThan(1);
  await page.getByRole("button", { name: "Timeline snapping" }).click();
  await page.mouse.click(x, ruler.y + 12);
  await expect
    .poll(async () => {
      const box = (await page.locator(".timeline-cursor").boundingBox())!;
      return Math.abs(box.x + box.width / 2 - x);
    })
    .toBeLessThan(1);
});

test("Space toggles transport without hijacking text inputs", async ({
  page,
}) => {
  await page.locator(".timeline").focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page
    .frameLocator('iframe[title="Animation preview"]')
    .locator("iframe")
    .first()
    .waitFor({ state: "attached" });
  await page
    .frameLocator('iframe[title="Animation preview"]')
    .locator("body")
    .click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Project name" }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});

test("audio movement snaps to the playhead, shows a guide, and can be disabled", async ({
  page,
}) => {
  const position = page.getByRole("slider", { name: "Timeline position" });
  const ruler = (await page.locator(".ruler").boundingBox())!;
  const duration = totalDuration(fixture());
  for (const enabled of [true, false]) {
    if (!enabled)
      await page.getByRole("button", { name: "Timeline snapping" }).click();
    await position.fill("2.3");
    const clip = (await page
      .locator(".audio-edit-clip")
      .first()
      .boundingBox())!;
    const x = clip.x + clip.width / 2,
      y = clip.y + clip.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + (2.33 / duration) * ruler.width, y, { steps: 8 });
    if (enabled)
      await expect(page.locator(".timeline-snap-guide")).toBeVisible();
    else await expect(page.locator(".timeline-snap-guide")).toHaveCount(0);
    await page.mouse.up();
    await expect
      .poll(async () =>
        Number(
          await page
            .getByLabel("Start (seconds)", { exact: true })
            .inputValue(),
        ),
      )
      .toBeCloseTo(enabled ? 2.3 : 2.33, 2);
    await expect(page.locator(".timeline-snap-guide")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Undo project change", exact: true })
      .click();
  }
});

test("ruler dragging continuously seeks rather than stopping at the initial click", async ({
  page,
}) => {
  const box = (await page.locator(".ruler").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.1, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + 12, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("slider", { name: "Timeline position" })
          .inputValue(),
      ),
    )
    .toBeCloseTo(totalDuration(fixture()) * 0.7, 1);
});

test("selected audio deletes with Delete or Backspace and Ctrl+Z restores it", async ({
  page,
}) => {
  const clip = page.locator(".audio-edit-clip").first();
  for (const key of ["Delete", "Backspace"]) {
    await clip.click();
    await page.keyboard.press(key);
    await expect(page.locator(".audio-edit-clip")).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
  }
});

test("Delete in a text field preserves clips and empty timeline clicks clear deletion selection", async ({
  page,
}) => {
  await page.locator(".audio-edit-clip").first().click();
  const field = page.getByLabel("Start (seconds)", { exact: true });
  await field.focus();
  await page.keyboard.press("Delete");
  await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
  const ruler = (await page.locator(".ruler").boundingBox())!;
  const canvas = (await page.locator(".timeline-track-canvas").boundingBox())!;
  await page.mouse.click(
    ruler.x + ruler.width * 0.7,
    canvas.y + canvas.height - 12,
  );
  await page.keyboard.press("Delete");
  await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
});

test("selected scenes delete and undo, and deleting the final visual leaves a blank editable scene", async ({
  page,
}) => {
  await page.locator(".master-scene-clip").last().click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".master-scene-clip")).toHaveCount(1);
  await page.keyboard.press("Control+z");
  await expect(page.locator(".master-scene-clip")).toHaveCount(2);
  await page.locator(".master-scene-clip").last().click();
  await page.keyboard.press("Backspace");
  await expect(page.locator(".master-scene-clip")).toHaveCount(1);
  await page.locator(".master-scene-clip").first().click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".master-scene-clip")).toHaveCount(1);
  await expect(page.locator(".master-scene-clip")).toContainText("Empty scene");
  await page.keyboard.press("Control+z");
  await expect(page.locator(".master-scene-clip")).not.toContainText(
    "Empty scene",
  );
});
test("a visual can be selected and deleted in scene editing mode", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Edit timeline", exact: true })
    .click();
  await page.locator(".track-clip").click();
  await page.keyboard.press("Delete");
  await page
    .getByRole("button", { name: "Preview all timelines", exact: true })
    .click();
  await expect(page.locator(".master-scene-clip")).toHaveCount(1);
});

test("empty timeline clicks seek, while dragging empty space draws a selection box", async ({
  page,
}) => {
  const ruler = (await page.locator(".ruler").boundingBox())!;
  const lane = (await page.locator(".audio-edit-track").first().boundingBox())!;
  const position = page.getByRole("slider", { name: "Timeline position" });
  await page.mouse.click(ruler.x + ruler.width * 0.8, lane.y + lane.height / 2);
  await expect
    .poll(async () => Number(await position.inputValue()))
    .toBeCloseTo(totalDuration(fixture()) * 0.8, 1);
  const canvas = (await page.locator(".timeline-track-canvas").boundingBox())!;
  await page.mouse.move(
    ruler.x + ruler.width * 0.2,
    canvas.y + canvas.height - 15,
  );
  await page.mouse.down();
  await page.mouse.move(
    ruler.x + ruler.width * 0.65,
    canvas.y + canvas.height - 15,
    { steps: 6 },
  );
  await expect(page.locator(".timeline-selection-box")).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(async () => Number(await position.inputValue()))
    .toBeCloseTo(totalDuration(fixture()) * 0.8, 1);
  await page.getByRole("slider", { name: "Timeline zoom" }).fill("4");
  await page.locator(".timeline-track-scroll").evaluate((el) => {
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  });
  const zoomed = (await page.locator(".ruler").boundingBox())!;
  const view = (await page.locator(".timeline-track-scroll").boundingBox())!;
  const x = view.x + view.width * 0.7;
  await page.mouse.click(x, canvas.y + canvas.height - 15);
  await expect
    .poll(async () => Number(await position.inputValue()))
    .toBeCloseTo(Math.max(0, Math.min(totalDuration(fixture()), (totalDuration(fixture()) * (x - zoomed.x)) / zoomed.width)), 1);
});

test("the playhead can be dragged directly without changing audio clips", async ({
  page,
}) => {
  const box = (await page.locator(".ruler").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + 12);
  const cursor = (await page.locator(".timeline-cursor").boundingBox())!;
  const audioBefore = await page
    .locator(".audio-edit-clip")
    .first()
    .getAttribute("style");
  await page.mouse.move(cursor.x + cursor.width / 2, cursor.y + 4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, cursor.y + 4, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("slider", { name: "Timeline position" })
          .inputValue(),
      ),
    )
    .toBeCloseTo(totalDuration(fixture()) * 0.6, 1);
  expect(
    await page.locator(".audio-edit-clip").first().getAttribute("style"),
  ).toBe(audioBefore);
});
test("lane labels remain visible when zoomed and horizontally scrolled", async ({
  page,
}) => {
  await page.getByRole("slider", { name: "Timeline zoom" }).fill("4");
  const scroller = page.locator(".timeline-track-scroll");
  await scroller.evaluate((el) => { el.scrollLeft = 24; });
  await expect.poll(() => scroller.evaluate((el) => el.style.getPropertyValue("--timeline-scroll-left"))).toBe("24px");
  const playhead = page.locator(".timeline-cursor");
  const clipped = await playhead.evaluate((element) => {
    const cursor = element.getBoundingClientRect();
    const viewport = element.closest(".timeline-track-scroll")!.getBoundingClientRect();
    const x = cursor.left + 6;
    return {
      inGutter: x > viewport.left && x < viewport.left + 96,
      cursorHit: document.elementFromPoint(x, cursor.top + 4) === element,
      rulerHit: !!document.elementFromPoint(x, cursor.top - 4)?.closest(".ruler"),
    };
  });
  expect(clipped).toEqual({ inGutter: true, cursorHit: false, rulerHit: false });
  await scroller.evaluate((el) => {
    el.scrollLeft = el.scrollWidth - el.clientWidth;
  });
  const viewport = (await page
    .locator(".timeline-track-scroll")
    .boundingBox())!;
  const label = (await page
    .locator(".audio-lane-label")
    .first()
    .boundingBox())!;
  expect(label.x).toBeGreaterThanOrEqual(viewport.x - 1);
});

test("zoom retains the playhead position in the visible viewport", async ({
  page,
}) => {
  const ruler = (await page.locator(".ruler").boundingBox())!;
  await page.mouse.click(ruler.x + ruler.width * 0.65, ruler.y + 12);
  const before = (await page.locator(".timeline-cursor").boundingBox())!;
  await page.getByRole("slider", { name: "Timeline zoom" }).fill("2");
  await expect
    .poll(async () => {
      const current = (await page.locator(".timeline-cursor").boundingBox())!;
      return Math.abs(current.x - before.x);
    })
    .toBeLessThan(2);
});

test("the visual can end while both narration clips keep playing on the timeline", async ({ page }) => {
  const project = newProject();
  project.workflow = initialWorkflow(project);
  const sceneId = project.workflow.selectedId;
  project.audio = [
    { ...clipFromAudio(synthesizeSound("Ambient loop"), "voice", sceneId), length: 2 },
    { ...clipFromAudio(synthesizeSound("Gentle pulse"), "voice", sceneId), start: 2, length: 3 },
  ];
  let saved: Project | undefined;
  await page.route("**/api/workspaceGet", (route) => route.fulfill({ json: { result: project } }));
  await page.route("**/api/autosave", (route) => {
    saved = route.request().postDataJSON().args[0];
    return route.fulfill({ json: { result: true } });
  });
  await page.reload();
  const ruler = (await page.locator(".ruler").boundingBox())!;
  const handle = (await page.getByRole("button", { name: "Trim end of visual clip", exact: true }).boundingBox())!;
  const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - ruler.width * 0.8, y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => saved?.settings.duration).toBe(5);
  expect(saved?.workflow?.scenes[0].visualDuration).toBe(2);
  expect(saved?.audio?.map(({ start, length }) => [start, length])).toEqual([[0, 2], [2, 3]]);
  await expect(page.locator(".audio-edit-clip")).toHaveCount(2);
  const position = page.getByRole("slider", { name: "Timeline position" });
  const visual = page.frameLocator('iframe[title="Animation preview"]').locator("#ball");
  await position.fill("3");
  await expect(visual).toBeHidden();
  await position.fill("1");
  await expect(visual).toBeVisible();
});

test("appending overlapping audio grows the timeline, joins its row and undoes as one edit", async ({ page }) => {
  const project = newProject();
  project.settings.duration = 6;
  project.workflow = initialWorkflow(project);
  const scene = project.workflow.scenes[0];
  const recording = clipFromAudio(synthesizeSound("Ambient loop"), "voice", scene.id);
  project.audio = [
    { ...recording, id: "first", name: "First recording", start: 0, length: 6 },
    { ...recording, id: "second", name: "Append recording", start: 2, length: 4 },
  ];
  let saved: Project | undefined;
  await page.route("**/api/workspaceGet", (route) => route.fulfill({ json: { result: project } }));
  await page.route("**/api/autosave", (route) => {
    saved = route.request().postDataJSON().args[0];
    return route.fulfill({ json: { result: true } });
  });
  await page.reload();
  await expect(page.locator(".audio-edit-row")).toHaveCount(2);
  const move = page.getByRole("button", { name: "Move Append recording", exact: true });
  const track = (await page.locator(".audio-edit-track").last().boundingBox())!;
  const box = (await move.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 30 + track.width * 4 / 6 - 2, box.y + box.height / 2, { steps: 8 });
  await expect(page.locator(".timeline-snap-guide")).toBeVisible();
  await page.mouse.up();
  await expect.poll(() => saved?.audio?.find((clip) => clip.id === "second")?.start).toBe(6);
  await expect(page.locator(".audio-edit-row")).toHaveCount(1);
  expect(saved!.settings.duration).toBe(10);
  expect(saved!.workflow!.scenes[0].visualDuration).toBe(6);
  expect(saved!.audio![0].start).toBe(0);
  expect(saved!.audio![1].length).toBe(4);
  await page.getByRole("button", { name: "Undo project change", exact: true }).click();
  await expect(page.locator(".audio-edit-row")).toHaveCount(2);
  await expect.poll(() => saved?.settings.duration).toBe(6);
  await move.click();
  await page.getByLabel("Start (seconds)", { exact: true }).fill("6");
  await expect(page.locator(".audio-edit-row")).toHaveCount(1);
  await expect.poll(() => saved?.settings.duration).toBe(10);
});

test("audio dragging and trimming apply the change and undo restores it", async ({
  page,
}) => {
  const clip = fixture().audio!.find((clip) => !clip.muted)!;
  const track = (await page
    .locator(".audio-edit-track")
    .first()
    .boundingBox())!;
  const button = page.getByRole("button", {
    name: `Move ${clip.name}`,
    exact: true,
  });
  const box = (await button.boundingBox())!;
  const delta = track.width * 0.04;
  await page.mouse.move(box.x + box.width * 0.5, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 + delta, box.y + 20, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await page.getByLabel("Start (seconds)", { exact: true }).inputValue(),
      ),
    )
    .toBeCloseTo(clip.start + totalDuration(fixture()) * 0.04, 1);
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect(page.getByLabel("Start (seconds)", { exact: true })).toHaveValue(
    String(clip.start),
  );
  const trim = page.getByRole("button", {
    name: `Trim end of ${clip.name}`,
    exact: true,
  });
  const handle = (await trim.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 20);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - delta, handle.y + 20, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await page.getByLabel("Length (seconds)", { exact: true }).inputValue(),
      ),
    )
    .toBeCloseTo(clip.length - totalDuration(fixture()) * 0.04, 1);
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect(
    page.getByLabel("Length (seconds)", { exact: true }),
  ).toHaveValue(String(clip.length));
});

test("saved wide panels fit the viewport and timeline is usable in both themes", async ({
  page,
}) => {
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({
      json: {
        result: {
          leftWidth: 560,
          rightWidth: 592.222,
          timelineHeight: 366.667,
          layoutVersion: 2,
          leftView: "sound",
          theme: "light",
        },
      },
    }),
  );
  await page.reload();
  await expect
    .poll(async () => {
      const rect = (await page.locator(".assistant-panel").boundingBox())!;
      return rect.x + rect.width;
    })
    .toBeLessThanOrEqual(1280);
  const player = (await page.locator(".center").boundingBox())!;
  expect(player.width).toBeGreaterThanOrEqual(249);
  await page.screenshot({
    path: "test-results/timeline-review/fixed-light.png",
  });
  await page
    .getByRole("button", { name: "Switch to dark theme", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/timeline-review/fixed-dark.png",
  });
});
