import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { encodeAudioSamples } from "../shared/audio";
import { clipFromAudio } from "../src/audio";

test("silence cleanup updates audio and words together and can be undone", async ({
  page,
}) => {
  const p = newProject();
  p.workflow = initialWorkflow(p);
  const samples = new Float32Array(44100);
  for (let i = 0; i < samples.length; i++)
    if ((i >= 8820 && i < 17640) || (i >= 26460 && i < 35280))
      samples[i] = Math.sin(i * 0.1) * 0.3;
  const clip = {
    ...clipFromAudio(
      { name: "Narration.wav", ...encodeAudioSamples(samples), duration: 2 },
      "voice",
      p.workflow.selectedId,
    ),
    transcript: "Hello world.",
    start: 1,
    trimIn: 0.2,
    length: 1.8,
    transcriptWords: [
      { text: "Hello", start: 0.4, end: 0.8 },
      { text: "world.", start: 1.2, end: 1.6 },
    ],
  };
  p.audio = [clip];
  let saved: any;
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: p } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) => {
    saved = r.request().postDataJSON().args[0];
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const card = page.locator(".audio-cleanup").first();
  await card.getByRole("button", { name: "Edit audio", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit audio", exact: true });
  const track = await editor
    .getByRole("group", { name: "Audio selection timeline" })
    .boundingBox();
  await page.mouse.move(track!.x + track!.width * 0.02, track!.y + 70);
  await page.mouse.down();
  await page.mouse.move(track!.x + track!.width * 0.15, track!.y + 70, {
    steps: 8,
  });
  await page.mouse.up();
  await editor
    .getByRole("button", { name: "Cut selection", exact: true })
    .click();
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(1);
  await editor.getByRole("button", { name: "Undo cut", exact: true }).click();
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(0);
  await editor.getByRole("button", { name: "Redo cut", exact: true }).click();
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(1);
  await editor
    .getByRole("button", { name: "Auto remove silence", exact: true })
    .click();
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(3);
  await expect(editor.getByLabel("Audio edit preview")).toBeVisible();
  await expect
    .poll(() =>
      editor
        .getByLabel("Audio edit preview")
        .evaluate((element: HTMLAudioElement) => element.duration),
    )
    .toBeCloseTo(1.12, 2);
  expect(
    await editor
      .getByLabel("Audio edit preview")
      .evaluate(async (element: HTMLAudioElement) => {
        await element.play();
        const playing = !element.paused;
        element.pause();
        return playing;
      }),
  ).toBe(true);
  await page.screenshot({ path: "test-results/silence-modal.png" });
  await editor.getByRole("button", { name: "Save audio", exact: true }).click();
  await expect.poll(() => saved?.audio?.[0]?.duration).toBeLessThan(1.3);
  expect(saved.audio[0].transcriptWords[0].start).toBeCloseTo(0.08, 2);
  expect(saved.audio[0].transcriptWords[1].start).toBeCloseTo(0.64, 2);
  expect(saved.audio[0].start).toBe(1);
  expect(saved.audio[0].trimIn).toBe(0);
  expect(saved.audioLibrary.length).toBe(2);
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use timed voiceover", exact: true })
    .click();
  await expect(page.getByLabel("Prompt script", { exact: true })).toHaveValue(
    /00:00:01,080/,
  );
  await page
    .getByRole("button", { name: "Close prompt builder", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Undo audio edit", exact: true })
    .click();
  await expect.poll(() => saved?.audio?.[0]?.duration).toBe(2);
  expect(saved.audio[0].transcriptWords[1].start).toBe(1.2);
  await card
    .getByRole("button", { name: "Redo audio edit", exact: true })
    .click();
  await expect.poll(() => saved?.audio?.[0]?.duration).toBeLessThan(1.3);
  await card
    .getByRole("button", { name: "Undo audio edit", exact: true })
    .click();
  await expect.poll(() => saved?.audio?.[0]?.duration).toBe(2);
  await card
    .getByRole("button", { name: "Auto remove silence", exact: true })
    .click();
  await expect.poll(() => saved?.audio?.[0]?.duration).toBeLessThan(1.3);
});

test("cut editor preserves playback, restores cuts, guards cancellation and saves the selected range directly", async ({
  page,
}) => {
  const project = newProject();
  project.workflow = initialWorkflow(project);
  const samples = new Float32Array(44100);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i * 0.1) * 0.3;
  project.audio = [
    clipFromAudio(
      { name: "Continuous.wav", ...encodeAudioSamples(samples), duration: 2 },
      "voice",
      project.workflow.selectedId,
    ),
  ];
  let saved: any;
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) => {
    saved = r.request().postDataJSON().args[0];
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const open = async () =>
    page
      .locator(".audio-cleanup")
      .first()
      .getByRole("button", { name: "Edit audio", exact: true })
      .click();
  await open();
  const editor = page.getByRole("dialog", { name: "Edit audio", exact: true });
  const player = editor.getByLabel("Audio edit preview");
  const selection = async (start: string, end: string) => {
    await editor.getByLabel("Selection start", { exact: true }).fill(start);
    await editor.getByLabel("Selection end", { exact: true }).fill(end);
  };
  await expect
    .poll(() => player.evaluate((el: HTMLAudioElement) => el.duration))
    .toBe(2);
  await selection("0.2", "0.3");
  await editor
    .getByRole("button", { name: "Hear selection", exact: true })
    .click();
  await expect
    .poll(() => player.evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(true);
  expect(
    await player.evaluate((el: HTMLAudioElement) => el.currentTime),
  ).toBeLessThanOrEqual(0.32);
  await player.evaluate((el: HTMLAudioElement) => {
    el.currentTime = 1.2;
  });
  await selection("0.2", "0.5");
  await editor.getByRole("group", { name: "Audio selection timeline" }).focus();
  await page.keyboard.press("Delete");
  await expect(
    editor.getByRole("button", { name: "Restore cut 1", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => player.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeCloseTo(0.9, 2);
  await editor
    .getByRole("button", { name: "Auto remove silence", exact: true })
    .click();
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(1);
  await editor
    .getByRole("button", { name: "Restore cut 1", exact: true })
    .click();
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(editor.locator(".audio-cut-deleted")).toHaveCount(0);
  await selection("0.2", "0.5");
  await editor.getByRole("button", { name: "Cut & save", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect.poll(() => saved?.audio?.[0]?.duration).toBeCloseTo(1.7, 2);
  await open();
  await expect
    .poll(() => player.evaluate((el: HTMLAudioElement) => el.duration))
    .toBeCloseTo(1.7, 2);
  await selection("0.1", "0.2");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Keep editing", exact: true }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await editor
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(editor).toBeHidden();
  expect(saved.audio[0].duration).toBeCloseTo(1.7, 2);
  await open();
  await selection("0", "1.7");
  await editor.getByRole("button", { name: "Cut & save", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("Keep at least");
  await selection("0.1", "0.2");
  await editor
    .getByRole("checkbox", {
      name: "Update audio in this timeline",
      exact: true,
    })
    .uncheck();
  await editor.getByRole("button", { name: "Cut & save", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect
    .poll(() => saved?.audioLibrary?.[0]?.duration)
    .toBeCloseTo(1.6, 2);
  expect(saved.audio[0].duration).toBeCloseTo(1.7, 2);
});
