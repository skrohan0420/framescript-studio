// Historical browser scenarios for the former UI. See tests/README.md.
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { newProject } from "../shared/project";
import {
  initialWorkflow,
  scenesFromPlan,
  activateScene,
} from "../shared/workflow";
import { timeScenesToNarration } from "../shared/narration";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";
import { localStoryboard } from "../shared/workflow";

test("a new narration take can retime existing visuals without discarding SFX, and provider failure preserves the take", async ({
  page,
}) => {
  const script = "Look at the stars. ".repeat(18).trim();
  const p = newProject();
  p.workflow = { ...initialWorkflow(p), script };
  const voice = {
    ...clipFromAudio(synthesizeSound("Ambient loop"), "voice"),
    transcript: script,
  };
  const scenes = timeScenesToNarration(
    scenesFromPlan(script, localStoryboard(script), p),
    voice,
    script,
  ).map((scene, i) => ({
    ...scene,
    html: `<div id="keep-${i}">Visual ${i}</div>`,
  }));
  p.workflow = { ...p.workflow, scenes, selectedId: scenes[0].id };
  Object.assign(p, activateScene(p, scenes[0].id));
  const effect = clipFromAudio(
    synthesizeSound("Soft pop"),
    "sfx",
    scenes[0].id,
  );
  p.audio = [voice, effect];
  let fail = false;
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: p } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/mediaStatus", (r) =>
    r.fulfill({ json: { result: { eleven: true, gemini: false } } }),
  );
  await page.route("**/api/elevenCatalog", (r) =>
    r.fulfill({
      json: {
        result: {
          voices: [{ id: "v", name: "Voice" }],
          models: [{ id: "m", name: "Model" }],
        },
      },
    }),
  );
  await page.route("**/api/generateAudio", (r) =>
    fail
      ? r.fulfill({
          status: 400,
          json: { result: { error: "Test provider failure" } },
        })
      : r.fulfill({
          json: { result: { data: synthesizeSound("Success chime").data } },
        }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Storyboard & production workflow",
  });
  await dialog.getByRole("button", { name: "Voice", exact: true }).click();
  await page.unroute("**/api/workspaceGet");
  await dialog
    .getByRole("button", { name: "Generate narration take", exact: true })
    .click();
  await expect(dialog.locator(".audio-clip")).toHaveCount(2);
  await dialog
    .getByRole("button", {
      name: "Fit existing scenes to this narration",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".workflow-context")).toContainText("1.2s total");
  fail = true;
  await dialog
    .getByRole("button", { name: "Generate narration take", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Test provider failure",
  );
  await expect(dialog.locator(".audio-clip")).toHaveCount(2);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
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
  expect(saved.workflow.scenes.map((scene: any) => scene.html)).toEqual(
    scenes.map((scene) => scene.html),
  );
  expect(saved.audio.find((clip: any) => clip.id === effect.id)).toEqual(
    effect,
  );
  expect(
    saved.audio.filter((clip: any) => clip.lane === "voice" && !clip.muted),
  ).toHaveLength(1);
});

