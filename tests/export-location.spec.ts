import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
test("export chooses a filename and location before rendering and writes the result there", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).showSaveFilePicker = async (options: any) => {
      (window as any).__saveOptions = options;
      return {
        createWritable: async () => ({
          write: async (blob: Blob) => {
            (window as any).__savedContents = await blob.text();
          },
          close: async () => {
            (window as any).__saveClosed = true;
          },
          abort: async () => {},
        }),
      };
    };
  });
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: newProject() } }),
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
  let fileName = "";
  await page.route("**/api/export", (route) => {
    fileName = route.request().postDataJSON().args[1].fileName;
    return route.fulfill({
      json: {
        result: { url: "/api/download/location-test", name: fileName + ".mp4" },
      },
    });
  });
  await page.route("**/api/download/location-test", (route) =>
    route.fulfill({ body: "rendered-video-content", contentType: "video/mp4" }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Export animation",
    exact: true,
  });
  await dialog.getByLabel("Export file name").fill("My finished film");
  await dialog
    .getByRole("checkbox", { name: "Choose where to save export" })
    .check();
  await dialog
    .getByRole("button", { name: "Render & save", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__saveClosed))
    .toBe(true);
  expect(fileName).toBe("My finished film");
  expect(
    await page.evaluate(() => (window as any).__saveOptions.suggestedName),
  ).toBe("My finished film.mp4");
  expect(await page.evaluate(() => (window as any).__savedContents)).toBe(
    "rendered-video-content",
  );
});
