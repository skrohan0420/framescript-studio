import { expect, it } from "vitest";
import {
  readStudioPalette,
  studioPalettes,
  studioPaletteTokens,
  studioPaletteFinish,
} from "../src/studio-palettes";
function luminance(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
it("keeps readable text, selected controls and primary actions across every palette and mode", () => {
  for (const p of studioPalettes)
    for (const light of [false, true]) {
      const t = studioPaletteTokens(p.id, light);
      for (const color of Object.values(t))
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      for (const foreground of ["--text", "--secondary", "--muted"])
        for (const background of ["--surface", "--raised", "--input"])
          expect(
            contrast(t[foreground], t[background]),
            `${p.id} ${light} ${foreground} ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(t["--on-accent"], t["--accent"]),
        `${p.id} primary`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(t["--accent"], t["--accent-wash"]),
        `${p.id} selection`,
      ).toBeGreaterThanOrEqual(4.5);
    }
});
it("keeps text readable over gradient stops and clears gradients for solid palettes", () => {
  for (const p of studioPalettes) for (const light of [false, true]) {
    const tokens = studioPaletteTokens(p.id, light);
    const finish = studioPaletteFinish(p.id, light);
    for (const gradient of Object.values(finish)) {
      for (const stop of gradient.match(/#[0-9a-f]{6}/gi) ?? []) {
        for (const foreground of ["--text", "--muted", "--accent"])
          expect(contrast(tokens[foreground], stop), `${p.id} ${foreground} gradient`).toBeGreaterThanOrEqual(4.5);
      }
    }
  }
  expect(studioPaletteFinish("silver", false)["--chrome-gradient"]).toBe("none");
});
it("falls back safely for absent or unknown saved palette values", () => {
  expect(readStudioPalette(undefined)).toBe("silver");
  expect(readStudioPalette("unknown")).toBe("silver");
  expect(readStudioPalette("stone")).toBe("stone");
  expect(readStudioPalette("navy")).toBe("graphite");
  expect(readStudioPalette("burgundy")).toBe("plum");
  expect(readStudioPalette("espresso")).toBe("stone");
});
