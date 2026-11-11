import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/events", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body:
        "data: " +
        JSON.stringify({
          stage: "Rendering",
          done: 167,
          total: 684,
          destination: "test.mp4",
          diagnostics: {
            path: "browser",
            encoder: "h264_qsv",
            workers: 2,
            wallMs: 1200,
            cacheHits: 10,
            gpu: "Test GPU",
            bottleneck: "Frame capture / transfer",
            seekMs: 100,
            captureMs: 200,
          },
        }) +
        "\n\n",
    }),
  );
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
});

test("minimizing keeps export running, preserves its settings and leaves editing dialogs open on completion", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0,
    cancelled = 0,
    submitted: any;
  await page.route("**/api/export", async (r) => {
    requests++;
    submitted = r.request().postDataJSON().args;
    await pending;
    await r.fulfill({
      json: {
        result: {
          url: "/api/download/background-test",
          name: "Background film.mp4",
        },
      },
    });
  });
  await page.route("**/api/cancelExport", (r) => {
    cancelled++;
    return r.fulfill({ json: { result: true } });
  });
  await page.route("**/api/download/background-test", (r) =>
    r.fulfill({ body: "video", contentType: "video/mp4" }),
  );
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  await dialog.getByLabel("Export file name").fill("Background film");
  await dialog
    .getByRole("button", { name: "Render & download", exact: true })
    .click();
  await expect(
    dialog
      .locator(".modal-head")
      .getByRole("button", { name: "Minimize export" }),
  ).toBeVisible();
  const progressName = "Render progress for Background film.mp4";
  await expect(dialog.getByRole("progressbar", { name: progressName }))
    .toHaveAttribute("value", "167");
  await expect(dialog).toContainText("Rendering · 24% · 167/684 frames");
  await dialog.screenshot({ path: "test-results/export-header-controls.png" });
  await dialog.getByRole("button", { name: "Minimize export" }).click();
  await expect(dialog).toBeHidden();
  const dock = page.getByRole("region", { name: "Background export" });
  await expect(dock).toContainText("Background film.mp4");
  const activity = page.locator(".status-bar .status-activity");
  await expect(activity).toContainText("24%");
  const dockProgress = dock.getByRole("progressbar", { name: progressName });
  await expect(dockProgress).toHaveAttribute("value", "167");
  await dock
    .getByRole("button", { name: "Dismiss exports panel", exact: true })
    .click();
  await expect(activity).toContainText("24%");
  await expect(dockProgress).toBeVisible();
  await expect(dock).toContainText("Rendering · 24% · 167/684 frames");
  expect(cancelled).toBe(0);
  await dock
    .getByRole("button", { name: "Expand exports panel", exact: true })
    .click();
  await expect(activity).toBeVisible();
  await expect(
    dock.getByRole("button", { name: "Cancel all exports", exact: true }),
  ).toBeVisible();
  await expect(activity).toContainText("167/684 frames");
  await page
    .getByRole("textbox", { name: "Project name", exact: true })
    .fill("Editing while exporting");
  await page.screenshot({ path: "test-results/background-export.png" });
  await dock.getByRole("button", { name: /^Restore export / }).click();
  await expect(dialog.getByLabel("Export file name")).toHaveValue(
    "Background film",
  );
  await expect(dialog.getByLabel("Export file name")).toBeDisabled();
  await expect(dialog.getByRole("progressbar", { name: progressName }))
    .toHaveAttribute("value", "167");
  expect(requests).toBe(1);
  expect(cancelled).toBe(0);
  expect(submitted[0].name).toBe("Untitled animation");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Project settings", exact: true })
    .first()
    .click();
  const download = page.waitForEvent("download");
  release();
  expect((await download).suggestedFilename()).toBe("Background film.mp4");
  const settings = page.getByRole("dialog", {
    name: "Project & application settings",
  });
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dock).toContainText("Complete");
  await dock.getByText("Render details", { exact: true }).click();
  await expect(dock).toContainText("10 cached frames");
  await expect(dock).toContainText("Test GPU");
  await dock
    .getByRole("button", { name: "Dismiss exports panel", exact: true })
    .click();
  await expect(dock).toHaveCount(0);
});

test("background export can be restored from home and cancelled without losing the error", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/export", async (r) => {
    await pending;
    await r.fulfill({
      status: 400,
      json: { result: { error: "Export cancelled" } },
    });
  });
  await page.route("**/api/cancelExport", (r) => {
    release();
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  await dialog
    .getByRole("button", { name: "Render & download", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Minimize export" }).click();
  await page.getByRole("button", { name: "Project home", exact: true }).click();
  await expect(page).toHaveURL(/#home$/);
  const dock = page.getByRole("region", { name: "Background export" });
  await expect(dock).toBeVisible();
  await dock.getByRole("button", { name: /^Restore export / }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Minimize export" }).click();
  await dock.getByRole("button", { name: /^Cancel export / }).click();
  await expect(dock.getByRole("alert")).toHaveText("Export cancelled");
  await dock.getByRole("button", { name: /^Dismiss export / }).click();
  await expect(dock).toHaveCount(0);
});
