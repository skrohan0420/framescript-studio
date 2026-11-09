import { test, expect } from "@playwright/test";
import { structuredEditFixtureProject } from "./fixtures/structured-edit/project";
import type { Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resizeVisual, splitVisual } from "../shared/timeline-edit";
import { activateScene, selectedScene } from "../shared/workflow";
import { editSceneSchema } from "../shared/structured-edit";
import { structuredStarCode } from "../shared/structured-star";

test("picks the topmost rendered shape in scaled clip and combined previews", async ({ page }) => {
  const base = structuredEditFixtureProject();
  const clip = selectedScene(base)!;
  const scene = editSceneSchema.parse({
    ...clip.structuredEdit,
    star: undefined,
    label: undefined,
    objects: [
      {
        id: "moving-box", kind: "rectangle", x: 40, y: 70,
        width: 100, height: 80, color: "#0088ff", opacity: 1,
        tracks: [{ property: "x", keyframe: { id: "move", frame: 60, value: 200 } }],
      },
      {
        id: "ellipse", kind: "circle", x: 210, y: 100,
        width: 80, height: 60, color: "#ffffff", opacity: 1, tracks: [],
      },
    ],
  });
  const code = structuredStarCode(scene);
  const project = {
    ...base,
    ...code,
    workflow: { ...base.workflow!, scenes: [{ ...clip, ...code, structuredEdit: scene }] },
  };
  const split = { ...project, ...splitVisual(project, clip.id, 1) };
  const right = split.workflow!.scenes[1];
  await page.goto("/");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Open .frame file" }).click(),
  ]);
  await chooser.setFiles({
    name: "shape-selection.frame",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...split, ...activateScene(split, right.id) })),
  });

  const preview = page.frameLocator('iframe[title="Animation preview"]');
  const arrow = page.getByRole("button", { name: "Select element", exact: true });
  const playhead = page.getByRole("slider", { name: "Timeline position" });
  const inspector = page.getByRole("region", { name: "Shape inspector" });
  const picker = inspector.getByLabel("Shape", { exact: true });
  const outline = preview.locator("[data-fs-shape-outline]");
  const clickSource = async (canvas: ReturnType<typeof preview.locator>, x: number, y: number) => {
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + x * box.width / scene.width, box.y + y * box.height / scene.height);
  };

  await arrow.click();
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await playhead.fill("0.5");
  await expect(outline).toHaveCSS("left", "160px");
  const canvas = preview.locator("canvas");
  expect(Math.abs((await canvas.boundingBox())!.width - scene.width)).toBeGreaterThan(10);
  await clickSource(canvas, 210, 100);
  await expect(picker).toHaveValue("ellipse");
  await expect(outline).toHaveAttribute("data-fs-shape-outline", "ellipse");
  await expect(inspector.getByLabel("Width (px)")).toHaveValue("80");

  // Inside both bounding boxes, but outside the ellipse itself.
  await clickSource(canvas, 175, 74);
  await expect(picker).toHaveValue("moving-box");
  await expect(outline).toHaveAttribute("data-fs-shape-outline", "moving-box");
  await clickSource(canvas, 50, 90);
  await expect(picker).toHaveValue("");
  await expect(outline).toHaveCount(0);
  await picker.selectOption("moving-box");
  await expect(outline).toHaveCSS("left", "160px");
  await playhead.fill("1");
  await expect(outline).toHaveCSS("left", "200px");
  await playhead.fill("0");
  await expect(outline).toHaveCSS("left", "120px");

  await page.getByRole("button", { name: "Preview all timelines" }).click();
  await arrow.click();
  const first = preview.frameLocator('iframe[title="Timeline preview 1"]');
  await expect(first.locator("canvas")).toBeVisible();
  await clickSource(first.locator("canvas"), 210, 100);
  await expect(picker).toHaveValue("ellipse");
  await expect(first.locator("[data-fs-shape-outline]")).toHaveAttribute("data-fs-shape-outline", "ellipse");
  await expect(page.getByRole("tab", { name: /^1 ·/ })).toHaveAttribute("aria-selected", "true");

  await playhead.fill("1.5");
  const second = preview.frameLocator('iframe[title="Timeline preview 2"]');
  await expect(second.locator("canvas")).toBeVisible();
  await clickSource(second.locator("canvas"), 175, 74);
  await expect(picker).toHaveValue("moving-box");
  await expect(second.locator("[data-fs-shape-outline]")).toHaveCSS("left", "160px");
  await expect(page.getByRole("tab", { name: /^2 ·/ })).toHaveAttribute("aria-selected", "true");
});

