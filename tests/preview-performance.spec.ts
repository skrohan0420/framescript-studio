import { test, expect, type Page } from "@playwright/test";
import { newProject, type Project } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
async function open(page: Page, project: Project) {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
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
}
test("3D preview scales its GPU buffer, initializes once, and keeps export dimensions intact", async ({
  page,
}) => {
  const project = newProject();
  project.settings = {
    ...project.settings,
    width: 3840,
    height: 2160,
    fps: 60,
  };
  project.html =
    '<canvas id="scene" width="3840" height="2160"></canvas><output id="clock"></output>';
  project.js = `window.view=FrameScript3D.create({canvas:document.querySelector('canvas'),width:3840,height:2160,background:'#18375b'});const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({color:0xff9933}));view.scene.add(mesh);window.renderCount=0;window.renderFrame=t=>{window.renderCount++;mesh.rotation.y=t;view.render();document.querySelector('#clock').textContent=t.toFixed(2)};parent.postMessage({previewTestBoot:true},'*');`;
  await page.addInitScript(() => {
    if (window === top) {
      (window as any).previewBoots = 0;
      window.addEventListener("message", (e) => {
        if (e.data?.previewTestBoot) (window as any).previewBoots++;
      });
    }
  });
  await open(page, project);
  const frame = page.frameLocator('iframe[title="Animation preview"]');
  await expect(frame.locator("#clock")).toHaveText("0.00");
  await expect
    .poll(() => page.evaluate(() => (window as any).previewBoots))
    .toBe(1);
  const info = await frame.locator("canvas").evaluate((canvas) => ({
    width: (canvas as HTMLCanvasElement).width,
    height: (canvas as HTMLCanvasElement).height,
    logical: innerWidth,
    preserved: (canvas as HTMLCanvasElement)
      .getContext("webgl2")!
      .getContextAttributes()!.preserveDrawingBuffer,
  }));
  expect(info.height).toBeLessThanOrEqual(1080);
  expect(info.logical).toBe(3840);
  expect(info.preserved).toBe(false);
  const before = await frame
    .locator("canvas")
    .evaluate(() => (window as any).renderCount);
  await page
    .locator('iframe[title="Animation preview"]')
    .evaluate((element) => {
      for (let i = 0; i < 200; i++)
        (element as HTMLIFrameElement).contentWindow!.postMessage(
          { framescript: true, type: "seek", value: i / 20 },
          "*",
        );
    });
  await expect(frame.locator("#clock")).toHaveText("9.95");
  expect(
    (await frame
      .locator("canvas")
      .evaluate(() => (window as any).renderCount)) - before,
  ).toBeLessThan(200);
  await page.screenshot({ path: "test-results/preview-quality.png" });
  await page.getByRole("button", { name: "Run preview", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).previewBoots))
    .toBe(2);
  await expect(
    page.locator('iframe[title="Validating animation"]'),
  ).toHaveCount(0);
  await page
    .getByLabel("Preview quality", { exact: true })
    .selectOption("1080");
  await expect
    .poll(() =>
      frame.locator("canvas").evaluate((c) => (c as HTMLCanvasElement).height),
    )
    .toBe(1080);
  await page
    .getByRole("slider", { name: "Timeline position", exact: true })
    .fill("2.5");
  await expect(frame.locator("#clock")).toHaveText("2.50");
  await page
    .getByLabel("Preview quality", { exact: true })
    .selectOption("full");
  await expect
    .poll(() =>
      frame.locator("canvas").evaluate((c) => (c as HTMLCanvasElement).height),
    )
    .toBe(2160);
  expect(
    await frame
      .locator("canvas")
      .evaluate(
        (c) =>
          (c as HTMLCanvasElement).getContext("webgl2")!.getContextAttributes()!
            .preserveDrawingBuffer,
      ),
  ).toBe(true);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.locator(".export-output-summary")).toContainText(
    "3840 × 2160",
  );
  await expect(page.locator(".export-output-summary")).toContainText("60 fps");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByLabel("Preview quality", { exact: true })
    .selectOption("1080");
  await page.reload();
  await expect(page.getByLabel("Preview quality", { exact: true })).toHaveValue(
    "1080",
  );
});

test("combined preview loads only current and next scenes and seeks trimmed timelines correctly", async ({
  page,
}) => {
  const project = newProject();
  project.settings = { ...project.settings, duration: 2 };
  project.html = '<output id="clock"></output>';
  project.js =
    "window.renderFrame=t=>document.querySelector('#clock').textContent=t.toFixed(2)";
  project.workflow = initialWorkflow(project);
  project.workflow.scenes = Array.from({ length: 5 }, (_, i) => ({
    ...project.workflow!.scenes[0],
    id: "scene-" + i,
    title: "Timeline " + (i + 1),
    duration: 2,
    sourceOffset: 2 + i,
  }));
  project.workflow.selectedId = "scene-0";
  await open(page, project);
  await page
    .getByRole("button", { name: "Preview all timelines", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="Animation preview"]');
  await expect(frame.locator("iframe")).toHaveCount(2);
  await expect(
    frame.frameLocator('iframe[title="Timeline preview 1"]').locator("#clock"),
  ).toHaveText("2.00");
  await page
    .getByRole("slider", { name: "Timeline position", exact: true })
    .fill("4.5");
  await expect(
    frame.frameLocator('iframe[title="Timeline preview 3"]').locator("#clock"),
  ).toHaveText("4.50");
  await expect(frame.locator("iframe")).toHaveCount(2);
  await expect(frame.locator('iframe[title="Timeline preview 1"]')).toHaveCount(
    0,
  );
  await page
    .getByRole("slider", { name: "Timeline position", exact: true })
    .fill("9.5");
  await expect(
    frame.frameLocator('iframe[title="Timeline preview 5"]').locator("#clock"),
  ).toHaveText("7.50");
  await expect(frame.locator("iframe")).toHaveCount(1);
});
