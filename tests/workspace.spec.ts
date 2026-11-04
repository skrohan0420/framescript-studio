import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
test("PowerShell terminal runs commands and keeps the working directory", async ({
  page,
}) => {
  test.skip(process.platform !== "win32", "Windows PowerShell");
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await page.getByRole("button", { name: "Code editor options" }).click();
  await page
    .getByRole("button", { name: "PowerShell terminal", exact: true })
    .click();
  const terminal = page.getByRole("region", { name: "PowerShell terminal" });
  const command = terminal.getByRole("textbox", { name: "PowerShell command" });
  const output = terminal.locator("pre");
  const blocked = await page.request.post("/api/terminalRun", {
    headers: { "X-FrameScript": "1", Origin: "null" },
    data: {
      args: ["02ecae65-6c7f-4cb8-9516-fd13c94b6fd1", "Write-Output blocked"],
    },
  });
  expect(blocked.status()).toBe(403);
  await command.fill(
    "Set-Location -LiteralPath $env:TEMP; Write-Output 'terminal-ready'",
  );
  await expect(
    terminal.getByRole("button", { name: "Run", exact: true }),
  ).toBeEnabled();
  await command.press("Enter");
  await expect(output).toContainText(/\nterminal-ready/);
  await expect(terminal.getByText("Exit 0", { exact: true })).toBeVisible();
  await expect(terminal.locator(".terminal-cwd")).toContainText(
    process.env.TEMP!,
  );
  await command.fill("(Get-Location).Path");
  await command.press("Enter");
  await expect(output).toContainText(`\n${process.env.TEMP}`);
  await command.fill("Start-Sleep -Seconds 30");
  await expect(
    terminal.getByRole("button", { name: "Run", exact: true }),
  ).toBeEnabled();
  await command.press("Enter");
  await terminal.getByRole("button", { name: "Stop command" }).click();
  await expect(terminal.getByText(/^Exit \d+$/)).toBeVisible();
  await terminal.getByRole("button", { name: "Clear terminal" }).click();
  await expect(output).toHaveText("Run a local PowerShell command below.");
});
test("workspace shortcuts can be remapped, persisted, and used from the preview", async ({
  page,
}) => {
  await page.goto("/#editor");
  const settingsButton = page
    .getByRole("banner")
    .getByRole("button", { name: "Project settings", exact: true });
  const openShortcuts = async () => {
    await settingsButton.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Keyboard shortcuts", exact: true })
      .click();
  };
  await openShortcuts();
  const dialog = page.getByRole("dialog", {
    name: "Keyboard shortcuts",
    exact: true,
  });
  await dialog
    .getByRole("searchbox", { name: "Filter shortcuts" })
    .fill("Play or pause");
  const binding = dialog.getByRole("button", {
    name: "Change shortcut for Play or pause",
    exact: true,
  });
  await binding.click();
  await binding.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(binding).toHaveText("Space");
  await binding.click();
  await binding.press("w");
  await expect(dialog.getByRole("status")).toContainText("Split at playhead");
  const persisted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settingsSet") &&
      response.request().postData()?.includes('"play":"KeyP"') === true,
  );
  await binding.click();
  await binding.press("p");
  await expect(binding).toHaveText("P");
  await persisted;
  await page.reload();
  const transport = page.locator(".center > .transport");
  const title = page.getByRole("textbox", {
    name: "Project name",
    exact: true,
  });
  await title.press("p");
  await expect(
    transport.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  const frame = page.frameLocator('iframe[title="Animation preview"]');
  await frame.locator("body").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("p");
  await expect(
    transport.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("p");
  await expect(
    transport.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await openShortcuts();
  const resetSaved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settingsSet") &&
      response.request().postData()?.includes('"shortcuts":{}') === true,
  );
  await dialog.getByRole("button", { name: "Reset all", exact: true }).click();
  await resetSaved;
});
test("expanded code editor keeps the same document and exposes navigation tools", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  const panel = page.locator(".code-workbench");
  await panel.getByRole("button", { name: "JavaScript", exact: true }).click();
  const editor = panel.locator(".monaco-editor");
  await expect(editor).toBeVisible();
  const compactWidth = (await editor.boundingBox())!.width;
  await panel
    .getByRole("button", { name: "Expand editor", exact: true })
    .click();
  await expect
    .poll(async () => (await editor.boundingBox())!.width)
    .toBeGreaterThan(compactWidth * 2);
  const size = panel.getByLabel("Code text size in pixels");
  const originalSize = Number.parseInt((await size.textContent())!, 10);
  await panel.getByRole("button", { name: "Increase code text size" }).click();
  await expect(size).toHaveText(`${originalSize + 1}px`);
  await panel.getByRole("button", { name: "Decrease code text size" }).click();
  await expect(size).toHaveText(`${originalSize}px`);
  await panel.getByRole("button", { name: "Find", exact: true }).click();
  await expect(editor.locator(".find-widget.visible")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor.locator(".find-widget.visible")).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Close expanded editor" }),
  ).toBeVisible();
  for (const tool of ["Go to line", "Command palette"]) {
    await panel.getByRole("button", { name: tool, exact: true }).click();
    const quickInput = page.locator(".quick-input-widget:visible");
    await expect(quickInput).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(quickInput).toHaveCount(0);
  }
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("const answer=42;");
  const formatter = panel.getByLabel("Format code");
  await formatter.selectOption({ label: "Format document" });
  await expect(editor.locator(".view-lines")).toContainText(
    "const answer = 42;",
  );
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText("[1,2,3]");
  await page.keyboard.press("Control+A");
  await formatter.selectOption({ label: "Format selected JSON" });
  await expect(editor.locator(".view-lines")).toContainText("[1, 2, 3]");
  await page.keyboard.press("Control+Home");
  await page.keyboard.insertText("// expanded editor check\n");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Escape");
  await expect(
    panel.getByRole("button", { name: "Expand editor", exact: true }),
  ).toBeFocused();
  await expect(editor.locator(".view-lines")).toContainText(
    "expanded editor check",
  );
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/recover", (route) =>
    route.fulfill({ json: { result: null } }),
  );
});