test("edits shape base values and keyframes in the inspector with clip scope and history", async ({
  page,
}) => {
  const base = structuredEditFixtureProject();
  const clip = selectedScene(base)!;
  const scene = editSceneSchema.parse({
    ...clip.structuredEdit,
    star: undefined,
    label: undefined,
    objects: [{
      id: "signal",
      kind: "rectangle",
      x: 20,
      y: 40,
      width: 30,
      height: 30,
      color: "#0088ff",
      opacity: 1,
      tracks: [{ property: "x", keyframe: { id: "move", frame: 30, value: 100 } }],
    }, {
      id: "dot",
      kind: "circle",
      x: 400,
      y: 50,
      width: 40,
      height: 40,
      color: "#ffffff",
      opacity: 0.5,
      tracks: [],
    }],
  });
  const code = structuredStarCode(scene);
  const project = {
    ...base,
    ...code,
    workflow: {
      ...base.workflow!,
      scenes: [{ ...clip, ...code, structuredEdit: scene }],
    },
  };
  const split = { ...project, ...splitVisual(project, clip.id, 2) };
  const [left, right] = split.workflow!.scenes;
  await page.goto("/");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Open .frame file" }).click(),
  ]);
  await chooser.setFiles({
    name: "shape-inspector.frame",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(split)),
  });
  await page.getByRole("button", { name: "Properties", exact: true }).click();
  const inspector = page.getByRole("region", { name: "Shape inspector" });
  const picker = inspector.getByLabel("Shape", { exact: true });
  await expect(picker).toHaveValue("signal");
  await picker.selectOption("dot");
  await expect(inspector.getByLabel("Width (px)")).toHaveValue("40");
  await expect(inspector.getByLabel("Opacity (0–1)")).toHaveValue("0.5");
  await picker.selectOption("signal");
  await expect(inspector.getByLabel("Shape edit scope")).toHaveValue("clip");
  const baseX = inspector.getByLabel("X position (px)", { exact: true });
  await baseX.fill("50");
  await baseX.press("Enter");

  const preview = page.frameLocator('iframe[title="Animation preview"]').locator("canvas");
  const pixel = (x: number) =>
    preview.evaluate((canvas, x) =>
      Array.from((canvas as HTMLCanvasElement).getContext("2d")!.getImageData(x, 45, 1, 1).data),
    x);
  await expect.poll(() => pixel(55)).toEqual([0, 136, 255, 255]);
  await expect.poll(() => pixel(25)).toEqual([8, 13, 32, 255]);
  const values = inspector.getByLabel("Edit shape values");
  await values.selectOption("keyframe");
  const keyX = inspector.getByLabel(/X position.*keyframe/);
  await expect(keyX).toHaveValue("100");
  await keyX.fill("150");
  await keyX.press("Enter");
  await page.getByRole("slider", { name: "Timeline position" }).fill("1");
  await expect.poll(() => pixel(155)).toEqual([0, 136, 255, 255]);

  const undo = page.getByRole("button", { name: "Undo project change" });
  const redo = page.getByRole("button", { name: "Redo project change" });
  await undo.click();
  await expect(keyX).toHaveValue("100");
  await expect.poll(() => pixel(105)).toEqual([0, 136, 255, 255]);
  await redo.click();
  await expect(keyX).toHaveValue("150");
  await expect.poll(() => pixel(155)).toEqual([0, 136, 255, 255]);

  const savedClips = async () => {
    const response = await page.request.post("/api/workspaceGet", {
      headers: { "X-FrameScript": "1" },
      data: { args: [] },
    });
    return (await response.json()).result?.workflow?.scenes;
  };
  await expect.poll(savedClips).toEqual([
    expect.objectContaining({
      id: left.id,
      structuredEdit: expect.objectContaining({
        sceneId: expect.not.stringMatching(new RegExp(`^${scene.sceneId}$`)),
        revision: scene.revision + 2,
        objects: [expect.objectContaining({
          x: 50,
          tracks: [{ property: "x", keyframe: { id: "move", frame: 30, value: 150 } }],
        }), scene.objects![1]],
      }),
    }),
    right,
  ]);
  await undo.click();
  await undo.click();
  await values.selectOption("base");
  await inspector.getByLabel("Shape edit scope").selectOption("shared");
  const fill = inspector.getByLabel("Fill color (hex)");
  await fill.fill("red");
  await fill.press("Enter");
  await expect(inspector.getByRole("alert")).toContainText("six-digit hex color");
  await fill.fill("#ff0000");
  await fill.press("Enter");
  await expect.poll(async () => (await savedClips())?.map((clip: typeof left) => ({
    sceneId: clip.structuredEdit?.sceneId,
    color: clip.structuredEdit?.objects?.[0].color,
  }))).toEqual([
    { sceneId: scene.sceneId, color: "#ff0000" },
    { sceneId: scene.sceneId, color: "#ff0000" },
  ]);

  const openSettings = page.getByRole("contentinfo").getByRole("button", { name: "Project settings" });
  await openSettings.click();
  const settings = page.getByRole("dialog", { name: "Project & application settings" });
  await settings.getByLabel("Workspace save mode").selectOption("manual");
  await settings.getByRole("button", { name: "Close", exact: true }).first().click();
  const width = inspector.getByLabel("Width (px)");
  await expect.poll(() => pixel(145)).toEqual([8, 13, 32, 255]);
  await width.fill("60");
  await width.press("Enter");
  await expect.poll(() => pixel(145)).toEqual([255, 0, 0, 255]);
  await undo.click();
  await expect(width).toHaveValue("30");
  await expect.poll(() => pixel(145)).toEqual([8, 13, 32, 255]);
  await redo.click();
  await expect(width).toHaveValue("60");
  await expect.poll(() => pixel(145)).toEqual([255, 0, 0, 255]);
  await openSettings.click();
  const autosaveRestored = page.waitForResponse((response) =>
    response.url().endsWith("/api/settingsSet") &&
    response.request().postData()?.includes('"autosave":true') === true,
  );
  await settings.getByLabel("Workspace save mode").selectOption("auto");
  await autosaveRestored;
});

