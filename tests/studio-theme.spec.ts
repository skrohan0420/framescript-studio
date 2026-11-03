import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { synthesizeSound } from "../shared/audio";
import { clipFromAudio } from "../src/audio";

test("studio themes keep readable text, named icon actions and usable panels", async ({
  page,
}) => {
  const project = newProject();
  project.workflow = initialWorkflow(project);
  project.audio = [
    clipFromAudio(
      synthesizeSound("Success chime"),
      "voice",
      project.workflow.selectedId,
    ),
    clipFromAudio(
      synthesizeSound("Ambient loop"),
      "music",
      project.workflow.selectedId,
    ),
  ];
  let theme = "dark";
  await page.route("**/api/workspaceGet", (route) =>
    route.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (route) =>
    route.fulfill({ json: { result: { theme, layoutVersion: 2 } } }),
  );
  await page.route("**/api/settingsSet", (route) => {
    theme = route.request().postDataJSON().args[0].theme ?? theme;
    return route.fulfill({ json: { result: true } });
  });
  await page.route("**/api/autosave", (route) =>
    route.fulfill({ json: { result: true } }),
  );
  await page.route("**/api/listProjects", (route) =>
    route.fulfill({ json: { result: [] } }),
  );
  await page.goto("/");
  await expect(page.locator(".project-home")).toBeVisible();
  await page.screenshot({ path: "test-results/premium-home-dark.png" });
  await page.goto("/#editor");
  for (const mode of ["dark", "light"]) {
    if (mode === "light")
      await page
        .getByRole("button", { name: "Switch to light theme", exact: true })
        .click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
    const ratios = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const rgb = (token: string) => {
        const raw = styles.getPropertyValue(token).trim().replace("#", "");
        const hex =
          raw.length === 3 ? [...raw].map((char) => char + char).join("") : raw;
        return [0, 2, 4]
          .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
      };
      const luminance = (token: string) => {
        const [r, g, b] = rgb(token);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const ratio = (fg: string, bg: string) => {
        const a = luminance(fg),
          b = luminance(bg);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      return ["--text", "--secondary", "--muted"]
        .flatMap((fg) =>
          ["--surface", "--raised", "--input"].map((bg) => ({
            name: `${fg} on ${bg}`,
            ratio: ratio(fg, bg),
          })),
        )
        .concat([
          {
            name: "primary button",
            ratio: ratio("--on-accent", "--accent-strong"),
          },
          { name: "active tab", ratio: ratio("--accent", "--accent-wash") },
        ]);
    });
    for (const item of ratios)
      expect(item.ratio, `${mode}: ${item.name}`).toBeGreaterThanOrEqual(4.5);
    await page
      .getByRole("button", { name: "Audio panel", exact: true })
      .click();
    await expect(
      page
        .getByRole("button", { name: "Auto remove silence", exact: true })
        .first(),
    ).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".audio-waveform-thumbnail")
          .first()
          .evaluate(
            (canvas: HTMLCanvasElement) => canvas.getContext("2d")?.fillStyle,
          ),
      )
      .toBe(mode === "dark" ? "#39d8c7" : "#06766b");
    await expect(
      page.getByRole("button", {
        name: "Add Ambient loop to timeline",
        exact: true,
      }),
    ).toHaveAttribute("title", /Add/);
    await page.screenshot({ path: `test-results/premium-studio-${mode}.png` });
    await page
      .getByRole("button", { name: "Prompts panel", exact: true })
      .click();
    for (const tab of await page
      .getByRole("tablist", { name: "Prompt sections" })
      .getByRole("tab")
      .all())
      expect(await tab.getAttribute("title")).toBeTruthy();
    await page.getByRole("tab", { name: "Typography", exact: true }).click();
    await page
      .getByRole("checkbox", {
        name: "Include typography in prompt",
        exact: true,
      })
      .check();
    await expect(
      page.getByRole("button", {
        name: "Replay typography preview",
        exact: true,
      }),
    ).toHaveAttribute("title", /Replay/);
    await page
      .getByRole("button", { name: "Close prompt builder", exact: true })
      .click();
    await page.setViewportSize({ width: 1280, height: 720 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1600, height: 1000 });
  }
  await expect.poll(() => theme).toBe("light");
  await page.goto("/");
  await expect(page.locator(".project-home")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "test-results/premium-home-light.png" });
});
