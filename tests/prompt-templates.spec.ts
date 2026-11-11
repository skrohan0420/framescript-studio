import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

function readZipText(zip: Buffer, path: string) {
  const end = zip.lastIndexOf(Buffer.from("504b0506", "hex"));
  let entry = zip.readUInt32LE(end + 16);
  while (entry < end) {
    const nameLength = zip.readUInt16LE(entry + 28);
    const name = zip.toString("utf8", entry + 46, entry + 46 + nameLength);
    if (name === path) {
      const local = zip.readUInt32LE(entry + 42);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const compressed = zip.subarray(start, start + zip.readUInt32LE(entry + 20));
      return inflateRawSync(compressed).toString("utf8");
    }
    entry += 46 + nameLength + zip.readUInt16LE(entry + 30) + zip.readUInt16LE(entry + 32);
  }
  throw Error(`${path} is missing from the generated ZIP.`);
}
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
  await page.getByRole("tab", { name: "Audio", exact: true }).click();
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
  await page.getByRole("button", { name: "Code editor options" }).click();
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
    /Explosion\.[\s\S]*Again\./,
  );
  await page
    .getByLabel("Timed voiceover source")
    .selectOption(project.audio[0].id);
  await page
    .getByRole("button", { name: "Use timed voiceover", exact: true })
    .click();
  await expect(page.getByLabel("Prompt script", { exact: true })).toHaveValue(
    "1\n00:00:02,200 --> 00:00:02,800\nExplosion.\n",
  );
  const copy = async () => {
    const status = page.locator(".status-bar .status-notice");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Copy and Download", exact: true }).click();
    await download;
    await expect(status).toHaveText("Prompt copied and ZIP download started.");
  };
  await copy();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("00:00:02,200 --> 00:00:02,800");
  expect(copied).toContain("timing authority");
  const input = page.getByLabel("Prompt script", { exact: true });
  await input.fill("WEBVTT\n\n00:01.000 --> 00:03.000\nA timed idea.");
  await expect(page.locator(".prompt-input-format")).toContainText(
    "VTT · timing detected",
  );
  await copy();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "00:01.000 --> 00:03.000",
  );
  await input.fill("A replacement plain script.");
  await page
    .getByRole("button", { name: "Hook & reveal", exact: true })
    .click();
  await expect(input).toHaveValue("A replacement plain script.");
  await expect(
    page.getByRole("button", { name: "Hook & reveal", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".prompt-input-format")).toContainText(
    "Plain text",
  );
  await copy();
  expect(
    await page.evaluate(() => navigator.clipboard.readText()),
  ).not.toContain("TIMED NARRATION — SCENE-LOCAL SECONDS");
  const timedInput =
    "1\n00:00:01,000 --> 00:00:02,000\nKeep these exact words.";
  await input.fill(timedInput);
  await page.getByRole("button", { name: "Product demo", exact: true }).click();
  await expect(input).toHaveValue(timedInput);
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
  const tabs = panel.getByRole("tablist", { name: "Prompt sections" });
  const select = async (name: string) =>
    tabs.getByRole("tab", { name, exact: true }).click();
  await select("Audio");
  await expect(panel.getByLabel("Music style", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Music style", { exact: true })).toBeDisabled();
  await panel.getByRole("group", { name: "Audio presets" }).getByRole("button", { name: "Cinematic reveal", exact: true }).click();
  await panel.getByLabel("Custom audio instructions").fill("Quiet space ambience with one soft impact.");
  await panel.getByLabel("Music tempo", { exact: true }).selectOption("Medium");
  await panel.getByText("Advanced music", { exact: true }).click();
  await panel.getByLabel("Music volume", { exact: true }).fill("0.18");
  await panel.getByLabel("Music fade in", { exact: true }).fill("1.2");
  await panel.getByLabel("Music fade out", { exact: true }).fill("1.5");
  await panel.getByLabel("Music-specific instructions").fill("Soft keys and a low pulse.");
  await panel.getByText("Advanced effects", { exact: true }).click();
  await panel.getByLabel("Effect volume", { exact: true }).fill("0.45");
  await panel.getByLabel("Effect-specific instructions").fill("A single impact at the reveal.");
  await page.screenshot({ path: "test-results/prompt-audio-desktop.png" });
  const audioViewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 850 });
  expect(await panel.locator(".prompt-audio-studio").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: "test-results/prompt-audio-mobile.png" });
  await page.setViewportSize(audioViewport);
  await select("Brief");
  await select("Audio");
  await expect(panel.getByLabel("Music tempo", { exact: true })).toHaveValue("Medium");
  await expect(panel.getByLabel("Custom audio instructions")).toHaveValue("Quiet space ambience with one soft impact.");
  await select("Visuals");
  await expect(panel.getByLabel("Prompt script", { exact: true })).toBeHidden();
  await expect(panel.getByRole("tabpanel")).toHaveCount(1);
  await select("Reference look");
  await panel.getByRole("radio", { name: /^Kurzgesagt-inspired/ }).click();
  await select("Editing & pacing");
  await panel.getByRole("radio", { name: /^Match-cut montage/ }).click();
  await select("Visuals");
  await panel
    .getByLabel("Visual style", { exact: true })
    .fill("Ink blue and warm gold");
  await select("Identity");
  await panel
    .getByLabel("Character / subject identity", { exact: true })
    .fill("A small robot with one blue eye");
  await select("Animation");
  await panel.getByLabel("Rendering mode", { exact: true }).selectOption("2.5d");
  await panel.getByRole("button", { name: "Camera movement", exact: true }).click();
  await select("Mascot");
  await panel.getByLabel("Include mascot in prompt", { exact: true }).check();
  await panel.getByLabel("Mascot name (optional)", { exact: true }).fill("Orbit the guide");
  await select("Details");
  await panel.getByLabel("Additional requirements", { exact: true }).fill("Hold the final pose.");
  await select("Typography");
  await panel
    .getByLabel("Include typography in prompt", { exact: true })
    .check();
  await panel
    .getByLabel("Exact on-screen text (optional)", { exact: true })
    .fill("THE MILKY WAY");
  await panel
    .getByLabel("Subtitles", { exact: true })
    .selectOption("Phrase subtitles");
  await panel
    .getByLabel("Text animation", { exact: true })
    .selectOption("Word reveal");
  await panel.getByLabel("Title size (px)", { exact: true }).fill("");
  await panel
    .getByLabel("Title size (px)", { exact: true })
    .pressSequentially("96");
  await panel.getByLabel("Subtitle size (px)", { exact: true }).fill("44");
  await panel
    .getByLabel("Title placement", { exact: true })
    .selectOption("Top left");
  await panel.getByLabel("Text color", { exact: true }).fill("#ffeedd");
  await panel
    .getByLabel("Entrance time (seconds)", { exact: true })
    .fill("0.6");
  await expect(panel.getByTestId("typography-title-preview")).toHaveCSS(
    "font-size",
    "96px",
  );
  await expect(panel.getByTestId("typography-title-preview")).toHaveCSS(
    "color",
    "rgb(255, 238, 221)",
  );
  await panel
    .getByRole("button", { name: "Replay typography preview", exact: true })
    .click();
  await expect(panel.locator(".type-preview-word").last()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({ path: "test-results/typography-studio.png" });
  await select("Brief");
  const duration = panel.getByLabel("Prompt duration (seconds)");
  await duration.fill("");
  await expect(duration).toHaveValue("");
  await duration.pressSequentially("9.5");
  await duration.press("Enter");
  await panel
    .getByLabel("Prompt script", { exact: true })
    .fill("Zoom into the Milky Way.");
  await panel.getByRole("button", { name: "Use narration duration" }).click();
  await expect(duration).toHaveValue("1.2");
  await panel
    .getByRole("button", {
      name: "Use Perspective / parallax template",
      exact: true,
    })
    .click();
  await select("Output");
  await expect(panel.getByLabel("Output format")).toHaveValue("document");
  await panel.getByLabel("Reference images and example code").setInputFiles({
    name: "motion-reference.js",
    mimeType: "text/javascript",
    buffer: Buffer.from("// Example motion"),
  });
  await expect(panel).toContainText("motion-reference.js");
  await expect(panel.locator(".prompt-actions button")).toHaveCount(1);
  const preview = await panel.getByLabel("Generated prompt").inputValue();
  expect(preview).toContain("Music style: Cinematic");
  expect(preview).toContain("Tempo: Medium");
  expect(preview).toContain("Risers, Impacts");
  expect(preview).toContain("Quiet space ambience with one soft impact.");
  expect(preview).toContain("Music track volume: 0.18. Fade in: 1.2s. Fade out: 1.5s.");
  expect(preview).toContain("Sound effect track volume: 0.45.");
  expect(preview).toContain("Soft keys and a low pulse.");
  expect(preview).toContain("A single impact at the reveal.");
  const copyButton = panel.getByRole("button", { name: "Copy and Download", exact: true });
  const idleSize = await copyButton.boundingBox();
  let releasePackage!: () => void;
  const packageReady = new Promise<void>((resolve) => { releasePackage = resolve; });
  await page.route("**/api/codeGeneratePackage", async (route) => {
    await packageReady;
    await route.continue();
  }, { times: 1 });
  const download = page.waitForEvent("download");
  try {
    await copyButton.click();
    await expect(copyButton).toHaveAttribute("aria-busy", "true");
    await expect(copyButton).toBeDisabled();
    await expect(page.locator(".status-bar .status-activity")).toContainText("Preparing prompt package");
    const busySize = await copyButton.boundingBox();
    expect(busySize?.width).toBe(idleSize?.width);
    expect(busySize?.height).toBe(idleSize?.height);
  } finally {
    releasePackage();
  }
  await expect(page.locator(".status-bar .status-notice")).toContainText("Prompt copied");
  await expect(panel).not.toContainText("Prompt copied");
  await expect(page.getByRole("dialog", { name: "Import generated scene" })).toHaveCount(0);
  const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  expect(copied).toBe(preview);
  const taskZip = await readFile(await (await download).path());
  expect(readZipText(taskZip, "TASK.md")).toBe(copied);
  expect(readZipText(taskZip, "references/example-code/1.txt")).toBe("// Example motion");
  expect(JSON.parse(readZipText(taskZip, "manifest.json"))).toMatchObject({
    mode: "generate-code",
    format: "document",
  });
  for (const value of [
    "Zoom into the Milky Way.",
    "Ink blue and warm gold",
    "Duration: 1.2 seconds",
    "perspective and parallax",
    "RENDERING: 2.5D",
    "Camera movement",
    "Orbit the guide",
    "Hold the final pose.",
    "references/example-code/1.txt (motion-reference.js)",
    "Return exactly ONE complete HTML document",
    "window.renderFrame",
    "A small robot with one blue eye",
    "CONTINUITY LOCK",
    "Kurzgesagt-inspired",
    "Match-cut montage",
    "THE MILKY WAY",
    "Phrase subtitles",
    "Word reveal",
    "Title / label font size: 96px; subtitle font size: 44px",
    "Title placement: Top left",
    "Text entrance duration: 0.6 seconds",
  ])
    expect(copied).toContain(value);
  await select("Output");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await expect(
    tabs.getByRole("tab", { name: "Output", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await expect(
    tabs.getByRole("tab", { name: "Output", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(panel.getByLabel("Output format")).toHaveValue("document");
  await select("Typography");
  await expect(panel.getByLabel("Subtitles", { exact: true })).toHaveValue(
    "Phrase subtitles",
  );
  await expect(
    panel.getByLabel("Title size (px)", { exact: true }),
  ).toHaveValue("96");
  await select("Brief");
  await panel
    .getByRole("button", {
      name: "Use Repair existing code template",
      exact: true,
    })
    .click();
  await select("Output");
  await expect(
    panel.getByRole("checkbox", {
      name: "Include active timeline code as a reference",
    }),
  ).toBeChecked();
  await panel.getByText("Preview generated prompt", { exact: true }).click();
  await expect(panel.getByLabel("Generated prompt")).toContainText(
    "EXISTING CODE TO REPAIR",
  );
  await select("Visuals");
  await tabs
    .getByRole("tab", { name: "Visuals", exact: true })
    .press("ArrowRight");
  await expect(
    tabs.getByRole("tab", { name: "Reference look", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const footer = (await panel.locator(".prompt-actions").boundingBox())!;
  const body = (await panel.locator(".prompt-form-scroll").boundingBox())!;
  expect(footer.y).toBeGreaterThanOrEqual(body.y + body.height - 1);
  await expect(
    panel.getByRole("button", { name: "Copy and Download", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/prompt-templates.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(
    panel.getByRole("button", { name: "Copy and Download", exact: true }),
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
  await select("Output");
  const format = panel.getByLabel("Output format");
  await format.selectOption("separate");
  const blocksZip = page.waitForEvent("download");
  await copyButton.click();
  const blocksTask = readZipText(await readFile(await (await blocksZip).path()), "TASK.md");
  await expect(copyButton).toBeEnabled();
  expect(blocksTask).toContain("Return exactly THREE clearly labeled code blocks");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(blocksTask);
  await format.selectOption("document");
  await panel.getByRole("button", { name: "Paste full HTML document" }).click();
  const dialog = page.getByRole("dialog", { name: "Paste full HTML document", exact: true });
  await dialog.getByLabel("HTML document to import").fill(`<!doctype html><html><head><style>#generated { color: red; }</style></head><body><div id="generated"></div><script>window.renderFrame = () => { document.querySelector('#generated').textContent = 'Imported animation'; };</script></body></html>`);
  await dialog.getByRole("button", { name: "Apply pasted document", exact: true }).click();
  await expect(page.frameLocator('iframe[title="Animation preview"]').locator("#generated")).toHaveText("Imported animation");
});
