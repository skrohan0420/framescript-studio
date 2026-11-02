import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { synthesizeSound } from "../shared/audio";

test("dedicated audio import accepts the file picker and drops without a provider connection", async ({
  page,
}) => {
  const p = newProject();
  p.workflow = {
    ...initialWorkflow(p),
    script: "Import the narration first and compose the scene to its length.",
  };
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: p } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: { theme: "light" } } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/mediaStatus", (r) =>
    r.fulfill({ json: { result: { eleven: false, gemini: false } } }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const section = page.getByRole("region", {
    name: "Audio library",
    exact: true,
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await section
    .getByRole("button", { name: "Import media", exact: true })
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "narration.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from(
      synthesizeSound("Success chime").data.split(",")[1],
      "base64",
    ),
  });
  await expect(page.locator(".audio-edit-clip")).toHaveCount(1);
  const bytes = synthesizeSound("Whoosh").data.split(",")[1];
  const drop = await page.evaluateHandle((base64) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(
        [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
        "replacement.wav",
        { type: "audio/wav" },
      ),
    );
    return transfer;
  }, bytes);
  await section
    .locator(".library-content")
    .dispatchEvent("drop", { dataTransfer: drop });
  await drop.dispose();
  await expect(page.locator(".audio-edit-clip")).toHaveCount(2);
  const invalid = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["Not audio"], "notes.txt", { type: "text/plain" }),
    );
    return transfer;
  });
  await section
    .locator(".library-content")
    .dispatchEvent("drop", { dataTransfer: invalid });
  await invalid.dispose();
  await expect(
    page.getByRole("status").filter({ hasText: "Choose an audio file" }),
  ).toContainText("audio");
  await expect(page.locator(".audio-edit-clip")).toHaveCount(2);
});
