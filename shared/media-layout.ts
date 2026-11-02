export type MediaSize = { width: number; height: number };
export type ImagePlacement = MediaSize & { fit: "contain" | "cover" };
export const sizePresets = [
  { name: "HD · 1280 × 720", width: 1280, height: 720 },
  { name: "Full HD · 1920 × 1080", width: 1920, height: 1080 },
  { name: "4K UHD · 3840 × 2160", width: 3840, height: 2160 },
  { name: "Portrait HD · 1080 × 1920", width: 1080, height: 1920 },
  { name: "Portrait 4K · 2160 × 3840", width: 2160, height: 3840 },
  { name: "Square · 1080 × 1080", width: 1080, height: 1080 },
];
export function sizeError(size: MediaSize, frame = false) {
  if (
    ![size.width, size.height].every(
      (value) => Number.isInteger(value) && value >= (frame ? 64 : 1),
    )
  )
    return `Enter whole-pixel dimensions of at least ${frame ? 64 : 1}px.`;
  if (
    Math.max(size.width, size.height) > 3840 ||
    Math.min(size.width, size.height) > 2160
  )
    return "Maximum size is 4K: 3840 × 2160, or 2160 × 3840 for portrait.";
  if (frame && (size.width % 2 || size.height % 2))
    return "Use even frame dimensions for video export.";
  return "";
}
export function imageMarkup(
  id: string,
  frame: MediaSize,
  placement: ImagePlacement,
) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return `\n<img id="image-${safeId}-${crypto.randomUUID().slice(0, 8)}" src="asset://${safeId}" style="position:absolute;left:${(frame.width - placement.width) / 2}px;top:${(frame.height - placement.height) / 2}px;width:${placement.width}px;height:${placement.height}px;object-fit:${placement.fit};">`;
}
