import type { TextLayer } from "./typography";
export function editTextTiming(
  layer: TextLayer,
  delta: number,
  mode: "move" | "start" | "end",
  origin: number,
  duration: number,
): TextLayer {
  const limit = origin + duration;
  const start = Math.max(origin, layer.start),
    end = Math.min(limit, layer.end);
  const minimum = Math.min(0.1, end - start);
  if (mode === "start")
    return {
      ...layer,
      start: Math.max(origin, Math.min(end - minimum, start + delta)),
      end,
      motionStart: layer.motionStart ?? layer.start,
    };
  if (mode === "end")
    return {
      ...layer,
      start,
      end: Math.min(limit, Math.max(start + minimum, end + delta)),
    };
  const shift = Math.max(origin - start, Math.min(limit - end, delta));
  return {
    ...layer,
    start: start + shift,
    end: end + shift,
    motionStart: (layer.motionStart ?? layer.start) + shift,
  };
}
