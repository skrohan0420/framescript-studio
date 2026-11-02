export const exportResolutions = [
  { height: 480, name: "480P" },
  { height: 720, name: "720P" },
  { height: 1080, name: "1080P" },
  { height: 1440, name: "2K" },
  { height: 2160, name: "4K" },
  { height: 4320, name: "8K" },
];
export function exportPresetSize(
  shortSide: number,
  frame: { width: number; height: number },
) {
  const scale = shortSide / Math.min(frame.width, frame.height);
  return {
    width: Math.round((frame.width * scale) / 2) * 2,
    height: Math.round((frame.height * scale) / 2) * 2,
  };
}
export function supportedExportSize(size: { width: number; height: number }) {
  return (
    size.width >= 64 &&
    size.height >= 64 &&
    size.width <= 7680 &&
    size.height <= 4320
  );
}
