import { test, expect } from "@playwright/test";
import { structuredEditFixtureProject } from "./fixtures/structured-edit/project";
import type { Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resizeVisual, splitVisual } from "../shared/timeline-edit";
import { activateScene, selectedScene } from "../shared/workflow";

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

test("edits the source keyframe in a trimmed split at double speed without changing its sibling", async ({
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
          nodeId: scene.star.id,
          property: "glowIntensity",
          keyframeId: scene.star.keyframe.id,
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
  await expect(review).toContainText(
    "Other clips keep their source: Fireworks Galaxy.",
  );
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
  await expect.poll(savedClips).toEqual([
    left,
    expect.objectContaining({
      id: right.id,
      duration: 2.5,
      sourceOffset: 2,
      structuredEdit: expect.objectContaining({
        revision: 15,
        star: expect.objectContaining({
          keyframe: { id: "glow-peak", frame: 96, value: 0.8 },
        }),
      }),
    }),
  ]);
  expect((await savedClips())[1].structuredEdit.sceneId).not.toBe(
    scene.sceneId,
  );
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
      name: "patch.json",
      mimeType: "application/json",
      buffer: Buffer.from(patch),
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
      star: { ...scene.star, keyframe: { ...scene.star.keyframe, value: 0.8 } },
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
