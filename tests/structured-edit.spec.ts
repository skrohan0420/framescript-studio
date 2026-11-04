import { test, expect } from "@playwright/test";
import { structuredEditFixtureProject } from "./fixtures/structured-edit/project";

test("exports a frozen Edit task from a visual clip and saves it across reload", async ({
  page,
}) => {
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