test("continues a trimmed clip from its handoff and restores the original with Undo", async ({
  page,
}) => {
  const base = structuredEditFixtureProject();
  const split = { ...base, ...splitVisual(base, base.workflow!.selectedId, 2) };
  const [left, right] = split.workflow!.scenes;
  await openFixture(page, split);
  await page
    .getByRole("dialog", { name: "Edit / Update" })
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Extend", exact: true }).click();
  await page.getByRole("button", { name: "Generate continuation" }).click();
  const panel = page.getByRole("dialog", { name: "Generate continuation" });
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/structuredExtendPackage"),
  );
  const zip = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download Extend ZIP" }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  const { result } = await response.json();
  expect(await (await zip).failure()).toBeNull();
  expect(result.prompt).toContain("Return one JavaScript module");
  const extension = {
    contractVersion: "1",
    type: "scene-extension",
    requestId: result.requestId,
    sceneId: left.structuredEdit!.sceneId,
    baseRevision: 14,
    startFrame: 60,
    endFrame: 90,
    value: 0.9,
  };
  await panel
    .getByLabel("Paste AI extension")
    .fill(JSON.stringify({ ...extension, startFrame: 59 }));
  await panel.getByRole("button", { name: "Review extension" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "must match the saved request",
  );
  await panel.getByLabel("Paste AI extension").fill("");
  await panel.getByLabel("Upload extension result").setInputFiles({
    name: "continuation.mjs",
    mimeType: "text/javascript",
    buffer: Buffer.from(`export default ${JSON.stringify(extension)};`),
  });
  await panel.getByRole("button", { name: "Review extension" }).click();
  const review = page.getByRole("dialog", { name: "Review AI changes" });
  await expect(review).toContainText("Continue from 2.000s to 3.000s");
  expect(
    await review.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  const before = page
    .frameLocator('iframe[title="Current scene"]')
    .locator("canvas");
  const after = page
    .frameLocator('iframe[title="Proposed scene"]')
    .locator("canvas");
  const frame = (canvas: HTMLCanvasElement) => canvas.toDataURL();
  const slider = review.getByRole("slider", { name: "Comparison time" });
  await slider.fill("1");
  for (const canvas of [before, after]) {
    await expect
      .poll(() =>
        canvas.evaluate(
          () =>
            (window as Window & { __fsTime?: () => number }).__fsTime?.() ?? -1,
        ),
      )
      .toBeCloseTo(1, 5);
  }
  await expect
    .poll(
      async () =>
        (await before.evaluate(frame)) === (await after.evaluate(frame)),
    )
    .toBe(true);
  await slider.fill("2.9");
  await expect
    .poll(
      async () =>
        (await before.evaluate(frame)) !== (await after.evaluate(frame)),
    )
    .toBe(true);
  const apply = review.getByRole("button", { name: "Apply changes" });
  await expect(apply).toBeDisabled();
  await review
    .getByRole("checkbox", { name: /Move following clips later by 1.000s/ })
    .check();
  await apply.click();
  const savedClips = async () => {
    const response = await page.request.post("/api/workspaceGet", {
      headers: { "X-FrameScript": "1" },
      data: { args: [] },
    });
    return (await response.json()).result.workflow.scenes;
  };
  const extendedClips = [
    expect.objectContaining({
      id: left.id,
      duration: 3,
      structuredEdit: expect.objectContaining({
        sceneId: result.requestId,
        revision: 15,
        continuation: { startFrame: 60, endFrame: 90, value: 0.9 },
      }),
    }),
    right,
  ];
  await expect.poll(savedClips).toEqual(extendedClips);
  await page.getByRole("button", { name: "Undo project change" }).click();
  await expect.poll(savedClips).toEqual([left, right]);
  await page.getByRole("button", { name: "Redo project change" }).click();
  await expect.poll(savedClips).toEqual(extendedClips);
});

test("generates, edits and exports a shapes-only scene through the module workflow", async ({
  page,
}) => {
  const { scene } = await openFixture(page);
  await page
    .getByRole("dialog", { name: "Edit / Update" })
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await page.getByRole("button", { name: "Generate structured scene" }).click();
  const panel = page.getByRole("dialog", { name: "Generate structured scene" });
  await panel
    .getByLabel("Scene brief")
    .fill("Create a scene named New Galaxy with shapes only.");
  const response = page.waitForResponse((item) =>
    item.url().endsWith("/api/structuredGeneratePackage"),
  );
  await panel.getByLabel("Reference images and example code").setInputFiles([
    {
      name: "look.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=",
        "base64",
      ),
    },
    {
      name: "example.js",
      mimeType: "text/javascript",
      buffer: Buffer.from("// Motion reference"),
    },
  ]);
  await expect(panel).toContainText("example.js");
  const zip = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download ZIP" }).click();
  const packaged = await response;
  expect(packaged.ok(), await packaged.text()).toBe(true);
  const { result } = await packaged.json();
  expect(await (await zip).failure()).toBeNull();
  await expect(panel.getByLabel("Exported Generate prompt")).toContainText(
    "Create a scene named New Galaxy with shapes only.",
  );
  const saved = await page.request.post("/api/structuredGenerateRequest", {
    headers: { "X-FrameScript": "1" },
    data: { args: [result.requestId] },
  });
  const { input } = (await saved.json()).result;
  expect(input.references).toHaveLength(2);
  expect(result.prompt).toContain("references/images/1.png");
  expect(result.prompt).toContain("references/example-code/2.txt");
  expect(result.prompt).toContain("Return one JavaScript module");
  const generated = {
    ...scene,
    sceneId: result.requestId,
    revision: 1,
    title: "New Galaxy",
    width: input.width,
    height: input.height,
    fps: input.fps,
    durationFrames: input.durationFrames,
    star: undefined,
    label: undefined,
    objects: [
      {
        id: "planet",
        kind: "circle",
        x: 20,
        y: 40,
        width: 60,
        height: 60,
        color: "#0088ff",
        opacity: 1,
        tracks: [
          { property: "x", keyframe: { id: "move", frame: 30, value: 100 } },
        ],
      },
      {
        id: "panel",
        kind: "rectangle",
        x: 80,
        y: 120,
        width: 100,
        height: 40,
        color: "#ff8800",
        opacity: 0,
        tracks: [
          {
            property: "opacity",
            keyframe: { id: "fade", frame: 60, value: 1 },
          },
        ],
      },
    ],
  };
  const resultText = panel.getByLabel("Paste generated scene code");
  const submit = panel.getByRole("button", { name: "Review scene result" });
  const responseFor = (width: number) =>
    JSON.stringify({
      contractVersion: "1",
      type: "new-scene",
      requestId: result.requestId,
      scene: { ...generated, width },
    });
  await resultText.fill(responseFor(generated.width + 2));
  await submit.click();
  await expect(panel.getByRole("alert")).toContainText(
    "must match the saved request",
  );
  const module = `export default ${responseFor(generated.width)};`;
  await resultText.fill(`${module}\nconsole.log("unexpected code");`);
  await submit.click();
  await expect(panel.getByRole("alert")).toContainText(
    "containing only export default",
  );
  await resultText.fill(`\`\`\`javascript\n${module}\n\`\`\``);
  await panel.getByLabel("Upload scene result").setInputFiles({
    name: "scene.mjs",
    mimeType: "text/javascript",
    buffer: Buffer.from(module),
  });
  await submit.click();
  const review = page.getByRole("dialog", { name: "Review AI changes" });
  await expect(review).toContainText("New timeline clip");
  await expect(review).toContainText("New Galaxy");
  const proposed = page.frameLocator('iframe[title="Proposed scene"]');
  await expect(proposed.locator("#galaxy-label")).toHaveCount(0);
  await review.getByRole("slider", { name: "Comparison time" }).fill("2");
  const proposedCanvas = page
    .frameLocator('iframe[title="Proposed scene"]')
    .locator("canvas");
  await expect
    .poll(() =>
      proposedCanvas.evaluate((canvas) =>
        Array.from(
          (canvas as HTMLCanvasElement)
            .getContext("2d")!
            .getImageData(100, 40, 1, 1).data,
        ),
      ),
    )
    .toEqual([0, 136, 255, 255]);
  await expect
    .poll(() =>
      proposedCanvas.evaluate((canvas) =>
        Array.from(
          (canvas as HTMLCanvasElement)
            .getContext("2d")!
            .getImageData(90, 130, 1, 1).data,
        ),
      ),
    )
    .toEqual([255, 136, 0, 255]);
  await review.getByRole("button", { name: "Apply changes" }).click();
  await page
    .locator(".track-clip")
    .getByText("New Galaxy", { exact: true })
    .click();
  await page.getByRole("button", { name: "Edit / Update" }).click();
  const edit = page.getByRole("dialog", { name: "Edit / Update" });
  await expect(edit).toContainText("Source revision 1");
  await expect(edit.getByLabel("planet.x at 1.000s")).toHaveValue("100");
  await edit.getByLabel("planet.x at 1.000s").fill("320");
  await expect(
    edit.getByRole("button", { name: "Download ZIP" }),
  ).toBeEnabled();
  const editResponse = page.waitForResponse((item) =>
    item.url().endsWith("/api/structuredEditPackage"),
  );
  await edit.getByRole("button", { name: "Download ZIP" }).click();
  const editPackage = await editResponse;
  expect(editPackage.ok(), await editPackage.text()).toBe(true);
  const { result: editTask } = await editPackage.json();
  expect(editTask.prompt).toContain("return one JavaScript module");
  expect(editTask.prompt).toContain(
    "references/preview-frames/keyframe-1.000s.png",
  );
  await edit.getByRole("button", { name: "Import AI result" }).click();
  const intake = page.getByRole("dialog", { name: "Import AI result" });
  await intake.getByLabel("Paste AI result").fill(
    `export default ${JSON.stringify({
      contractVersion: "1",
      type: "scene-patch",
      requestId: editTask.requestId,
      sceneId: generated.sceneId,
      baseRevision: 1,
      operations: [
        {
          op: "set-keyframe-value",
          nodeId: "planet",
          property: "x",
          keyframeId: "move",
          value: 320,
        },
      ],
    })};`,
  );
  await intake.getByRole("button", { name: "Review result" }).click();
  await expect(review).toContainText("planet.x at 1.000s: 100 → 320");
  await review.getByRole("button", { name: "Apply changes" }).click();
  await page.getByRole("button", { name: "Extend", exact: true }).click();
  const extend = page.getByRole("dialog", { name: "Extend clip" });
  await expect(extend.getByRole("button", { name: "Generate continuation" })).toHaveCount(0);
  await extend.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("slider", { name: "Timeline position" }).fill("2");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exportDialog = page.getByRole("dialog", { name: "Export animation" });
  await exportDialog.getByLabel("Export format").selectOption("png");
  const [png] = await Promise.all([
    page.waitForEvent("download"),
    exportDialog.getByRole("button", { name: "Render & download" }).click(),
  ]);
  const exportedPixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = "data:image/png;base64," + base64;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return [[320, 40], [90, 130], [320, 180]].map(([x, y]) =>
      Array.from(context.getImageData(x, y, 1, 1).data),
    );
  }, (await readFile(await png.path())).toString("base64"));
  expect(exportedPixels).toEqual([
    [0, 136, 255, 255],
    [255, 136, 0, 255],
    [8, 13, 32, 255],
  ]);
  const undo = page.getByRole("button", { name: "Undo project change" });
  await undo.click();
  await expect(page.locator(".track-clip")).toContainText("New Galaxy");
  await undo.click();
  await expect(page.locator(".track-clip")).toContainText(scene.title);
});

