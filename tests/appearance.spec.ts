import { test, expect } from "@playwright/test";
import { newProject } from "../shared/project";
import { studioPalettes, studioPaletteTokens } from "../src/studio-palettes";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

test("settings exposes every live palette in both modes and remembers the chosen appearance", async ({
  page,
}) => {
  let preferences: Record<string, unknown> = {
    theme: "dark",
    palette: "silver",
  };
  const project = newProject();
  project.audio = [clipFromAudio(synthesizeSound("Success chime"), "voice")];
  await page.route("**/api/workspaceGet", (r) =>
    r.fulfill({ json: { result: project } }),
  );
  await page.route("**/api/settingsGet", (r) =>
    r.fulfill({ json: { result: preferences } }),
  );
  await page.route("**/api/settingsSet", (r) => {
    preferences = { ...preferences, ...r.request().postDataJSON().args[0] };
    return r.fulfill({ json: { result: true } });
  });
  await page.route("**/api/autosave", (r) =>
    r.fulfill({ json: { result: true } }),
  );
  await page.goto("/#editor");
  const settings = page.locator(".toolbar").getByRole("button", {
    name: "Project settings",
    exact: true,
  });
  await expect(settings).toContainText("Settings");
  await expect(settings.locator("span")).toBeVisible();
  await settings.click();
  const dialog = page.getByRole("dialog", {
    name: "Project & application settings",
  });
  const appearance = dialog.getByRole("region", {
    name: "Appearance",
    exact: true,
  });
  await expect(appearance.getByRole("button")).toHaveCount(studioPalettes.length);
  for (const mode of ["dark", "light"] as const) {
    await appearance.getByLabel("Appearance mode").selectOption(mode);
    for (const palette of studioPalettes) {
      await appearance
        .getByRole("button", { name: palette.name, exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-palette",
        palette.id,
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
      await expect(
        appearance.getByRole("button", { name: palette.name, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      const tokens = studioPaletteTokens(palette.id, mode === "light");
      if (palette.id === "aurora") {
        await expect.poll(() => page.locator(".toolbar").evaluate(el => getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
        await page.screenshot({ path: `test-results/appearance-aurora-${mode}.png` });
      }
      await expect
        .poll(() =>
          page
            .locator(".monaco-editor-background")
            .first()
            .evaluate((el) => getComputedStyle(el).backgroundColor),
        )
        .toBe(
          `rgb(${[1, 3, 5].map((i) => parseInt(tokens["--editor"].slice(i, i + 2), 16)).join(", ")})`,
        );
    }
  }
  await appearance
    .getByRole("button", { name: "Sandstone", exact: true })
    .click();
  await expect.poll(() => preferences.palette).toBe("stone");
  await expect.poll(() => preferences.theme).toBe("light");
  await page.screenshot({ path: "test-results/appearance-sandstone-light.png" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "stone");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await settings.click();
  await appearance.getByLabel("Appearance mode").selectOption("dark");
  await appearance
    .getByRole("button", { name: "Obsidian", exact: true })
    .click();
  await page.screenshot({ path: "test-results/appearance-palettes.png" });
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Audio panel", exact: true }).click();
  const waveform = page.locator(".audio-waveform-thumbnail").first();
  const expected = studioPaletteTokens("silver", false)["--audio-voice-tone"];
  await expect
    .poll(() =>
      waveform.evaluate(
        (el: HTMLCanvasElement) => el.getContext("2d")?.fillStyle,
      ),
    )
    .toBe(expected);
  await page.screenshot({ path: "test-results/appearance-carbon-silver.png" });
  await settings.click();
  await appearance
    .getByRole("button", { name: "Cobalt", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect
    .poll(() =>
      waveform.evaluate(
        (el: HTMLCanvasElement) => el.getContext("2d")?.fillStyle,
      ),
    )
    .toBe(studioPaletteTokens("graphite", false)["--audio-voice-tone"]);
});
