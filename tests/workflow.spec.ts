import { test, expect } from "@playwright/test";
import { synthesizeSound } from "../shared/audio";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/recover", (r) =>
    r.fulfill({ json: { result: null } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { provider: "ollama" } } }),
  );
});
test("script breakdown, independent scene components and master playback", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Storyboard & production workflow",
  });
  const script =
    "The night sky is full of stars. Each star has its own story. We can learn about the universe by studying their light. A small telescope opens a new window into space. Keep exploring because every observation can reveal something unexpected. Our journey is only beginning.";
  await dialog.getByRole("textbox", { name: "Video script" }).fill(script);
  await dialog
    .getByRole("button", { name: "Split locally", exact: true })
    .click();
  await expect(dialog.locator(".storyboard-card")).toHaveCount(2);
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await dialog
    .getByRole("textbox", { name: "Component text" })
    .fill("First scene");
  await dialog.getByRole("button", { name: "Apply to selected scene" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("h1")).toHaveText("First scene");
  await page.locator(".scene-rail-list button").nth(1).click();
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Components", exact: true })
    .click();
  await dialog
    .getByRole("textbox", { name: "Component text" })
    .fill("Second scene");
  await dialog.getByRole("button", { name: "Apply to selected scene" }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(preview.locator("h1")).toHaveText("Second scene");
  await page.locator(".scene-rail-list button").first().click();
  await expect(preview.locator("h1")).toHaveText("First scene");
  const firstDuration = await page
    .getByRole("slider", { name: "Timeline position" })
    .getAttribute("max");
  await page
    .getByRole("button", { name: "Master preview", exact: true })
    .click();
  await expect(preview.frameLocator("iframe#scene-0").locator("h1")).toHaveText(
    "First scene",
  );
  await page
    .getByRole("slider", { name: "Timeline position" })
    .fill(String(Number(firstDuration) + 0.2));
  await expect(
    preview.frameLocator("iframe#scene-1").locator("body"),
  ).toBeVisible();
  await expect(preview.frameLocator("iframe#scene-1").locator("h1")).toHaveText(
    "Second scene",
  );
  await page.screenshot({ path: "test-results/storyboard-master.png" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save (Ctrl+S)", exact: true }).click(),
  ]);
  const file = await download.path();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Open project", exact: true }).click(),
  ]);
  await chooser.setFiles(file!);
  await expect(page.locator(".scene-rail-list button")).toHaveCount(2);
  await expect(preview.locator("h1")).toHaveText("First scene");
});
test("audio library, narration timing and mascot references persist in a saved project", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Storyboard & production workflow",
  });
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Audio", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Soft pop SFX", exact: true })
    .click();
  await expect(dialog.locator(".audio-clip")).toHaveCount(1);
  await expect(dialog.locator(".audio-waveform i")).toHaveCount(64);
  const wav = synthesizeSound("Success chime");
  await dialog
    .locator('input[type=file][accept="audio/*"]')
    .setInputFiles({
      name: "narration.wav",
      mimeType: "audio/wav",
      buffer: Buffer.from(wav.data.split(",")[1], "base64"),
    });
  await expect(dialog.locator(".audio-clip")).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Fit scene to this narration take" })
    .click();
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Mascot & images", exact: true })
    .click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    dialog
      .getByRole("button", { name: "Upload references", exact: true })
      .click(),
  ]);
  await chooser.setFiles({
    name: "mascot.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="35" fill="blue"/></svg>',
    ),
  });
  await expect(dialog.locator(".mascot-assets img")).toHaveCount(1);
  await expect(
    dialog.locator(".mascot-assets input[type=checkbox]"),
  ).toBeChecked();
  await dialog
    .getByRole("button", { name: "Use in scene", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("img"),
  ).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save (Ctrl+S)", exact: true }).click(),
  ]);
  const { readFile } = await import("node:fs/promises");
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data.audio).toHaveLength(2);
  expect(data.workflow.mascot.references).toHaveLength(1);
  expect(data.workflow.scenes[0].duration).toBeCloseTo(1.2, 1);
  await page.getByRole("button", { name: "Storyboard", exact: true }).click();
  await dialog
    .locator(".workflow-tabs")
    .getByRole("button", { name: "Audio", exact: true })
    .click();
  await page.screenshot({ path: "test-results/workflow-audio.png" });
});
