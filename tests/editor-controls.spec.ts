import { test, expect } from "@playwright/test";
import { newProject, type Project } from "../shared/project";
import { textTemplates } from "../shared/typography";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

test("ruler preference survives refresh and disabled rulers leave no canvas border", async ({
  page,
}) => {
  await open(page, newProject());
  const toggle = page.getByRole("button", {
    name: "Show preview rulers",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(page.locator(".canvas-wrap")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(page.locator(".canvas-wrap")).toHaveCSS(
    "border-left-width",
    "0px",
  );
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByLabel("Horizontal pixel ruler")).toHaveCount(0);
  await expect(page.locator(".canvas-wrap")).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Horizontal pixel ruler")).toBeVisible();
});
test("fullscreen preview retains playback, seeking, speed and exit controls", async ({
  page,
}) => {
  await open(page, newProject());
  await expect(
    page.locator(".center > .transport .transport-preview-controls"),
  ).toBeVisible();
  await expect(page.locator(".preview-area .preview-ruler-toggle")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Full screen preview", exact: true })
    .click();
  const fullscreen = page.locator(".preview-shell:fullscreen");
  await expect(fullscreen).toBeVisible();
  await expect(
    fullscreen.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await fullscreen
    .getByRole("slider", { name: "Fullscreen playback position" })
    .fill("3");
  await expect(fullscreen.locator(".transport code")).toContainText("3.00");
  await expect(
    fullscreen.getByRole("combobox", { name: "Film speed" }),
  ).toBeVisible();
  await fullscreen
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(page.locator(".preview-shell:fullscreen")).toHaveCount(0);
});
async function open(page: import("@playwright/test").Page, project: Project) {
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
}
test("live text editing, snapping, split and delete work from preview and timeline", async ({
  page,
}) => {
  const project = newProject();
  const layer = {
    id: "text-test",
    text: "Editable title",
    template: textTemplates[0],
    x: 50,
    y: 50,
    width: 80,
    size: 70,
    color: "white",
    font: "Arial",
    align: "center",
    start: 0,
    end: 8,
    entrance: 0.5,
  };
  project.html = `<div id="text-test" data-fs-text="${JSON.stringify(layer).replaceAll('"', "&quot;")}"><span>Editable title</span></div>`;
  project.css = "";
  project.js = "window.renderFrame=()=>{}";
  await open(page, project);
  const frame = page.frameLocator('iframe[title="Animation preview"]');
  await page
    .getByRole("slider", { name: "Timeline position", exact: true })
    .fill("2");
  await expect(frame.locator("[data-fs-text] > span")).toHaveCSS(
    "opacity",
    "1",
  );
  await frame.locator("[data-fs-text] > span").dblclick();
  await page
    .getByLabel("Edit text on canvas", { exact: true })
    .fill("From the screen");
  await expect(
    page.getByRole("button", {
      name: "Move text From the screen",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finish editing text" }).click();
  await page
    .getByRole("button", { name: "Move text From the screen", exact: true })
    .dblclick();
  await page
    .getByLabel("Edit text on canvas", { exact: true })
    .fill("From the timeline");
  await page.getByRole("button", { name: "Finish editing text" }).click();
  await expect(frame.locator("[data-fs-text] > span")).toHaveText(
    "From the timeline",
  );
  await expect(page.getByLabel("Horizontal pixel ruler")).toBeVisible();
  await page
    .getByRole("button", { name: "Show preview rulers", exact: true })
    .click();
  await expect(page.getByLabel("Horizontal pixel ruler")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show preview rulers", exact: true })
    .click();
  await expect(page.getByLabel("Horizontal pixel ruler")).toBeVisible();
  const overlay = frame.locator("[data-fs-text]");
  const box = (await overlay.locator("span").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 3, {
    steps: 3,
  });
  await expect(frame.locator("[data-fs-guide]").first()).toBeVisible();
  await page.mouse.up();
  await expect
    .poll(
      async () => JSON.parse((await overlay.getAttribute("data-fs-text"))!).x,
    )
    .toBe(50);
  await page.getByRole("region", { name: "Timeline", exact: true }).focus();
  await page.keyboard.press("w");
  await expect(frame.locator("[data-fs-text]")).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(frame.locator("[data-fs-text]")).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Text timeline" })
      .locator(".text-timeline-clip"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect(frame.locator("[data-fs-text]")).toHaveCount(2);
});
test("templates drag onto the timeline at the dropped time", async ({
  page,
}) => {
  await open(page, newProject());
  await page
    .getByRole("button", { name: "Typography panel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use Rise up text template", exact: true })
    .dragTo(page.locator(".timeline-track-canvas"), {
      targetPosition: { x: 176, y: 90 },
    });
  const layer = page
    .frameLocator('iframe[title="Animation preview"]')
    .locator("[data-fs-text]");
  await expect(layer).toHaveCount(1);
  const data = JSON.parse((await layer.getAttribute("data-fs-text"))!);
  expect(data.start).toBeCloseTo(2, 0);
  expect(data.end - data.start).toBeCloseTo(3, 1);
});
test("audio mutes from row and clip; W splits selected audio", async ({
  page,
}) => {
  const project = newProject();
  const audio = clipFromAudio(synthesizeSound("Success chime"), "voice");
  project.audio = [audio];
  await open(page, project);
  await page.getByRole("button", { name: /^Mute voice row/ }).click();
  await expect(
    page.getByRole("button", {
      name: `Unmute audio ${audio.name}`,
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: `Unmute audio ${audio.name}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Mute audio ${audio.name}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: `Move ${audio.name}`, exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Timeline position", exact: true })
    .fill(String(audio.length / 2));
  await page.getByRole("region", { name: "Timeline", exact: true }).focus();
  await page.keyboard.press("w");
  await expect(page.locator(".audio-edit-clip")).toHaveCount(2);
  await expect(page.locator(".audio-edit-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const library = page.getByRole("region", {
    name: "Audio library",
    exact: true,
  });
  await expect(library.locator(".audio-library-tile")).toHaveCount(1);
  await page.getByRole("region", { name: "Timeline", exact: true }).focus();
  await page.keyboard.press("Delete");
  await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
  await page
    .getByRole("button", { name: `Move ${audio.name}`, exact: true })
    .click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".audio-edit-clip")).toHaveCount(0);
  await expect(library.locator(".audio-library-tile")).toHaveCount(1);
  await library
    .getByRole("button", { name: `Inspect ${audio.name}`, exact: true })
    .dragTo(page.locator(".timeline-track-canvas"), {
      targetPosition: { x: 176, y: 90 },
    });
  await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
  await expect(library.locator(".audio-library-tile")).toHaveCount(1);
  const clipBounds = (await page.locator(".audio-edit-clip").boundingBox())!;
  const rulerBounds = (await page.locator(".ruler").boundingBox())!;
  expect(((clipBounds.x - rulerBounds.x) / rulerBounds.width) * 10).toBeCloseTo(
    2,
    0,
  );
});
test("transcripts offer plain text and real timed SRT downloads", async ({
  page,
}) => {
  const project = newProject();
  project.audio = [
    {
      ...clipFromAudio(synthesizeSound("Success chime"), "voice"),
      transcript: "Hello world.",
      transcriptWords: [
        { text: "Hello", start: 0.1, end: 0.4 },
        { text: "world.", start: 0.5, end: 0.9 },
      ],
    },
  ];
  await open(page, project);
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  await page.getByRole("button", { name: "Transcript", exact: true }).click();
  const text = page.getByLabel(`Transcript of ${project.audio[0].name}`);
  await expect(text).toHaveValue("Hello world.");
  await page
    .getByRole("button", { name: "Timed text · SRT", exact: true })
    .click();
  await expect(text).toHaveValue(
    "1\n00:00:00,100 --> 00:00:00,900\nHello world.\n",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download .srt", exact: true })
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.srt$/);
});
