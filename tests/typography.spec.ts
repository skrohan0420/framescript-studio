import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { textTemplates } from "../shared/typography";

test("text library captures scene styles and adds editable overlays with undo", async ({
  page,
}) => {
  const project = newProject();
  project.html = '<h1 id="heading">A new heading</h1>';
  project.css =
    "h1{font-family:Georgia;color:rgb(255,170,80);animation:appear 1s both}@keyframes appear{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}";
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
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Typography panel", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Typography templates" });
  await panel.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: /A new heading/ }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "All", exact: true }).click();
  await panel
    .getByRole("button", { name: "Use Rise up text template", exact: true })
    .click();
  await panel.getByLabel("Typography text").fill("Reusable title");
  await panel.getByLabel("Start (s)", { exact: true }).fill("1");
  await panel.getByLabel("End (s)", { exact: true }).fill("4");
  await panel
    .getByRole("button", { name: "Add to scene", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="Animation preview"]');
  await expect(frame.locator("[data-fs-text]")).toHaveText("Reusable title");
  const overlay = frame.locator("[data-fs-text]");
  const readLayer = () =>
    overlay.getAttribute("data-fs-text").then((value) => JSON.parse(value!));
  await expect(
    page.getByRole("region", { name: "Text timeline" }),
  ).toBeVisible();
  const beforeMove = await readLayer();
  const textBox = (await overlay.locator("span").boundingBox())!;
  await page.mouse.move(
    textBox.x + textBox.width / 2,
    textBox.y + textBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    textBox.x + textBox.width / 2 + 30,
    textBox.y + textBox.height / 2 + 20,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await readLayer()).x)
    .toBeGreaterThan(beforeMove.x);
  const beforeScale = await readLayer();
  const handle = overlay.getByRole("button", { name: "Scale text" });
  await expect(handle).toBeVisible();
  const handleBox = (await handle.boundingBox())!;
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 10,
    handleBox.y + handleBox.height / 2 + 20,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => (await readLayer()).size)
    .toBeGreaterThan(beforeScale.size);
  const timelineClip = page.getByRole("button", {
    name: "Move text Reusable title",
    exact: true,
  });
  const clipBox = (await timelineClip.boundingBox())!;
  await page.mouse.move(
    clipBox.x + clipBox.width / 2,
    clipBox.y + clipBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    clipBox.x + clipBox.width / 2 + 40,
    clipBox.y + clipBox.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect.poll(async () => (await readLayer()).start).toBeGreaterThan(1);
  await page.screenshot({ path: "test-results/typography-panel.png" });
  await panel.getByLabel("Typography text").fill("Updated title");
  await expect(
    panel.getByRole("button", { name: "Apply changes", exact: true }),
  ).toHaveCount(0);
  await expect(frame.locator("[data-fs-text]")).toHaveText("Updated title");
  await expect(frame.locator("[data-fs-text]")).toHaveCount(1);
  await page.getByRole("button", { name: /^Undo/ }).first().click();
  await expect(frame.locator("[data-fs-text]")).toHaveText("Reusable title");
});

test("export runtime seeks text timing deterministically including split source offsets", async ({
  page,
}) => {
  const project = newProject();
  const config = {
    id: "text-test",
    text: "Timing",
    template: textTemplates[0],
    x: 25,
    y: 75,
    width: 80,
    size: 60,
    color: "#fff",
    font: "Arial",
    align: "center",
    start: 2,
    end: 5,
    entrance: 1,
  };
  const encoded = JSON.stringify(config).replaceAll('"', "&quot;");
  project.html = `<div data-fs-text="${encoded}"><span>Timing</span></div>`;
  project.css = "";
  project.js = "window.renderFrame = () => {};";
  await page.setContent(
    documentFor(project, { export: true, sourceOffset: 2 }),
  );
  const layer = page.locator("[data-fs-text]");
  await expect(layer).toBeVisible();
  const opacity = () =>
    layer
      .locator("span")
      .evaluate((element) => getComputedStyle(element).opacity);
  await page.evaluate(() => (window as any).__fsSeek(1));
  expect(await opacity()).toBe("1");
  await page.evaluate(() => (window as any).__fsSeek(3));
  await expect(layer).toBeHidden();
  await page.evaluate(() => (window as any).__fsSeek(0));
  expect(await opacity()).toBe("0");
  await expect(layer).toHaveCSS("left", "400px");
});
