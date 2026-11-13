import type { MediaSize } from "./media-layout";

export const canvasRatios = [
  { name: "16:9", width: 16, height: 9 },
  { name: "9:16", width: 9, height: 16 },
  { name: "1:1", width: 1, height: 1 },
  { name: "4:3", width: 4, height: 3 },
  { name: "21:9", width: 21, height: 9 },
];
export const canvasResolutions = [
  { name: "720p", shortSide: 720 },
  { name: "1080p", shortSide: 1080 },
  { name: "2K", shortSide: 1440 },
  { name: "4K", shortSide: 2160 },
];
export function canvasRatio(size: MediaSize) {
  return canvasRatios.find(
    (r) => Math.abs(size.width / size.height - r.width / r.height) <= 0.001,
  );
}
/** Fit the selected ratio inside the editor's landscape/portrait 4K bounds. */
export function canvasPresetSize(
  size: MediaSize,
  shortSide: number,
): MediaSize {
  const ratio = canvasRatio(size) ?? size;
  const scale = Math.min(
    shortSide / Math.min(ratio.width, ratio.height),
    3840 / Math.max(ratio.width, ratio.height),
    2160 / Math.min(ratio.width, ratio.height),
  );
  return {
    width: Math.round((ratio.width * scale) / 2) * 2,
    height: Math.round((ratio.height * scale) / 2) * 2,
  };
}
export function canvasResolution(size: MediaSize) {
  return canvasResolutions.find((r) => {
    const candidate = canvasPresetSize(size, r.shortSide);
    return candidate.width === size.width && candidate.height === size.height;
  });
}
