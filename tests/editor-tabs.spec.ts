import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test("remembers the active tool and code tab across reloads", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({
      json: {
        result: { leftView: "audio", rightTab: "project", layoutVersion: 2 },
      },
    }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  const audio = page.getByRole("button", { name: "Audio panel", exact: true });
  await expect(audio).toHaveClass(/active/);
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await page
    .locator(".code-panel .editor-tabs button")
    .filter({ hasText: "CSS" })
    .click();
  await audio.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("framescript.editor-tabs.v1") ?? "{}")
            .leftView,
      ),
    )
    .toBe("audio");
  await page.reload();
  await expect(audio).toHaveClass(/active/);
  await page.getByRole("button", { name: "Code panel", exact: true }).click();
  await expect(
    page.locator(".code-panel .editor-tabs button").filter({ hasText: "CSS" }),
  ).toHaveClass(/active/);
});
