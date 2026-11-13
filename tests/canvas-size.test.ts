import { expect, it } from "vitest";
import {
  canvasPresetSize,
  canvasRatio,
  canvasResolution,
  canvasRatios,
  canvasResolutions,
} from "../shared/canvas-size";
import { sizeError } from "../shared/media-layout";

it("keeps aspect ratio independent of pixel resolution, including landscape and portrait 4K", () => {
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
  ])
    expect(canvasRatio(size)?.name).toBe("16:9");
  expect(canvasPresetSize({ width: 16, height: 9 }, 2160)).toEqual({
    width: 3840,
    height: 2160,
  });
  expect(canvasPresetSize({ width: 9, height: 16 }, 2160)).toEqual({
    width: 2160,
    height: 3840,
  });
  expect(canvasPresetSize({ width: 1, height: 1 }, 1080)).toEqual({
    width: 1080,
    height: 1080,
  });
});
it("produces even supported canvas dimensions and retains the selected tier across ratios", () => {
  for (const ratio of canvasRatios)
    for (const resolution of canvasResolutions) {
      const size = canvasPresetSize(ratio, resolution.shortSide);
      expect(sizeError(size, true)).toBe("");
      expect(canvasRatio(size)?.name).toBe(ratio.name);
      expect(canvasResolution(size)?.shortSide).toBe(resolution.shortSide);
    }
  expect(canvasPresetSize({ width: 21, height: 9 }, 2160)).toEqual({
    width: 3840,
    height: 1646,
  });
});
it("recognizes custom dimensions without forcing them to a fixed HD preset", () => {
  const custom = { width: 1500, height: 1000 };
  expect(canvasRatio(custom)).toBeUndefined();
  expect(canvasResolution(custom)).toBeUndefined();
  expect(canvasPresetSize(custom, 2160)).toEqual({ width: 3240, height: 2160 });
});
