import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { threeStarter } from "../shared/three-runtime";
import { renderExport } from "../server/export";
import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function fixture() {
  const project = newProject();
  project.html = '<canvas id="scene"></canvas>';
  project.css = "html,body{margin:0;width:100%;height:100%;overflow:hidden}";
  project.js = threeStarter.match(/<script>([\s\S]*?)<\/script>/)![1];
  project.settings = {
    ...project.settings,
    width: 320,
    height: 180,
    duration: 1,
    fps: 4,
    network: false,
  };
  return project;
}

test("animation controls persist, show delayed examples and generate compatible 3D instructions", async ({
  page,
}) => {
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: newProject() } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: {} } }),
  );
  await page.route("**/api/settingsSet", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await page.getByRole("tab", { name: "Animation", exact: true }).click();
  await page.getByLabel("Rendering mode", { exact: true }).selectOption("3d");
  const camera = page.getByRole("button", {
    name: "Camera movement",
    exact: true,
  });
  await camera.hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toContainText("Orbit a molecule");
  await camera.click();
  await page
    .getByLabel("Camera movement variation", { exact: true })
    .selectOption("Orbit");
  await page
    .getByLabel("Framing / travel", { exact: true })
    .fill("45 degrees clockwise");
  await page
    .getByRole("button", { name: "Assembly & disassembly", exact: true })
    .click();
  await page
    .getByLabel("Motion intensity", { exact: true })
    .selectOption("Subtle");
  await page.reload();
  await page
    .getByRole("button", { name: "Prompts panel", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Animation", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Rendering mode", { exact: true })).toHaveValue(
    "3d",
  );
  await expect(
    page.getByLabel("Framing / travel", { exact: true }),
  ).toHaveValue("45 degrees clockwise");
  await expect
    .poll(() =>
      page
        .locator(".prompt-drawer")
        .evaluate((el) =>
          el.getAnimations().every((a) => a.playState === "finished"),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: "test-results/animation-controls.png" });
  await page.setViewportSize({ width: 390, height: 850 });
  await expect.poll(() => page.locator(".prompt-drawer").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByRole("tab", { name: "Output", exact: true }).click();
  const prompt = await page.getByLabel("Generated prompt").inputValue();
  expect(prompt).toContain("True 3D");
  expect(prompt).toContain("45 degrees clockwise");
  expect(prompt).toContain("Shared intensity: Subtle");
  await page
    .getByRole("tabpanel", { name: "Output", exact: true })
    .getByRole("button", { name: "Paste full HTML document", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Paste full HTML document",
    exact: true,
  });
  await dialog.locator("textarea").fill(threeStarter);
  await dialog
    .getByRole("button", { name: "Apply pasted document", exact: true })
    .click();
  await expect(
    page.frameLocator('iframe[title="Animation preview"]').locator("#scene"),
  ).toHaveCount(1);
  await expect.poll(() => page.locator(".prompt-drawer").count()).toBe(0);
  await page.screenshot({ path: "test-results/three-editor.png" });
});

test("offline Three.js renders visible repeatable frames in a sandbox and standalone document", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const project = fixture();
  await page.setViewportSize({ width: 320, height: 180 });
  await page.setContent(
    '<iframe title="Scene" sandbox="allow-scripts" style="border:0;width:320px;height:180px"></iframe>',
  );
  await page.locator("iframe").evaluate((el, doc) => {
    (el as HTMLIFrameElement).srcdoc = doc;
  }, documentFor(project));
  const frame = () => page.frames().find((f) => f !== page.mainFrame())!;
  await expect
    .poll(() =>
      frame()
        ?.evaluate(() => typeof (window as any).renderFrame)
        .catch(() => "loading"),
    )
    .toBe("function");
  const capture = async (t: number) => {
    await frame().evaluate((time) => (window as any).__fsSeek(time), t);
    return frame()
      .locator("canvas")
      .evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  };
  const a = await capture(0);
  const b = await capture(0.75);
  expect(a).not.toBe(b);
  expect(await capture(0)).toBe(a);
  expect(await capture(0.75)).toBe(b);
  expect(
    await frame().evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = 180;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(document.querySelector("canvas")!, 0, 0);
      const d = ctx.getImageData(0, 0, 320, 180).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 1] > 80 && d[i + 2] > 60) n++;
      return n;
    }),
  ).toBeGreaterThan(300);
  await page.screenshot({ path: "test-results/three-preview.png" });
  await page.setContent(documentFor(project, { standalone: true }));
  await expect
    .poll(() => page.evaluate(() => (window as any).__fsTime()))
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("Three.js exports a real offline MP4 through the existing renderer", async () => {
  const ffmpeg = createRequire(import.meta.url)("ffmpeg-static") as string;
  const output = path.resolve("test-results/three-export.mp4");
  await fs.mkdir(path.dirname(output), { recursive: true });
  await renderExport(
    fixture(),
    {
      format: "mp4",
      width: 320,
      height: 180,
      fps: 4,
      duration: 1,
      speed: 1,
      quality: 24,
      fit: "fit",
      transparent: false,
      time: 0,
      acceleration: "software",
    },
    output,
    ffmpeg,
    new AbortController().signal,
    () => {},
    undefined,
    { encoder: "software", workers: 1 },
  );
  expect((await fs.stat(output)).size).toBeGreaterThan(1000);
  const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", output], {
    encoding: "utf8",
  });
  expect(probe.stderr).toContain("320x180");
  // Compare decoded endpoint frames, ensuring the encoded output contains motion.
  const decode = (time: string) =>
    spawnSync(
      ffmpeg,
      [
        "-v",
        "error",
        "-ss",
        time,
        "-i",
        output,
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "pipe:1",
      ],
      { maxBuffer: 1024 * 1024 },
    ).stdout;
  const first = decode("0");
  const last = decode("0.75");
  expect(first.length).toBe(320 * 180 * 3);
  expect(last.length).toBe(first.length);
  expect(first.equals(last)).toBe(false);
});
