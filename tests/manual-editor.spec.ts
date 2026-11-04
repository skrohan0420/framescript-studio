import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { synthesizeSound } from "../shared/audio";
import { splitVisual } from "../shared/timeline-edit";

test("failed autosave explains the error and Retry saves the current project", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  let attempts = 0;
  await page.route("**/api/autosave", (r) =>
    ++attempts === 1
      ? r.fulfill({
          status: 503,
          json: { result: { error: "Disk temporarily unavailable" } },
        })
      : r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  await expect(page.locator(".recovery-banner")).toContainText(
    "Disk temporarily unavailable",
  );
  await page.getByRole("button", { name: "Retry workspace save" }).click();
  await expect(page.getByLabel("Workspace save status")).toHaveText(
    "Workspace saved locally",
  );
  await expect(
    page.getByRole("button", { name: "Retry workspace save" }),
  ).toHaveCount(0);
});

test("visual splitting preserves animation time, and end trimming supports Undo", async ({
  page,
}) => {
  const p = newProject();
  p.settings.duration = 8;
  p.html = '<div id="clock"></div>';
  p.css = "body{color:white}";
  p.js =
    'window.renderFrame=t=>document.querySelector("#clock").textContent=t.toFixed(1)';
  p.workflow = initialWorkflow(p);
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: p } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  await page.getByRole("slider", { name: "Timeline position" }).fill("3");
  await page.getByRole("button", { name: "Split at playhead" }).click();
  const timelines = page.getByRole("tablist", {
    name: "Timelines",
    exact: true,
  });
  await expect(timelines.getByRole("tab")).toHaveCount(2);
  await timelines.getByRole("tab").nth(1).click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#clock"),
  ).toHaveText("3.0");
  await page.getByRole("button", { name: "Timeline snapping" }).click();
  const handle = (await page
    .getByRole("button", { name: "Trim end of visual clip", exact: true })
    .boundingBox())!;
  const ruler = (await page.locator(".ruler").boundingBox())!;
  await page.mouse.move(handle.x + 3, handle.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle.x + 3 - ruler.width * 0.2, handle.y + 10, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(await page.getByLabel("Timeline duration (seconds)").inputValue()),
    )
    .toBeCloseTo(4, 1);
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect(page.getByLabel("Timeline duration (seconds)")).toHaveValue("5");
  const persisted = { ...p, ...splitVisual(p, p.workflow!.selectedId, 3) };
  const saved = await page.request.post("/api/autosave", {
    headers: { "X-FrameScript": "1" },
    data: { args: [persisted] },
  });
  expect(saved.ok()).toBe(true);
  const loaded = await page.request.post("/api/workspaceGet", {
    headers: { "X-FrameScript": "1" },
    data: { args: [] },
  });
  expect((await loaded.json()).result.workflow.scenes[1].sourceOffset).toBe(3);
});

test("canvas presets resize both dimensions and keep preview aspect correct", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  const ratio = page.getByLabel("Canvas aspect ratio", { exact: true });
  const preview = page.locator('iframe[title="Animation preview"]');
  for (const [name, width, height] of [
    ["9:16", 1080, 1920],
    ["1:1", 1080, 1080],
    ["4:3", 1440, 1080],
    ["21:9", 2520, 1080],
    ["16:9", 1920, 1080],
  ] as const) {
    await ratio.selectOption(name);
    await expect(ratio).toHaveValue(name);
    await expect
      .poll(() => preview.evaluate((el) => [el.style.width, el.style.height]))
      .toEqual([`${width}px`, `${height}px`]);
    await expect
      .poll(async () => {
        const box = (await page.locator(".canvas-wrap").boundingBox())!;
        return box.width / box.height;
      })
      .toBeCloseTo(width / height, 2);
  }
});