test("script → generated audio → timed scenes → visuals → SFX/music → real master export", async ({
  page,
}) => {
  test.setTimeout(90000);
  const script =
    "The night sky contains countless stars. Every point of light has a story spanning millions of years. A telescope gathers that light and brings distant worlds into view. We can explore planets and discover how they formed. Our journey continues beyond the familiar constellations. Keep looking upward and asking new questions about the universe around us.";
  const source = synthesizeSound("Ambient loop");
  let voiceRequests = 0,
    visualRequests = 0;
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({
      json: { result: { provider: "ollama", model: "test-model" } },
    }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/mediaStatus", (r) =>
    r.fulfill({ json: { result: { eleven: true, gemini: false } } }),
  );
  await page.route("**/api/elevenCatalog", (r) =>
    r.fulfill({
      json: {
        result: {
          voices: [{ id: "test-voice", name: "Test voice" }],
          models: [{ id: "test-model", name: "Test model" }],
        },
      },
    }),
  );
  await page.route("**/api/generateAudio", (r) => {
    const request = r.request().postDataJSON().args[0];
    expect(request.type).toBe("voice");
    expect(request.text).toBe(script);
    voiceRequests++;
    return r.fulfill({ json: { result: { data: source.data } } });
  });
  await page.route("**/api/generate", (r) => {
    const request = r.request().postDataJSON().args[1];
    expect(
      request.project.audio.filter((clip: any) => clip.lane === "voice"),
    ).toHaveLength(1);
    visualRequests++;
    return r.fulfill({
      json: {
        result: {
          action: "update",
          html: '<div id="audio-first-visual">●</div>',
          css: "body{background:#123;display:grid;place-items:center;color:white}#audio-first-visual{font-size:100px}",
          js: "",
          settings: { duration: 0.1 },
          explanation: "Generated scene imagery",
        },
      },
    });
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Storyboard & production workflow",
  });
  await dialog.getByRole("textbox", { name: "Video script" }).fill(script);
  await page.unroute("**/api/workspaceGet");
  await dialog
    .getByRole("button", { name: "Generate narration first", exact: true })
    .click();
  await expect(dialog.getByLabel("Narration scope")).toHaveValue("script");
  await dialog
    .getByRole("button", { name: "Generate narration take", exact: true })
    .click();
  await expect(dialog.locator(".audio-clip")).toHaveCount(1);
  await expect(dialog.locator(".audio-clip")).toContainText("8.00s source");
  await dialog
    .getByRole("button", {
      name: "Compose scenes from this narration",
      exact: true,
    })
    .click();
  await expect(dialog.locator(".storyboard-card")).toHaveCount(
    localStoryboard(script).scenes.length,
  );
  await expect(dialog.locator(".workflow-context")).toContainText("8.0s total");
  await dialog
    .getByRole("button", { name: "Generate scene", exact: true })
    .first()
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')
      .locator("#audio-first-visual"),
  ).toBeVisible();
  await page.getByRole("slider", { name: "Timeline position" }).fill("0.4");
  await page
    .getByRole("region", { name: "Selected scene editor" })
    .getByRole("button", { name: "SFX & Music", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Production tools", exact: true })
    .getByRole("button", { name: "Soft pop SFX", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Production tools", exact: true })
    .getByRole("button", { name: "Ambient loop Music loop", exact: true })
    .click();
  await page.getByRole("button", { name: "Media panel", exact: true }).click();
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
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
  expect(
    saved.workflow.scenes.reduce(
      (sum: number, scene: any) => sum + scene.duration,
      0,
    ),
  ).toBeCloseTo(8, 6);
  expect(
    saved.workflow.scenes.map((scene: any) => scene.narration).join(" "),
  ).toBe(script);
  expect(
    saved.audio.find((clip: any) => clip.lane === "voice").sceneId,
  ).toBeUndefined();
  expect(
    saved.audio.find((clip: any) => clip.lane === "sfx").start,
  ).toBeCloseTo(0.4);
  expect(
    saved.audio.find((clip: any) => clip.lane === "music").length,
  ).toBeCloseTo(8);
  expect(voiceRequests).toBe(1);
  expect(visualRequests).toBe(1);
  await page
    .getByRole("button", { name: "Master preview", exact: true })
    .click();
  await page.screenshot({ path: "test-results/audio-first-workflow.png" });
  await page
    .getByRole("button", { name: "Export", exact: false })
    .first()
    .click();
  const exportDialog = page.getByRole("dialog", { name: "Export animation" });
  await expect(
    exportDialog.getByLabel("duration", { exact: true }),
  ).toHaveValue("8");
  for (const [label, value] of [
    ["width", "320"],
    ["height", "180"],
    ["fps", "10"],
  ])
    await exportDialog.getByLabel(label, { exact: true }).fill(value);
  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: "Render & download" }).click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  const file = "test-results/audio-first-master.mp4";
  await download.saveAs(file);
  const ffmpeg = createRequire(import.meta.url)("ffmpeg-static");
  const pcm = spawnSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-i",
      file,
      "-map",
      "0:a:0",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-f",
      "s16le",
      "-",
    ],
    { maxBuffer: 1_000_000 },
  );
  expect(pcm.status).toBe(0);
  expect(pcm.stdout.length / 16000).toBeCloseTo(8, 1);
  expect(pcm.stdout.some((byte) => byte !== 0)).toBe(true);
});
