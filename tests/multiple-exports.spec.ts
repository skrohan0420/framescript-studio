import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";

test("exports from three timelines keep separate progress, snapshots, cancellation and downloads", async ({
  page,
}) => {
  const p = newProject();
  p.name = "Multiple clips";
  p.html = '<h1 id="clip-a">First clip</h1>';
  p.css = "h1{color:white}";
  p.js = "";
  p.workflow = initialWorkflow(p);
  p.workflow.scenes[0].title = "First timeline";
  p.workflow.scenes.push({
    ...p.workflow.scenes[0],
    id: "second",
    title: "Second timeline",
    html: '<h1 id="clip-b">Second clip</h1>',
  });
  p.workflow.scenes.push({
    ...p.workflow.scenes[0],
    id: "third",
    title: "Third timeline",
    html: '<h1 id="clip-c">Third clip</h1>',
  });
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: p } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  const jobs: {
    id: string;
    project: any;
    options: any;
    stage: string;
    done: number;
    finish: (cancel?: boolean) => void;
  }[] = [];
  const cancelled: string[] = [];
  await page.route("**/api/events", (r) =>
    r.fulfill({
      contentType: "text/event-stream",
      body: jobs.length
        ? jobs
            .map(
              (j) =>
                "data: " +
                JSON.stringify({
                  jobId: j.id,
                  stage: j.stage,
                  done: j.done,
                  total: 100,
                }) +
                "\n\n",
            )
            .join("")
        : ": connected\n\n",
    }),
  );
  await page.route("**/api/export", async (r) => {
    const [project, options, id] = r.request().postDataJSON().args;
    let finish!: (cancel?: boolean) => void;
    const pending = new Promise<boolean | undefined>((resolve) => {
      finish = resolve;
    });
    jobs.push({
      id,
      project,
      options,
      stage: jobs.length === 2 ? "Queued" : "Rendering",
      done: jobs.length === 0 ? 25 : jobs.length === 1 ? 70 : 0,
      finish,
    });
    const cancel = await pending;
    await r.fulfill(
      cancel
        ? { status: 400, json: { result: { error: "Export cancelled" } } }
        : {
            json: {
              result: {
                url: "/api/download/" + id,
                name: options.fileName + ".mp4",
              },
            },
          },
    );
  });
  await page.route("**/api/download/*", (r) =>
    r.fulfill({ body: "rendered clip", contentType: "video/mp4" }),
  );
  await page.route("**/api/cancelExport", (r) => {
    const [id] = r.request().postDataJSON().args;
    cancelled.push(id);
    jobs.find((j) => j.id === id)?.finish(true);
    return r.fulfill({ json: { result: true } });
  });
  await page.goto("/#editor");
  const timelines = page.getByRole("tablist", {
    name: "Timelines",
    exact: true,
  });
  const dialog = page.getByRole("dialog", { name: "Export animation" });
  for (let i = 0; i < 3; i++) {
    await timelines.getByRole("tab").nth(i).click();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await dialog
      .getByLabel("Export file name")
      .fill(["Clip A", "Clip B", "Clip C"][i]);
    await dialog
      .getByRole("button", { name: "Render & download", exact: true })
      .click();
    await expect.poll(() => jobs.length).toBe(i + 1);
    await dialog.getByRole("button", { name: "Minimize export" }).click();
  }
  const dock = page.getByRole("region", { name: "Background export" });
  const a = dock.getByRole("article", { name: "Clip A.mp4" }),
    b = dock.getByRole("article", { name: "Clip B.mp4" }),
    c = dock.getByRole("article", { name: "Clip C.mp4" });
  const activity = page.locator(".status-bar .status-activity");
  await expect(activity).toContainText(/Clip A\.mp4[^|]*25%/);
  await expect(activity).toContainText(/Clip B\.mp4[^|]*70%/);
  await expect(activity).toContainText(/Clip C\.mp4[^|]*Queued/);
  await expect(a.getByRole("progressbar")).toHaveAttribute("value", "25");
  await expect(b.getByRole("progressbar")).toHaveAttribute("value", "70");
  await expect(c).toContainText("Queued");
  expect(new Set(jobs.map((j) => j.id)).size).toBe(3);
  expect(jobs.map((j) => j.project.html)).toEqual([
    p.html,
    p.workflow.scenes[1].html,
    p.workflow.scenes[2].html,
  ]);
  await expect(a).toContainText("First timeline");
  await expect(b).toContainText("Second timeline");
  await expect(c).toContainText("Third timeline");
  const original = (await dock.boundingBox())!;
  expect(original.width).toBeLessThanOrEqual(322);
  expect(original.height).toBeLessThan(300);
  const header = page.getByLabel("Move export panel", { exact: true });
  const grip = (await header.boundingBox())!;
  await page.mouse.move(grip.x + 40, grip.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip.x - 210, grip.y - 180, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await dock.boundingBox())!.x)
    .toBeLessThan(original.x - 100);
  await header.focus();
  await page.keyboard.press("ArrowLeft");
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect
    .poll(async () => {
      const box = (await dock.boundingBox())!;
      return (
        box.x >= 8 &&
        box.y >= 8 &&
        box.x + box.width <= 992 &&
        box.y + box.height <= 692
      );
    })
    .toBe(true);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: "test-results/multiple-exports.png" });
  await b.getByRole("button", { name: "Cancel export Clip B.mp4" }).click();
  await expect(b).toContainText("Cancelled");
  expect(cancelled).toEqual([jobs[1].id]);
  await expect(activity).toContainText(/Clip A\.mp4[^|]*Rendering/);
  await expect(activity).toContainText(/Clip C\.mp4[^|]*Queued/);
  const firstDownload = page.waitForEvent("download");
  jobs[0].finish();
  expect((await firstDownload).suggestedFilename()).toBe("Clip A.mp4");
  await expect(a).toContainText("Complete");
  await expect(
    a.getByRole("button", { name: "Download", exact: true }),
  ).toBeVisible();
  jobs[2].stage = "Rendering";
  jobs[2].done = 42;
  await dock.getByRole("button", { name: "Minimize exports panel" }).click();
  await expect(c.getByRole("progressbar")).toBeVisible();
  await expect(c.getByRole("progressbar")).toHaveAttribute("value", "42");
  await expect(activity).toContainText(/Clip C\.mp4[^|]*42%/);
  await dock.getByRole("button", { name: "Expand exports panel" }).click();
  const finalDownload = page.waitForEvent("download");
  jobs[2].finish();
  expect((await finalDownload).suggestedFilename()).toBe("Clip C.mp4");
  await expect(c).toContainText("Complete");
  await expect(b).toContainText("Cancelled");
  await a.getByRole("button", { name: "Dismiss export Clip A.mp4" }).click();
  await expect(dock.getByRole("article")).toHaveCount(2);
});
