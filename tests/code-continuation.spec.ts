import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newProject, type Project } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

test("extends a code visual at its handoff without shifting or replacing narration", async ({
  page,
  context,
}) => {
  const project = newProject();
  project.settings = {
    ...project.settings,
    width: 320,
    height: 180,
    duration: 5,
  };
  project.html = '<div id="original">Original</div>';
  project.js = "window.renderFrame = () => {};";
  project.workflow = initialWorkflow(project);
  const scene = project.workflow.scenes[0];
  scene.visualDuration = 2;
  scene.visualContext = JSON.stringify({
    palette: "violet and blue",
    renderingMode: "2d",
  });
  const first = {
    ...clipFromAudio(synthesizeSound("Ambient loop"), "voice", scene.id),
    length: 2,
  };
  const second = {
    ...clipFromAudio(synthesizeSound("Gentle pulse"), "voice", scene.id),
    start: 2,
    length: 3,
    trimIn: 1,
    transcriptWords: [{ text: "Continue.", start: 1.25, end: 1.6 }],
  };
  project.audio = [first, second];
  let saved: Project | undefined;
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/autosave", (route) => {
    saved = route.request().postDataJSON().args[0];
    return route.fulfill({ json: { result: true } });
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const reloadMessages: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => {
      if (
        typeof payload === "string" &&
        payload.includes('"type":"full-reload"')
      )
        reloadMessages.push(payload);
    });
  });
  await page.goto("/#editor");
  await page.locator('.track-clip[data-timeline-kind="scene"]').click();
  await page.getByRole("button", { name: "Extend", exact: true }).click();
  const builder = page.getByRole("region", {
    name: "Extend visual · Prompt Builder",
  });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(
    builder.getByRole("button", { name: "Copy and Download" }),
  ).toBeInViewport({ ratio: 1 });
  const handoff = builder.getByRole("tab", { name: "Handoff" });
  await handoff.press("ArrowRight");
  await expect(builder.getByRole("tab", { name: "Narration" })).toBeFocused();
  await builder.getByRole("tab", { name: "Narration" }).press("Home");
  await expect(handoff).toBeFocused();
  await page.setViewportSize(viewport);
  await builder.getByText("Saved prompt selections").click();
  await expect(
    builder.getByLabel("Inherited prompt selections"),
  ).toHaveAttribute("readonly", "");
  await builder.getByRole("tab", { name: "Narration" }).click();
  await expect(builder.getByLabel("New voice clip")).toHaveValue(second.id);
  await expect(builder.getByLabel("Extension duration (seconds)")).toHaveValue(
    "3",
  );
  await expect(builder.getByLabel("Timed narration")).toHaveValue(
    /00:00:00,250 --> 00:00:00,600/,
  );
  await builder.getByRole("tab", { name: "Direction" }).click();
  const direction = builder.getByLabel("What happens next", { exact: true });
  await direction.fill("Show the next example.");
  const reveal = builder.getByRole("button", { name: "Reveal a detail" });
  await reveal.click();
  await reveal.click();
  await expect(direction).toHaveValue(
    "Show the next example.\nReveal the next important detail while keeping the existing subject in view.",
  );
  const hold = builder.getByRole("button", { name: "Hold, then reveal" });
  await hold.click();
  await expect(hold).toHaveAttribute("aria-pressed", "true");
  await builder.getByRole("button", { name: "Slow push-in" }).click();
  await expect(
    builder.getByLabel("Camera direction", { exact: true }),
  ).toHaveValue("Ease in from the handoff framing toward the main detail.");
  const copy = builder.getByRole("button", { name: "Copy and Download" });
  const directionTab = builder.getByRole("tab", { name: "Direction" });
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  await page.route(
    "**/api/download/*",
    (route) => route.fulfill({ status: 404, body: "Download not found" }),
    { times: 1 },
  );
  await copy.click();
  await expect(page.locator(".status-bar .status-notice")).toContainText(
    "Could not retrieve the extension ZIP",
  );
  await expect(directionTab).toHaveAttribute("aria-selected", "true");
  await expect(direction).toHaveValue(/Show the next example/);

  const zip = page.waitForEvent("download");
  const response = page.waitForResponse("**/api/codeContinuationPackage");
  await copy.click();
  const packaged = await response;
  expect(packaged.ok(), await packaged.text()).toBe(true);
  const bytes = await readFile(await (await zip).path());
  for (const name of [
    "TASK.md",
    "source/previous.js",
    "references/handoff.png",
    "references/motion-1.png",
    "references/motion-5.png",
    "references/motion.json",
    "context/inherited.json",
    "context/narration.srt",
  ])
    expect(bytes.includes(Buffer.from(name))).toBe(true);
  await expect(page.locator(".status-bar .status-notice")).toContainText(
    "Extension prompt copied",
  );
  const prompt = (
    await page.evaluate(() => navigator.clipboard.readText())
  ).replace(/\r\n/g, "\n");
  expect(prompt).toBe((await packaged.json()).result.prompt);
  expect(prompt).toContain("00:00:00,250");
  expect(prompt).toContain("The exact boundary is source time 2 seconds.");
  expect(prompt).toContain("Evaluate the reused previous animation at source time 2 + t.");
  expect(prompt).toContain("Preserve geometry, seeded particle positions");
  expect(prompt).toContain("window.THREE and window.FrameScript3D");
  expect(prompt).toContain(await direction.inputValue());
  expect(prompt).toContain(
    "Pacing: Hold briefly on the handoff composition, then reveal the next beat.",
  );
  expect(prompt).toContain(
    "Camera: Ease in from the handoff framing toward the main detail.",
  );
  expect(navigations).toEqual([]);
  await expect(directionTab).toHaveAttribute("aria-selected", "true");
  await builder.getByRole("tab", { name: "Output" }).click();
  await builder.getByRole("button", { name: "Close Extend builder" }).click();
  await page.getByRole("button", { name: "Extend", exact: true }).click();
  await builder
    .getByLabel("Paste continuation HTML")
    .fill(
      `<!doctype html><html><head><style>#continued { color: cyan; }</style></head><body><div id="continued"></div><script>window.renderFrame = t => { document.querySelector('#continued').textContent = t.toFixed(2); };</script></body></html>`,
    );
  await builder.getByRole("button", { name: "Review extension" }).click();
  const review = page.getByRole("dialog", { name: "Review AI changes" });
  const continued = review
    .frameLocator('iframe[title="Proposed scene"]')
    .frameLocator('iframe[title="Visual continuation"]')
    .locator("#continued");
  await expect(continued).toHaveText("0.00");
  await review.getByRole("button", { name: "Apply changes" }).click();
  await expect(
    page.getByRole("button", { name: "Continuation 1" }),
  ).toBeVisible();
  const sourceClip = page.getByRole("combobox", { name: "Source code clip" });
  const sourcePanel = page.locator(".code-workbench");
  const lines = sourcePanel.locator(".view-lines");
  await expect(sourceClip.locator("option:checked")).toHaveText(
    "Continuation 1 · 2.000s",
  );
  await expect(
    sourcePanel.getByText("Continuation source is read only."),
  ).toHaveCount(0);
  await sourcePanel.getByRole("button", { name: "HTML", exact: true }).click();
  await expect(lines).toContainText('id="continued"');
  await sourcePanel.getByRole("button", { name: "CSS", exact: true }).click();
  await expect(lines).toContainText("cyan");
  await sourcePanel.getByRole("button", { name: "JavaScript" }).click();
  await expect(lines).toContainText("toFixed(2)");
  await sourcePanel.getByRole("button", { name: "ALL", exact: true }).click();
  await expect(lines).toContainText("<!doctype html>");
  await expect(lines).toContainText('id="continued"');

  await sourceClip.selectOption({ label: "Original visual" });
  await expect(lines).toContainText('id="original"');
  await page.getByRole("button", { name: "Continuation 1" }).click();
  await expect(lines).toContainText('id="continued"');
  await page.locator('.track-clip[data-timeline-kind="scene"]').click();
  await expect(lines).toContainText('id="original"');
  await expect
    .poll(() => saved?.workflow?.scenes[0].visualContinuations?.[0]?.start)
    .toBe(2);
  expect(saved?.html).toBe(project.html);
  expect(saved?.css).toBe(project.css);
  expect(saved?.js).toBe(project.js);
  expect(
    saved?.audio?.map(({ id, start, trimIn, length }) => ({
      id,
      start,
      trimIn,
      length,
    })),
  ).toEqual(
    project.audio.map(({ id, start, trimIn, length }) => ({
      id,
      start,
      trimIn,
      length,
    })),
  );
  await page
    .getByRole("button", { name: "Undo project change", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continuation 1" }),
  ).toHaveCount(0);
  expect(reloadMessages).toEqual([]);
});
