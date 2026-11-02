import { expect, it } from "vitest";
import {
  exportPresetSize,
  supportedExportSize,
} from "../shared/export-presets";
it("maps export presets to even landscape and portrait sizes without changing aspect", () => {
  expect(exportPresetSize(480, { width: 1920, height: 1080 })).toEqual({
    width: 854,
    height: 480,
  });
  expect(exportPresetSize(2160, { width: 1920, height: 1080 })).toEqual({
    width: 3840,
    height: 2160,
  });
  expect(exportPresetSize(1080, { width: 1080, height: 1920 })).toEqual({
    width: 1080,
    height: 1920,
  });
  expect(
    supportedExportSize(exportPresetSize(4320, { width: 1920, height: 1080 })),
  ).toBe(true);
  expect(
    supportedExportSize(exportPresetSize(4320, { width: 1080, height: 1920 })),
  ).toBe(false);
});
