import { test, expect } from "@playwright/test";
import { structuredEditFixtureProject } from "./fixtures/structured-edit/project";
import type { Page } from "@playwright/test";

async function openFixture(page: Page) {
  const project = structuredEditFixtureProject();
  const scene = project.workflow!.scenes[0].structuredEdit!;
  await page.goto("/#editor");
  const setup = await page.request.post("/api/projectSave", {
    headers: { "X-FrameScript": "1" },
    data: { args: [project, { create: true }] },
  });
  expect(setup.ok()).toBe(true);
  await page.reload();
  await expect(
    page
      .frameLocator('iframe[title="Animation preview"]')
      .getByText(scene.title),
  ).toBeVisible();
  await page
    .locator(".track-clip")
    .getByText(scene.title, { exact: true })
    .click();
  await page.getByRole("button", { name: "Edit / Update" }).click();
  return { project, scene };
}

test("exports a frozen Edit task from a visual clip and saves it across reload", async ({
  page,
}) => {
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
  expect(await (await zip).failure()).toBeNull();
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
});