test("recovery stays nonblocking and acknowledged snapshots do not reappear", async ({
  page,
}) => {
  let snapshot = { ...newProject(), name: "Recovered project" };
  await page.route("**/api/recover", (route) =>
    route.fulfill({ json: { result: snapshot } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  const banner = page.getByRole("region", { name: "Autosave recovery" });
  await expect(banner).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "ALL", exact: false }).first().click();
  await banner.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#ball"),
  ).toBeVisible();
  await expect(banner).toHaveCount(0);
  snapshot = { ...snapshot, name: "Newer autosave" };
  await page.reload();
  await expect(banner).toContainText("Newer autosave");
  await banner
    .getByRole("button", { name: "Restore workspace", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue(
    "Newer autosave",
  );
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#ball"),
  ).toBeVisible();
  await expect(banner).toHaveCount(0);
});
test("local Node backend saves, reopens, imports assets and downloads an MP4", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#ball"),
  ).toBeVisible();
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Project settings", exact: true })
    .click();
  const settings = page.getByRole("dialog");
  const [projectDownload] = await Promise.all([
    page.waitForEvent("download"),
    settings
      .getByRole("button", { name: "Save copy as .frame", exact: true })
      .click(),
  ]);
  await settings.getByRole("button", { name: "Close", exact: true }).click();
  const projectFile = await projectDownload.path();
  expect(projectFile).toBeTruthy();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Open project", exact: true }).click(),
  ]);
  await chooser.setFiles(projectFile!);
  await expect(page.getByRole("status")).toContainText("Project opened");
  await page.locator("input[type=file]").setInputFiles({
    name: "reference.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>',
    ),
  });
  await expect(page.getByRole("textbox", { name: "Asset name" })).toHaveValue(
    "reference.svg",
  );
  await page.getByRole("button", { name: "Insert image into HTML" }).click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("img"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Export", exact: false })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  await dialog.locator(".export-advanced > summary").click();
  await dialog
    .getByLabel("Export resolution", { exact: true })
    .selectOption("custom");
  await dialog
    .getByLabel("Export frame rate", { exact: true })
    .selectOption("custom");
  for (const [label, value] of [
    ["width", "320"],
    ["height", "180"],
    ["duration", "0.4"],
    ["Custom frame rate", "10"],
  ])
    await dialog.getByLabel(label, { exact: true }).fill(value);
  const [video] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Render & download" }).click(),
  ]);
  expect(video.suggestedFilename()).toMatch(/\.mp4$/);
  expect(await video.failure()).toBeNull();
  await video.saveAs("test-results/web-workflow.mp4");
  await expect(
    page.getByRole("status").filter({ hasText: "Export verified" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/web-workspace.png" });
});
test("workspace executes preview, timeline, combined source and inspector", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await expect(page.getByText("LIVE PREVIEW", { exact: true })).toBeVisible();
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("#ball")).toBeVisible();
  const y0 = await preview
    .locator("#ball")
    .evaluate((el) => el.getBoundingClientRect().y);
  await page.getByRole("slider", { name: "Timeline position" }).fill("1");
  await page.waitForTimeout(100);
  const y1 = await preview
    .locator("#ball")
    .evaluate((el) => el.getBoundingClientRect().y);
  expect(Math.abs(y1 - y0)).toBeGreaterThan(100);
  await page.getByRole("button", { name: "ALL", exact: false }).first().click();
  await expect(page.locator(".monaco-editor")).toBeVisible();
  await page
    .getByRole("button", { name: "Select element", exact: true })
    .click();
  await preview.locator("#ball").click();
  await expect(page.getByText("div #ball", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Examples", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "test-results/workspace.png", fullPage: true });
});
test("failed preview preserves last valid frame and visual edits update source", async ({
  page,
}) => {
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Animation preview"]');
  await expect(preview.locator("#ball")).toBeVisible();
  await page
    .getByRole("button", { name: "Select element", exact: true })
    .click();
  await preview.locator("#ball").click();
  await expect(page.getByText("div #ball", { exact: true })).toBeVisible();
  const width = page
    .locator(".properties label")
    .filter({ has: page.locator("span", { hasText: /^width$/ }) })
    .locator("input");
  await width.fill("200px");
  await width.blur();
  await expect(preview.locator("#ball")).toHaveCSS("width", "200px");
  await page
    .getByRole("button", { name: "JavaScript", exact: false })
    .first()
    .click();
  const editor = page.locator(".monaco-editor").first();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText('import value from "./module.js";');
  await expect(page.locator(".code-problem-dot")).toBeVisible();
  const problems = page.getByRole("region", { name: "Code problems" });
  await expect(problems).toBeVisible();
  await expect(problems).toContainText(
    "Import and export statements require a module",
  );
  await problems.getByRole("button", { name: /JavaScript · Line 1/ }).click();
  await expect(editor.locator("textarea")).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    "// THREE" + "\n".repeat(11) + "  console.log(dead)",
  );
  await expect(page.locator(".preview-error")).toContainText(
    "dead is not defined",
  );
  await expect(
    problems.getByRole("button", {
      name: "Preview error · Line 12, column 15",
    }),
  ).toBeVisible();
  await expect(problems).toContainText("No syntax errors found.");
  await expect(preview.locator("#ball")).toBeVisible();
  await page.getByRole("button", { name: "ALL", exact: true }).click();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    "<!doctype html>\n<html><body><div></span></body></html>",
  );
  await expect(problems).toContainText('Unexpected closing tag "span"');
  await problems
    .getByRole("button", { name: /Combined HTML · Line 2/ })
    .click();
  await expect(editor.locator("textarea")).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    "<!doctype html>\n<html><body><div>Fixed</div></body></html>",
  );
  await expect(problems).toHaveCount(0);
  await expect(page.locator(".code-problem-dot")).toHaveCount(0);
  await page.getByRole("button", { name: "JavaScript", exact: true }).click();
  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    'console.log("Frame value", { count: 3, nested: { speed: 2 } }); console.info(JSON.stringify({ ready: true })); console.table([{ name: "Orbit", frames: 60 }]); console.warn("Sample warning");',
  );
  await page.getByRole("button", { name: "Code editor options" }).click();
  await page
    .getByRole("button", { name: "Preview console", exact: true })
    .click();
  const consolePanel = page.getByRole("region", { name: "Preview console" });
  await consolePanel.getByLabel("Console output format").selectOption("pretty");
  await expect(consolePanel).toContainText('"count": 3');
  await expect(consolePanel).toContainText('"ready": true');
  const table = consolePanel.getByRole("table", { name: "Console data" });
  await expect(
    table.getByRole("columnheader", { name: "frames" }),
  ).toBeVisible();
  await expect(table.getByRole("cell", { name: "60" })).toBeVisible();
  await consolePanel.getByLabel("Console output format").selectOption("json");
  const nested = consolePanel.locator("summary").filter({ hasText: "nested:" });
  await nested.click();
  await expect(
    consolePanel
      .locator(".console-json-children")
      .getByText("speed:", { exact: false }),
  ).toBeVisible();
  await consolePanel.getByLabel("Console output format").selectOption("table");
  await expect(
    consolePanel.getByRole("table", { name: "Console data" }),
  ).toHaveCount(3);
  await consolePanel.getByLabel("Console output format").selectOption("text");
  await expect(consolePanel).toContainText("Frame value {count: 3, nested:");
  await expect(consolePanel).toContainText("Sample warning");
  await page
    .getByRole("button", { name: "Expand editor", exact: true })
    .click();
  const panel = page.locator(".code-bottom-panel");
  const initialHeight = (await panel.boundingBox())!.height;
  const handle = await page
    .getByRole("separator", { name: "Resize code output panel" })
    .boundingBox();
  await page.mouse.move(
    handle!.x + handle!.width / 2,
    handle!.y + handle!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y - 90, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await panel.boundingBox())!.height)
    .toBeGreaterThan(initialHeight + 70);
  await consolePanel.getByLabel("Console message level").selectOption("warn");
  await expect(consolePanel).not.toContainText("Frame value");
  await consolePanel.getByRole("button", { name: "Clear console" }).click();
  await expect(consolePanel).not.toContainText("Sample warning");
  await consolePanel.getByLabel("Console message level").selectOption("all");
  const prompt = consolePanel.getByRole("textbox", { name: "Console command" });
  const command = 'document.querySelector("div").textContent';
  await prompt.fill(command);
  await prompt.press("Enter");
  await expect(consolePanel.locator('[data-level="result"]')).toContainText(
    "Fixed",
  );
  await prompt.press("ArrowUp");
  await expect(prompt).toHaveValue(command);
  await consolePanel
    .getByRole("searchbox", { name: "Filter console" })
    .fill("Fixed");
  await expect(consolePanel.locator('[data-level="command"]')).toHaveCount(0);
  await expect(consolePanel.locator('[data-level="result"]')).toContainText(
    "Fixed",
  );
  await consolePanel
    .getByRole("searchbox", { name: "Filter console" })
    .fill("");
  await consolePanel.getByLabel("Console output format").selectOption("json");
  await prompt.fill(
    'Object.fromEntries(Array.from({ length: 44 }, (_, i) => ["property" + i, i]))',
  );
  await prompt.press("Enter");
  const wideResult = consolePanel.locator('[data-level="result"]').last();
  await wideResult.getByRole("button", { name: "Show 20 more" }).click();
  await expect(
    wideResult.getByText("property43:", { exact: false }),
  ).toBeVisible();
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: null } }),
  );
});
