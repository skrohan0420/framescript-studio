import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";
test("generated scene code creates real BGM and SFX audio tracks with undo", async ({
  page,
}) => {
  let saved: any;
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (route) => {
    saved = route.request().postDataJSON().args[0];
    return route.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "BGM", exact: true }).check();
  await page.getByRole("checkbox", { name: "SFX", exact: true }).check();
  const tracks = [
    {
      id: "bed",
      name: "Generated bed",
      lane: "music",
      start: 0,
      length: 10,
      duration: 1,
      loop: true,
      volume: 0.3,
      notes: [{ at: 0, duration: 0.9, frequency: 220, gain: 0.2 }],
    },
    {
      id: "hit",
      name: "Generated accent",
      lane: "sfx",
      start: 2,
      length: 0.4,
      duration: 0.4,
      loop: false,
      volume: 0.7,
      notes: [
        { at: 0, duration: 0.35, frequency: 500, endFrequency: 100, gain: 0.4 },
      ],
    },
  ];
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Paste full HTML document", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Paste full HTML document",
    exact: true,
  });
  await dialog
    .locator("textarea")
    .fill(
      `<html><body><div>Scene</div><script type="application/json" id="framescript-audio">${JSON.stringify({ tracks })}</script><script>window.renderFrame=()=>{};</script></body></html>`,
    );
  await dialog.getByRole("button", { name: "Apply pasted document" }).click();
  await expect(page.locator(".audio-edit-clip")).toHaveCount(2);
  await expect.poll(() => saved?.audio?.length).toBe(2);
  expect(saved.audio[0]).toMatchObject({
    lane: "music",
    name: "Generated bed",
    start: 0,
    length: 10,
    loop: true,
    sceneId: saved.workflow.selectedId,
  });
  expect(saved.audio[1]).toMatchObject({
    lane: "sfx",
    name: "Generated accent",
    start: 2,
    loop: false,
    sceneId: saved.workflow.selectedId,
  });
  const audible = await page.evaluate(
    async (data: string[]) => {
      const context = new AudioContext();
      try {
        return await Promise.all(
          data.map(async (value) => {
            const bytes = Uint8Array.from(
              atob(value.split(",")[1]),
              (character) => character.charCodeAt(0),
            );
            const decoded = await context.decodeAudioData(bytes.buffer);
            return (
              decoded.duration > 0 &&
              decoded
                .getChannelData(0)
                .some((sample) => Math.abs(sample) > 0.001)
            );
          }),
        );
      } finally {
        await context.close();
      }
    },
    saved.audio.map((clip: any) => clip.data),
  );
  expect(audible).toEqual([true, true]);
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect(page.locator(".audio-edit-clip")).toHaveCount(0);
});
test("timed voiceover fills the prompt with scene-aligned cues", async ({
  page,
  context,
}) => {
  const project = newProject();
  project.audio = [
    {
      ...clipFromAudio(synthesizeSound("Success chime"), "voice"),
      duration: 5,
      start: 2,
      trimIn: 1,
      length: 3,
      transcript: "Explosion.",
      transcriptWords: [{ text: "Explosion.", start: 1.2, end: 1.8 }],
    },
  ];
  project.audio.push({
    ...project.audio[0],
    id: "second-timed-voice",
    start: 6,
    transcript: "Again.",
    transcriptWords: [{ text: "Again.", start: 1.2, end: 1.8 }],
  });
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
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use timed voiceover", exact: true })
    .click();
  await expect(page.getByLabel("Prompt script", { exact: true })).toHaveValue(
    "Explosion. Again.",
  );
  await page
    .getByLabel("Timed voiceover source")
    .selectOption(project.audio[0].id);
  await page
    .getByRole("button", { name: "Use timed voiceover", exact: true })
    .click();
  await expect(page.getByLabel("Prompt script", { exact: true })).toHaveValue(
    "Explosion.",
  );
  await expect(page.getByLabel("Timed narration", { exact: true })).toHaveValue(
    "1\n00:00:02,200 --> 00:00:02,800\nExplosion.\n",
  );
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("00:00:02,200 --> 00:00:02,800");
  expect(copied).toContain("timing authority");
});

test("prompt templates build, copy and preserve a brief without an AI connection", async ({
  page,
  context,
}) => {
  const project = newProject();
  project.audio = [clipFromAudio(synthesizeSound("Success chime"), "voice")];
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
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Prompt templates" });
  const duration = panel.getByLabel("Prompt duration (seconds)");
  await duration.fill("");
  await expect(duration).toHaveValue("");
  await duration.pressSequentially("9.5");
  await duration.press("Enter");
  await expect(duration).toHaveValue("9.5");
  await panel
    .getByLabel("Prompt script", { exact: true })
    .fill("Zoom into the Milky Way.");
  await panel
    .getByLabel("Visual style", { exact: true })
    .fill("Ink blue and warm gold");
  await panel.getByRole("button", { name: "Use narration duration" }).click();
  await expect(panel.getByLabel("Prompt duration (seconds)")).toHaveValue(
    "1.2",
  );
  await panel
    .getByRole("button", {
      name: "Use Perspective / parallax template",
      exact: true,
    })
    .click();
  await panel.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("Prompt copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Zoom into the Milky Way.");
  expect(copied).toContain("Ink blue and warm gold");
  expect(copied).toContain("Duration: 1.2 seconds");
  expect(copied).toContain("window.renderFrame");
  expect(copied).toContain("preserve-3d");
  await panel.locator("summary").filter({ hasText: "Output settings" }).click();
  await panel.getByLabel("Prompt output format").selectOption("separate");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await expect(panel.getByLabel("Prompt script", { exact: true })).toHaveValue(
    "Zoom into the Milky Way.",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await panel.locator("summary").filter({ hasText: "Output settings" }).click();
  await expect(panel.getByLabel("Prompt output format")).toHaveValue(
    "separate",
  );
  await panel
    .getByRole("button", {
      name: "Use Repair existing code template",
      exact: true,
    })
    .click();
  await expect(
    panel.getByRole("checkbox", {
      name: "Include active timeline code for repair or adaptation",
    }),
  ).toBeChecked();
  await panel.getByText("Preview generated prompt", { exact: true }).click();
  await expect(panel.getByLabel("Generated prompt")).toContainText(
    "EXISTING CODE TO REPAIR",
  );
  await panel.locator(".prompt-form-scroll").evaluate((element) => {
    element.scrollTop = 0;
  });
  const footer = (await panel.locator(".prompt-actions").boundingBox())!;
  const body = (await panel.locator(".prompt-form-scroll").boundingBox())!;
  expect(footer.y).toBeGreaterThanOrEqual(body.y + body.height - 1);
  await expect(
    panel.getByRole("button", { name: "Copy prompt", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/prompt-templates.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    panel.getByRole("button", { name: "Copy prompt", exact: true }),
  ).toBeInViewport();
  expect(
    await panel
      .locator(".prompt-form-scroll")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Switch to light theme", exact: true })
    .click();
  await page.screenshot({ path: "test-results/prompt-builder-light.png" });
  await panel.getByRole("button", { name: "Paste GPT response" }).click();
  await expect(
    page.getByRole("dialog", { name: "Paste full HTML document", exact: true }),
  ).toBeVisible();
});
