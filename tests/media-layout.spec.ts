import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
test("media dimensions control output and default image placement up to 4K", async ({
  page,
}) => {
  const project = newProject();
  project.html = "";
  project.css = "";
  project.js = "";
  project.assets = [
    {
      id: "media-test",
      name: "Test image",
      data:
        "data:image/svg+xml;base64," +
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
        ).toString("base64"),
    },
  ];
  let saved: any;
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) => {
    saved = r.request().postDataJSON().args[0];
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Media panel", exact: true }).click();
  const library = page.getByRole("region", { name: "Media library" });
  await expect(
    library.getByLabel("Output frame width", { exact: true }),
  ).toHaveValue("1920");
  await library
    .getByLabel("Output frame preset")
    .selectOption({ label: "4K UHD · 3840 × 2160" });
  await library
    .getByRole("button", { name: "Apply output frame dimensions" })
    .click();
  await expect.poll(() => saved?.settings.width).toBe(3840);
  await expect.poll(() => saved?.settings.height).toBe(2160);
  await library.getByText("Image insertion", { exact: false }).first().click();
  await expect(
    library.getByLabel("Image size width", { exact: true }),
  ).toHaveValue("3840");
  await expect(
    library.getByLabel("Image size width", { exact: true }),
  ).toBeDisabled();
  await library.getByRole("button", { name: "Insert image into HTML" }).click();
  await expect.poll(() => saved?.html).toContain("width:3840px;height:2160px");
  const image = page
    .frameLocator('iframe[title="Animation preview"]')
    .locator("img")
    .last();
  await expect(image).toHaveCSS("width", "3840px");
  await library
    .getByRole("checkbox", { name: "Use current frame size" })
    .uncheck();
  await library.getByLabel("Image size width", { exact: true }).fill("640");
  await library.getByLabel("Image size height", { exact: true }).fill("360");
  await library
    .getByRole("button", { name: "Apply image size dimensions" })
    .click();
  await library.getByLabel("Image fitting").selectOption("cover");
  await library.getByRole("button", { name: "Insert image into HTML" }).click();
  await expect
    .poll(() => saved?.html)
    .toContain("width:640px;height:360px;object-fit:cover");
  expect(saved.settings.width).toBe(3840);
  await library.getByLabel("Output frame width", { exact: true }).fill("5000");
  await library
    .getByRole("button", { name: "Apply output frame dimensions" })
    .click();
  await expect(library.getByRole("alert")).toContainText("Maximum size is 4K");
  await library.getByLabel("Output frame width", { exact: true }).fill("3840");
  await library.locator(".library-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: "test-results/media-dimensions.png" });
});