test("reveals existing source only after confirming later clip movement", async ({
  page,
}) => {
  const base = structuredEditFixtureProject();
  const split = { ...base, ...splitVisual(base, base.workflow!.selectedId, 2) };
  const [left, right] = split.workflow!.scenes;
  await openFixture(page, split);
  await page
    .getByRole("dialog", { name: "Edit / Update" })
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Extend", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "Extend clip" });
  await expect(panel).toContainText(
    "Handoff at source 2.000s · combined timeline 2.000s",
  );
  await expect(panel).toContainText("Last source frame before handoff: 59");
  const amount = panel.getByLabel("Source seconds to reveal");
  const apply = panel.getByRole("button", { name: "Reveal source time" });
  await amount.fill("4.1");
  await expect(apply).toBeDisabled();
  await amount.fill("0.5");
  const confirm = panel.getByRole("checkbox", {
    name: /Move following clips later by 0.500s/,
  });
  await expect(apply).toBeDisabled();
  await confirm.check();
  await expect(apply).toBeEnabled();
  await amount.fill("0.75");
  await expect(apply).toBeDisabled();
  await panel
    .getByRole("checkbox", { name: /Move following clips later by 0.750s/ })
    .check();
  await apply.click();
  await expect(panel).toBeHidden();
  const savedClips = async () => {
    const response = await page.request.post("/api/workspaceGet", {
      headers: { "X-FrameScript": "1" },
      data: { args: [] },
    });
    return (await response.json()).result.workflow.scenes;
  };
  await expect.poll(savedClips).toEqual([{ ...left, duration: 2.75 }, right]);
  await page.getByRole("button", { name: "Undo project change" }).click();
  await expect.poll(savedClips).toEqual([left, right]);
});

