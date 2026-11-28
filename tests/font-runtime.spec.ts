import { test, expect, type Page } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { documentFor } from "../shared/runtime";
import { waitForSceneFonts } from "../server/render-fonts";
import { renderExport } from "../server/export";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

function fixture(family = "Outfit") {
  const project = newProject();
  project.settings = { ...project.settings, width: 320, height: 180, duration: 1, fps: 4, network: false };
  project.promptDraft = { referenceStyle: "Test look", referenceLookSettings: { "Test look": { font: family } } };
  project.html = '<div id="label">Helium Energy</div>';
  project.css = 'body{background:#10142B;color:#F6F4FF}#label{font:600 36px "' + family + '";padding:40px 10px}';
  project.js = 'window.renderFrame=t=>{document.querySelector("#label").dataset.time=String(t)};';
  return project;
}

async function actualFonts(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#label" });
    return (await session.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
  } finally {
    await session.detach();
  }
}

test("preview, export documents and standalone HTML render actual bundled Outfit offline", async ({ page }) => {
  const remoteRequests: string[] = [];
  await page.route(/^https?:/, route => {
    remoteRequests.push(route.request().url());
    return route.abort();
  });
  for (const options of [{}, { export: true }, { standalone: true }]) {
    await page.setContent(documentFor(fixture(), { ...options, textEditing: false }));
    await waitForSceneFonts(page);
    const fonts = await actualFonts(page);
    expect(fonts.some(font => font.postScriptName === "Outfit-SemiBold" && font.isCustomFont && font.glyphCount > 0)).toBe(true);
    expect(fonts.some(font => /Times/i.test(font.familyName))).toBe(false);
    await expect(page.locator("#label")).toBeVisible();
  }
  expect(remoteRequests).toEqual([]);
});

test("unavailable configured fonts produce a visible error instead of substituted text", async ({ page }) => {
  await page.setContent(documentFor(fixture("FrameScriptMissingFont12345"), { textEditing: false }));
  await expect(waitForSceneFonts(page)).rejects.toThrow(/Configured font.*FrameScriptMissingFont12345.*unavailable/);
  await expect(page.getByRole("alert")).toContainText("stopped rendering to prevent font substitution");
  await expect(page.locator("#label")).not.toBeVisible();
});

test("the app surfaces missing fonts through the existing preview error", async ({ page }) => {
  await page.route("**/api/workspaceGet", route => route.fulfill({ json: { result: fixture("FrameScriptMissingFont12345") } }));
  await page.route("**/api/settingsGet", route => route.fulfill({ json: { result: {} } }));
  await page.route("**/api/autosave", route => route.fulfill({ json: { result: true } }));
  await page.goto("/#editor");
  await expect(page.locator(".preview-error")).toContainText("Configured font “FrameScriptMissingFont12345” is unavailable");
});

test("nested continuation documents wait for fonts and retain early seek requests", async ({ page }) => {
  const project = fixture();
  project.workflow = initialWorkflow(project);
  project.workflow.scenes[0].visualContinuations = [{
    id: "continued", start: 0.5, duration: 0.5,
    html: project.html, css: project.css, js: project.js,
  }];
  await page.setContent(documentFor(project, { textEditing: false }));
  await page.evaluate(() => (window as any).__fsSeek(0.7));
  await waitForSceneFonts(page);
  const frame = page.frameLocator('iframe[title="Visual continuation"]');
  await expect(frame.locator("#label")).toHaveAttribute("data-time", /^0\.199/);
  await expect(frame.locator("#label")).toBeVisible();
});

test("PNG and HTML exports work offline and unavailable fonts fail the PNG export", async ({ page }) => {
  const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
  const folder = path.resolve("test-results/font-export");
  await fs.mkdir(folder, { recursive: true });
  const options = { format: "png" as const, width: 320, height: 180, fps: 4, duration: 1,
    speed: 1, quality: 24, fit: "fit" as const, transparent: false, time: 0,
    acceleration: "software" as const };
  const render = (project: ReturnType<typeof fixture>, file: string) =>
    renderExport(project, options, path.join(folder, file), ffmpeg,
      new AbortController().signal, () => {}, undefined, { encoder: "software", workers: 1 });
  await render(fixture(), "outfit.png");
  expect((await fs.stat(path.join(folder, "outfit.png"))).size).toBeGreaterThan(1000);
  const sourceResponse = await page.request.post("/api/source", { headers: { "x-framescript": "1" }, data: { args: [fixture()] } });
  expect(sourceResponse.ok()).toBe(true);
  const { result } = await sourceResponse.json();
  const exportedHtml = await (await page.request.get(result.url)).text();
  await fs.writeFile(path.join(folder, "outfit.html"), exportedHtml);
  await page.route(/^https?:/, route => route.abort());
  await page.setContent(await fs.readFile(path.join(folder, "outfit.html"), "utf8"));
  await waitForSceneFonts(page);
  expect((await actualFonts(page)).some(font => font.postScriptName === "Outfit-SemiBold" && font.isCustomFont)).toBe(true);
  await expect(render(fixture("FrameScriptMissingFont12345"), "missing.png")).rejects.toThrow(/Configured font/);
});
