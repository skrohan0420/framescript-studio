import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
function readZipText(zip: Buffer, path: string) {
  const end = zip.lastIndexOf(Buffer.from("504b0506", "hex"));
  let entry = zip.readUInt32LE(end + 16);
  while (entry < end) {
    const nameLength = zip.readUInt16LE(entry + 28);
    const name = zip.toString("utf8", entry + 46, entry + 46 + nameLength);
    if (name === path) {
      const local = zip.readUInt32LE(entry + 42);
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const compressed = zip.subarray(start, start + zip.readUInt32LE(entry + 20));
      return inflateRawSync(compressed).toString("utf8");
    }
    entry += 46 + nameLength + zip.readUInt16LE(entry + 30) + zip.readUInt16LE(entry + 32);
  }
  throw Error(`${path} is missing from the generated ZIP.`);
}

test("director context and pasted direction reach downloaded ZIPs", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/api/workspaceGet", route => route.fulfill({ json: { result: newProject() } }));
  await page.route("**/api/settingsGet", route => route.fulfill({ json: { result: {} } }));
  await page.route("**/api/autosave", route => route.fulfill({ json: { result: true } }));
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Prompts panel", exact: true }).click();
  await page.locator(".brief-script-context > summary").click();
  await page.getByRole("textbox", { name: "Full video script", exact: true }).fill("A full story about planets and stars.");
  await page.getByLabel("Scene narration / timestamps", { exact: true }).fill("00:00:01.000 --> 00:00:03.000\nA violet planet appears.");
  await page.getByRole("tab", { name: "Identity", exact: true }).click();
  await page.getByLabel("Video theme & visual identity guide").fill("LOCK: Violet subjects on navy.");
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  await page.locator('#prompt-panel-output input[type="file"]').setInputFiles({
    name: "style.txt", mimeType: "text/plain", buffer: Buffer.from("Use navy and violet reference geometry"),
  });
  await page.getByRole("button", { name: "Copy Director Prompt", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("A full story about planets and stars.");
  const exportDirector = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download context ZIP (optional)", exact: true }).click();
  const directorZip = await readFile((await (await exportDirector).path())!);
  expect(readZipText(directorZip, "TASK.md")).toContain("A full story about planets and stars.");
  expect(readZipText(directorZip, "TASK.md")).toContain("LOCK: Violet subjects on navy.");
  expect(JSON.parse(readZipText(directorZip, "manifest.json")).mode).toBe("creative-direction");
  expect(readZipText(directorZip, "references/example-code/1.txt")).toBe("Use navy and violet reference geometry");
  const field=page.getByLabel("Selected creative direction", { exact: false });
  await field.fill("Reveal the violet planet at 1s, hold until 3s.");
  const finalButton=page.getByRole("button", { name: "Copy and Download", exact: true });
  await expect(finalButton).toBeEnabled();
  await expect(finalButton).toBeEnabled();
  const preview=await page.getByLabel("Generated prompt", { exact: true }).inputValue();
  const download=page.waitForEvent("download");
  await finalButton.click();
  const zip=await readFile((await (await download).path())!);
  const task=readZipText(zip,"TASK.md");
  expect(task).toBe(preview);
  expect(task).toContain("Reveal the violet planet at 1s");
  expect(task).toContain("FRAMESCRIPT REQUIREMENTS");
  expect(task).toContain("LOCK: Violet subjects on navy.");
  expect(readZipText(zip, "references/example-code/1.txt")).toContain("navy and violet");
  await field.fill("Changed direction");
  await expect(finalButton).toBeEnabled();
  await page.getByLabel("Output format", { exact: true }).selectOption("structured");
  const structuredDownload=page.waitForEvent("download");
  await finalButton.click();
  const structuredZip=await readFile((await (await structuredDownload).path())!);
  expect(readZipText(structuredZip,"TASK.md")).toContain("Changed direction");
  expect(readZipText(structuredZip,"OUTPUT_CONTRACT.md")).toContain("20 native circles or rectangles");
  expect(readZipText(structuredZip,"schemas/generate-result.schema.json")).toContain("sceneId");
  expect(readZipText(structuredZip,"references/example-code/1.txt")).toContain("navy and violet");
  await page.getByRole("tab", { name: "Brief", exact: true }).click();
  await page.getByRole("textbox", { name: "Full video script", exact: true }).fill("Revised whole-story context");
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  await expect(finalButton).toBeEnabled();
  await field.fill("");
  await expect(finalButton).toBeEnabled();
});