test("full document paste splits code, rejects unsupported imports, and runtime errors jump to JavaScript", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  const open = page.getByRole("button", {
    name: "Paste full HTML document",
    exact: true,
  });
  const openPaste = async () => {
    await page.getByRole("button", { name: "Code editor options" }).click();
    await open.click();
  };
  await openPaste();
  const dialog = page.getByRole("dialog", {
    name: "Paste full HTML document",
    exact: true,
  });
  await dialog.getByRole("button", { name: "Apply pasted document" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Paste an HTML document first",
  );
  await dialog
    .getByLabel("HTML document to import")
    .fill(
      '<!doctype html><html><head><style>h1{color:white;font-size:100px}</style></head><body><h1 id="pasted">Pasted</h1><script>document.querySelector("h1").dataset.ready="yes";</script></body></html>',
    );
  await dialog.getByRole("button", { name: "Apply pasted document" }).click();
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("#pasted")).toHaveAttribute("data-ready", "yes");
  await expect(preview.locator("#pasted")).toHaveCSS("font-size", "100px");
  await openPaste();
  await expect(dialog.getByLabel("HTML document to import")).toHaveValue(
    /id="pasted"/,
  );
  await dialog
    .getByLabel("HTML document to import")
    .fill("<div>" + "x".repeat(2_000_001) + "</div>");
  await dialog.getByRole("button", { name: "Apply pasted document" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("html:");
  await dialog
    .getByLabel("HTML document to import")
    .fill(
      '<html><script src="https://example.com/library.js"></script></html>',
    );
  await dialog.getByRole("button", { name: "Apply pasted document" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "inline styles and classic scripts only",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await openPaste();
  await expect(dialog.getByLabel("HTML document to import")).toHaveValue(
    '<html><script src="https://example.com/library.js"></script></html>',
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(preview.locator("#pasted")).toBeVisible();
  await page.locator(".code-workbench").evaluate((el) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData(
      "text/plain",
      '<!doctype html><html><style>h1{color:white;font-size:100px}</style><body><h1 id="pasted">Direct paste</h1><script>window.pasted=true;</script></body></html>',
    );
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(preview.locator("#pasted")).toHaveText("Direct paste");
  await page
    .getByRole("button", { name: "JavaScript", exact: false })
    .first()
    .click();
  const code = page.locator(".monaco-editor textarea").first();
  await code.focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(
    'const value = 1;\n\nthrow new Error("Test source location");',
  );
  await expect(page.locator(".preview-error")).toContainText("line 3");
  await expect(page.locator(".preview-error")).toContainText(
    "Test source location",
  );
  await expect(preview.locator("#pasted")).toBeVisible();
  await page
    .getByRole("button", { name: "HTML", exact: false })
    .filter({ hasText: "HTML" })
    .first()
    .click();
  await page.getByRole("button", { name: "Jump to error" }).click();
  await expect(page.locator(".editor-tabs button.active")).toHaveAttribute(
    "aria-label",
    "JavaScript",
  );
  await code.focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(
    'document.querySelector("h1").textContent="Fixed";',
  );
  await expect(preview.locator("#pasted")).toHaveText("Fixed");
  await expect(page.locator(".preview-error")).toHaveCount(0);
  await code.focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText("const good = 1;\nconst broken = ;");
  await expect(page.locator(".preview-error")).toContainText("line 2");
  await expect(page.locator(".preview-error")).toContainText("SyntaxError");
});

test("manual workspace restores old projects, edits pasted code, and imports audio without AI", async ({
  page,
}) => {
  const project = newProject();
  project.workflow = initialWorkflow(project);
  project.workflow.scenes.push({
    ...project.workflow.scenes[0],
    id: "second",
    title: "Keep this clip",
    html: '<div id="kept">Saved content</div>',
  });
  let saved: any;
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/api\/(chatgptStatus|models|generate|mediaStatus)/.test(request.url())
    )
      providerRequests.push(request.url());
  });
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({
      json: {
        result: { leftView: "script", rightTab: "assistant", layoutVersion: 2 },
      },
    }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) => {
    saved = r.request().postDataJSON().args[0];
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await expect(
    page.getByRole("button", { name: "Storyboard", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Assistant", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Script panel", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Services", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".monaco-editor")).toBeVisible();
  const code = page.locator(".monaco-editor textarea").first();
  await code.focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(
    '<h1 id="manual" style="color:white;font-size:100px">Manual edit</h1>',
  );
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#manual"),
  ).toHaveText("Manual edit");
  await expect.poll(() => saved?.html).toContain('id="manual"');
  expect(saved.workflow.scenes[1].html).toContain('id="kept"');
  await expect(page.locator(".scene-rail")).toHaveCount(0);
  const timelines = page.getByRole("tablist", {
    name: "Timelines",
    exact: true,
  });
  await expect(timelines.getByRole("tab")).toHaveCount(2);
  await page.getByRole("button", { name: "Add timeline", exact: true }).click();
  await expect(timelines.getByRole("tab")).toHaveCount(3);
  await page.getByLabel("Timeline duration (seconds)").fill("9");
  await expect.poll(() => saved?.settings.duration).toBe(9);
  await code.focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText('<p id="separate">Separate timeline</p>');
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#separate"),
  ).toBeVisible();
  await timelines.getByRole("tab").first().click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#manual"),
  ).toBeVisible();
  await timelines
    .getByRole("tab", { name: "3 · Timeline 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove timeline", exact: true })
    .click();
  await expect(timelines.getByRole("tab")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect(timelines.getByRole("tab")).toHaveCount(3);
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#separate"),
  ).toBeVisible();
  const library = page.getByRole("region", { name: "Audio library" });
  await library.locator('input[type="file"]').setInputFiles({
    name: "manual.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(
      synthesizeSound("Success chime").data.split(",")[1],
      "base64",
    ),
  });
  await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
  const wave = (await page
    .locator(".audio-edit-clip .audio-waveform")
    .boundingBox())!;
  const waveContainer = (await page
    .locator(".audio-edit-clip .audio-move")
    .boundingBox())!;
  expect(wave.y + wave.height).toBeLessThanOrEqual(
    waveContainer.y + waveContainer.height,
  );
  expect(wave.y).toBeGreaterThanOrEqual(waveContainer.y + 16);
  const thumbnail = library.locator(".audio-waveform-thumbnail");
  await expect(thumbnail).toBeVisible();
  const waveformWidth = (await thumbnail.boundingBox())!.width;
  const tileWidth = (await library.locator(".audio-thumbnail").boundingBox())!
    .width;
  expect(waveformWidth).toBeLessThanOrEqual(tileWidth);
  await expect
    .poll(() =>
      thumbnail.evaluate((el: HTMLCanvasElement) => {
        const data = el
          .getContext("2d")!
          .getImageData(0, 0, el.width, el.height).data;
        return data.some((value, index) => index % 4 === 3 && value > 0);
      }),
    )
    .toBe(true);
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#separate"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Audio properties" }),
  ).toBeVisible();
  expect(providerRequests).toEqual([]);
  await page.screenshot({ path: "test-results/manual-workspace.png" });
});