async function openFixture(
  page: Page,
  project = structuredEditFixtureProject(),
) {
  const clip = selectedScene(project)!;
  const scene = clip.structuredEdit!;
  await page.goto("/");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Open .frame file" }).click(),
  ]);
  await chooser.setFiles({
    name: "fireworks-galaxy.frame",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')
      .getByText(scene.title),
  ).toBeVisible();
  await page
    .locator(".track-clip")
    .getByText(clip.title, { exact: true })
    .click();
  await page.getByRole("button", { name: "Edit / Update" }).click();
  return { project, scene };
}

test("exports a frozen Edit task from a visual clip and saves it across reload", async ({
  page,
}, testInfo) => {
  const { project, scene } = await openFixture(page);
  const panel = page.getByRole("dialog", { name: "Edit / Update" });
  await expect(panel.getByText(/Source revision 14/)).toBeVisible();
  const copy = panel.getByRole("button", { name: "Copy prompt" });
  await expect(copy).toBeDisabled();
  const packageResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/structuredEditPackage"),
  );
  const zip = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download ZIP" }).click();
  const response = await packageResponse;
  expect(response.ok(), await response.text()).toBe(true);
  const { result } = await response.json();
  const downloaded = await zip;
  expect(await downloaded.failure()).toBeNull();
  await downloaded.saveAs(testInfo.outputPath("editor-exported-edit.zip"));
  await writeFile(
    testInfo.outputPath("editor-exported-prompt.txt"),
    result.prompt,
  );
  await expect(copy).toBeEnabled();
  await expect(
    panel.getByRole("textbox", { name: "Exported prompt" }),
  ).toHaveValue(result.prompt);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await copy.click();
  await expect(panel.getByRole("status")).toHaveText("Prompt copied.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.replaceAll("\r\n", "\n")).toBe(result.prompt);
  await panel.getByRole("spinbutton").fill("0.9");
  await expect(copy).toBeDisabled();
  await page.reload();
  const stored = await page.request.post("/api/structuredEditRequest", {
    headers: { "X-FrameScript": "1" },
    data: { args: [result.requestId] },
  });
  expect(stored.ok()).toBe(true);
  expect((await stored.json()).result).toMatchObject({
    clipId: project.workflow!.selectedId,
    scope: "clip",
    scene,
    prompt: result.prompt,
    request: {
      requestId: result.requestId,
      baseRevision: 14,
      requestedValue: 0.8,
    },
    manifest: {
      files: expect.arrayContaining([
        expect.objectContaining({
          role: "required-evidence",
          frame: 96,
          sceneRevision: 14,
        }),
      ]),
    },
  });
});

