import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

test("studio keeps library, player, contextual inspector and full-width timeline together", async ({
  page,
}) => {
  const p = newProject();
  p.name = "Space explainer";
  p.settings = { ...p.settings, width: 1280, height: 720, duration: 4 };
  p.assets = [
    {
      id: "planet",
      name: "planet.svg",
      data:
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#101c2b"/><circle cx="240" cy="160" r="83" fill="#4cbac1"/><path d="M170 130Q210 80 250 105L270 165L230 185L210 225L160 183Z" fill="#286876"/><ellipse cx="240" cy="160" rx="160" ry="28" fill="none" stroke="#cedbd6" stroke-width="8" transform="rotate(-25 240 160)"/></svg>',
        ),
    },
    {
      id: "star",
      name: "star-reference.svg",
      kind: "reference",
      data:
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="480" height="320" fill="#101c2b"/><circle cx="240" cy="160" r="80" fill="#edb65c"/><circle cx="240" cy="160" r="105" fill="none" stroke="#79512b" stroke-width="16"/></svg>',
        ),
    },
  ];
  p.html =
    '<img src="asset://planet" style="width:80%;height:80%;object-fit:contain">';
  p.css = "body{display:grid;place-items:center;background:#101c2b}";
  p.js = "";
  p.workflow = initialWorkflow(p);
  p.workflow.script = "A journey through space. Discover the stars.";
  p.workflow.scenes[0] = {
    ...p.workflow.scenes[0],
    title: "Our planet",
    narration: "A journey through space.",
  };
  p.workflow.scenes.push({
    ...p.workflow.scenes[0],
    id: "two",
    title: "Distant stars",
    narration: "Discover the stars.",
    html: p.html.replace("planet", "star"),
  });
  const voice = {
    ...clipFromAudio(synthesizeSound("Ambient loop"), "voice"),
    name: "Narration.wav",
    transcript: p.workflow.script,
  };
  const effect = clipFromAudio(synthesizeSound("Soft pop"), "sfx", "scene-1");
  effect.start = 1;
  const music = clipFromAudio(synthesizeSound("Ambient loop"), "music");
  p.audio = [voice, effect, music];
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
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
    r.fulfill({ json: { result: { eleven: false, gemini: false } } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Media panel", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Media library", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')

      .locator("img"),
  ).toBeVisible();
  await expect(page.locator(".monaco-editor").first()).toBeAttached();
  const timeline = await page.locator(".timeline").boundingBox(),
    player = await page.locator(".center").boundingBox(),
    library = await page.locator(".code-panel").boundingBox(),
    inspector = await page.locator(".assistant-panel").boundingBox();
  expect(timeline!.width).toBeGreaterThan(1550);
  expect(timeline!.x).toBeLessThan(15);
  expect(timeline!.y).toBeGreaterThanOrEqual(player!.y + player!.height);
  expect(player!.x).toBeGreaterThan(library!.x + library!.width);
  expect(inspector!.x).toBeGreaterThan(player!.x + player!.width);
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Move Narration.wav", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Audio properties", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Volume", { exact: true }).fill("0.6");
  await expect(page.getByLabel("Volume", { exact: true })).toHaveValue("0.6");
  const timeBefore = await page
    .getByRole("slider", { name: "Timeline position" })
    .inputValue();
  await page
    .getByRole("button", { name: "Move Soft pop", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Timeline position" }),
  ).toHaveValue(timeBefore);
  await expect(page.locator(".inspector-heading")).toContainText("Soft pop");
  await page.getByRole("button", { name: "Media panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Inspect planet.svg", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Media details", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Project", exact: true }).click();
  await page.screenshot({ path: "test-results/studio-layout.png" });
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "Media panel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export", exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/studio-layout-laptop.png" });
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const libraryAudio = page.getByRole("region", {
    name: "Audio library",
    exact: true,
  });
  const chooseAudio = page.waitForEvent("filechooser");
  await libraryAudio
    .getByRole("button", { name: "Import media", exact: true })
    .click();
  await (
    await chooseAudio
  ).setFiles({
    name: "Imported narration.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(
      synthesizeSound("Success chime").data.split(",")[1],
      "base64",
    ),
  });
  await expect(page.locator(".inspector-heading")).toContainText(
    "Imported narration.wav",
  );
  await page.getByRole("button", { name: "Media panel", exact: true }).click();
  const dragAsset = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.setData("application/x-framescript-asset", "planet");
    return data;
  });
  await page
    .locator(".preview-shell")
    .dispatchEvent("drop", { dataTransfer: dragAsset });
  await dragAsset.dispose();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("img"),
  ).toHaveCount(2);
  const initialWidth = (await page
    .locator(".timeline-track-canvas")
    .boundingBox())!.width;
  await page
    .getByRole("slider", { name: "Timeline zoom", exact: true })
    .fill("2");
  await expect
    .poll(
      async () =>
        (await page.locator(".timeline-track-canvas").boundingBox())!.width,
    )
    .toBeCloseTo(96 + (initialWidth - 96) * 2, 0);
});