for (const scope of ["clip", "shared"] as const)
  test(`edits the source keyframe in a trimmed split at double speed with ${scope} scope`, async ({
    page,
  }) => {
    const base = structuredEditFixtureProject();
    const leftId = base.workflow!.selectedId;
    const split = { ...base, ...splitVisual(base, leftId, 2) };
    const [left, right] = split.workflow!.scenes;
    const trimmed = { ...split, ...resizeVisual(split, right.id, 2.5) };
    const project = { ...trimmed, ...activateScene(trimmed, right.id) };
    project.settings = { ...project.settings, speed: 2 };
    const { scene } = await openFixture(page, project);
    const panel = page.getByRole("dialog", { name: "Edit / Update" });
    await expect(panel.getByLabel("Edit scope")).toHaveValue("clip");
    if (scope === "shared")
      await panel.getByLabel("Edit scope").selectOption(scope);
    await expect(panel).toContainText(
      "Source keyframe at 3.200s · 1.200s into this clip",
    );
    const exported = page.waitForResponse((response) =>
      response.url().endsWith("/api/structuredEditPackage"),
    );
    await panel.getByRole("button", { name: "Download ZIP" }).click();
    const response = await exported;
    expect(response.ok(), await response.text()).toBe(true);
    const { result } = await response.json();
    await panel.getByRole("button", { name: "Import AI result" }).click();
    const intake = page.getByRole("dialog", { name: "Import AI result" });
    await intake.getByRole("textbox", { name: "Paste AI result" }).fill(
      JSON.stringify({
        contractVersion: "1",
        type: "scene-patch",
        requestId: result.requestId,
        sceneId: scene.sceneId,
        baseRevision: scene.revision,
        operations: [
          {
            op: "set-keyframe-value",
            nodeId: scene.star!.id,
            property: "glowIntensity",
            keyframeId: scene.star!.keyframe.id,
            value: 0.8,
          },
        ],
      }),
    );
    await intake.getByRole("button", { name: "Review result" }).click();
    const review = page.getByRole("dialog", { name: "Review AI changes" });
    await expect(review).toContainText(
      "1.200s into the clip, 3.200s on the combined timeline",
    );
    if (scope === "shared") {
      await expect(review).toContainText("Fireworks Galaxy · 0.000s to 2.000s");
      await expect(review).toContainText(
        "Fireworks Galaxy (split) · 2.000s to 4.500s",
      );
    } else {
      await expect(review).toContainText(
        "Other clips keep their source: Fireworks Galaxy.",
      );
    }
    const glowFrame = (canvas: HTMLCanvasElement) => canvas.toDataURL();
    const candidate = page
      .frameLocator('iframe[title="Proposed scene"]')
      .locator("canvas");
    await expect
      .poll(() =>
        candidate.evaluate(
          () =>
            (window as Window & { __fsTime?: () => number }).__fsTime?.() ?? -1,
        ),
      )
      .toBeCloseTo(3.2, 5);
    const reviewedFrame = await candidate.evaluate(glowFrame);
    await review.getByRole("button", { name: "Apply changes" }).click();
    await page.getByRole("slider", { name: "Timeline position" }).fill("1.2");
    const preview = page
      .frameLocator('iframe[title="Animation preview"]')
      .locator("canvas");
    await expect.poll(() => preview.evaluate(glowFrame)).toBe(reviewedFrame);
    const savedClips = async () => {
      const response = await page.request.post("/api/workspaceGet", {
        headers: { "X-FrameScript": "1" },
        data: { args: [] },
      });
      return (await response.json()).result.workflow.scenes;
    };
    const editedSource = expect.objectContaining({
      revision: 15,
      star: expect.objectContaining({
        keyframe: { id: "glow-peak", frame: 96, value: 0.8 },
      }),
    });
    await expect.poll(savedClips).toEqual([
      scope === "shared"
        ? expect.objectContaining({
            id: left.id,
            duration: left.duration,
            structuredEdit: editedSource,
          })
        : left,
      expect.objectContaining({
        id: right.id,
        duration: 2.5,
        sourceOffset: 2,
        structuredEdit: editedSource,
      }),
    ]);
    const saved = await savedClips();
    if (scope === "shared") {
      expect(
        saved.map((clip: typeof left) => clip.structuredEdit?.sceneId),
      ).toEqual([scene.sceneId, scene.sceneId]);
      expect(saved[0].structuredEdit).toEqual(saved[1].structuredEdit);
    } else expect(saved[1].structuredEdit.sceneId).not.toBe(scene.sceneId);
    await page.getByRole("button", { name: "Undo project change" }).click();
    await expect.poll(savedClips).toEqual(project.workflow!.scenes);
  });

test("reviews paste, upload and combined results, and applies one undoable change", async ({
  page,
}) => {
  const { scene } = await openFixture(page);
  const panel = page.getByRole("dialog", { name: "Edit / Update" });
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/structuredEditPackage"),
  );
  await panel.getByRole("button", { name: "Download ZIP" }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  const { result } = await response.json();
  const patch = JSON.stringify({
    contractVersion: "1",
    type: "scene-patch",
    requestId: result.requestId,
    sceneId: scene.sceneId,
    baseRevision: 14,
    operations: [
      {
        op: "set-keyframe-value",
        nodeId: "star-core",
        property: "glowIntensity",
        keyframeId: "glow-peak",
        value: 0.8,
      },
    ],
  });
  const openIntake = () =>
    panel.getByRole("button", { name: "Import AI result" }).click();
  const intake = page.getByRole("dialog", { name: "Import AI result" });
  const pasted = intake.getByRole("textbox", { name: "Paste AI result" });
  const upload = intake.getByLabel("Upload result file");
  const validate = () =>
    intake.getByRole("button", { name: "Review result" }).click();
  const review = page.getByRole("dialog", { name: "Review AI changes" });
  const apply = review.getByRole("button", { name: "Apply changes" });
  const discard = () =>
    review.getByRole("button", { name: "Discard changes" }).click();
  const uploadPatch = () =>
    upload.setInputFiles({
      name: "patch.mjs",
      mimeType: "text/javascript",
      buffer: Buffer.from(`export default ${patch};`),
    });
  const seek = review.getByRole("slider", { name: "Comparison time" });

  await openIntake();
  await pasted.fill("{ broken");
  await validate();
  await expect(intake.getByRole("alert")).toContainText("one JSON patch");
  await expect(
    intake.getByRole("button", { name: "Copy repair prompt" }),
  ).toBeVisible();
  await pasted.fill("```json\n" + patch + "\n```");
  await validate();
  await expect(review).toContainText("Glow at 3.200s: 0.6 → 0.8");
  await expect(seek).toHaveValue("3.2");
  const currentCanvas = page
    .frameLocator('iframe[title="Current scene"]')
    .locator("canvas");
  const candidateCanvas = page
    .frameLocator('iframe[title="Proposed scene"]')
    .locator("canvas");
  const pixel = (canvas: HTMLCanvasElement) =>
    canvas.getContext("2d")!.getImageData(370, 180, 1, 1).data[2];
  await expect
    .poll(
      async () =>
        (await candidateCanvas.evaluate(pixel)) -
        (await currentCanvas.evaluate(pixel)),
    )
    .toBeGreaterThan(0);
  await discard();
  await expect(panel).toContainText("Source revision 14");

  await openIntake();
  await uploadPatch();
  await validate();
  await expect(apply).toBeEnabled();
  await discard();
  await expect(panel).toContainText("Source revision 14");

  await openIntake();
  await uploadPatch();
  await pasted.fill(patch.replace('"value":0.8', '"value":0.9'));
  await validate();
  await expect(intake.getByRole("alert")).toContainText("patches differ");
  await pasted.fill(patch);
  await validate();
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(review).toBeHidden();
  const undo = page.getByRole("button", { name: "Undo project change" });
  await undo.click();
  await page.getByRole("button", { name: "Edit / Update" }).click();
  await expect(panel).toContainText("Source revision 14");

  await openIntake();
  await pasted.fill(patch);
  await validate();
  await expect(review).toContainText("Glow at 3.200s: 0.6 → 0.8");
  await expect(apply).toBeEnabled();
  // Simulate a workspace change while the modal owns keyboard and pointer focus.
  await page
    .locator('button[aria-label="Redo project change"]')
    .evaluate((button: HTMLButtonElement) => button.click());
  await expect(review).toContainText(
    "AI base revision 14 · Current revision 15",
  );
  await expect(apply).toBeDisabled();
  await expect(
    review.getByRole("button", { name: "Export fresh task" }),
  ).toBeVisible();
  await review.getByRole("button", { name: "Export fresh task" }).click();
  await expect(panel).toContainText("Source revision 15");

  await expect
    .poll(async () => {
      const saved = await page.request.post("/api/workspaceGet", {
        headers: { "X-FrameScript": "1" },
        data: { args: [] },
      });
      const workspace = (await saved.json()).result;
      return workspace?.workflow?.scenes[0]?.structuredEdit;
    })
    .toEqual({
      ...scene,
      revision: 15,
      star: { ...scene.star, keyframe: { ...scene.star!.keyframe, value: 0.8 } },
    });

  await panel
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  const preview = page
    .frameLocator('iframe[title="Animation preview"]')
    .locator("canvas");
  const playhead = page.getByRole("slider", { name: "Timeline position" });
  const seekPreview = async (time: number) => {
    await playhead.fill(String(time));
    await expect
      .poll(() =>
        preview.evaluate(
          () =>
            (window as Window & { __fsTime?: () => number }).__fsTime?.() ?? -1,
        ),
      )
      .toBeCloseTo(time, 5);
    return preview.evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  };
  await seekPreview(1);
  const forward = await seekPreview(3.2);
  await seekPreview(4.5);
  expect(await seekPreview(3.2)).toBe(forward);
  await seekPreview(0);
  expect(await seekPreview(3.2)).toBe(forward);
  const previewGlow = await preview.evaluate((canvas: HTMLCanvasElement) => {
    const crop = document.createElement("canvas");
    crop.width = crop.height = 200;
    crop.getContext("2d")!.drawImage(canvas, 220, 80, 200, 200, 0, 0, 200, 200);
    return crop.toDataURL();
  });

  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exportDialog = page.getByRole("dialog", { name: "Export animation" });
  await exportDialog.getByLabel("Export format").selectOption("png");
  const [png] = await Promise.all([
    page.waitForEvent("download"),
    exportDialog.getByRole("button", { name: "Render & download" }).click(),
  ]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const pngPath = await png.path();
  const exportedGlow = await page.evaluate(
    async (base64) => {
      const image = new Image();
      image.src = "data:image/png;base64," + base64;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 200;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 220, 80, 200, 200, 0, 0, 200, 200);
      return {
        width: image.width,
        height: image.height,
        glow: canvas.toDataURL(),
      };
    },
    (await readFile(pngPath)).toString("base64"),
  );
  expect(exportedGlow).toEqual({
    width: scene.width,
    height: scene.height,
    glow: previewGlow,
  });
});
