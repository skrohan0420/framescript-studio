import type { AudioClip } from "./project";
export type AudioEdit = "move" | "trim-start" | "trim-end";
export function audioTimelineRows(
  clips: AudioClip[],
  startOf: (clip: AudioClip) => number = (clip) => clip.start,
) {
  const rows: { lane: AudioClip["lane"]; end: number; clips: AudioClip[] }[] =
    [];
  for (const clip of [...clips].sort((a, b) => startOf(a) - startOf(b))) {
    const start = startOf(clip);
    let row = rows.find(
      (row) => row.lane === clip.lane && row.end <= start + 1e-6,
    );
    if (!row) {
      row = { lane: clip.lane, end: start, clips: [] };
      rows.push(row);
    }
    row.clips.push(clip);
    row.end = start + clip.length;
  }
  return rows;
}
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function snapAudioEdit(
  clip: AudioClip,
  delta: number,
  mode: AudioEdit,
  scopeDuration: number,
  targets: number[],
  tolerance: number,
) {
  const draft = editAudioClip(clip, delta, mode, scopeDuration);
  const edges =
    mode === "move"
      ? [draft.start, draft.start + draft.length]
      : [mode === "trim-start" ? draft.start : draft.start + draft.length];
  let best: { clip: AudioClip; target: number; distance: number } | undefined;
  for (const edge of edges)
    for (const target of targets) {
      const correction = target - edge;
      if (
        !Number.isFinite(target) ||
        Math.abs(correction) > tolerance ||
        (best && Math.abs(correction) >= best.distance)
      )
        continue;
      const adjusted = editAudioClip(
        clip,
        delta + correction,
        mode,
        scopeDuration,
      );
      const adjustedEdge =
        mode === "trim-start" || (mode === "move" && edge === draft.start)
          ? adjusted.start
          : adjusted.start + adjusted.length;
      if (Math.abs(adjustedEdge - target) < 1e-6)
        best = { clip: adjusted, target, distance: Math.abs(correction) };
    }
  return best
    ? { clip: best.clip, target: best.target }
    : { clip: draft, target: undefined };
}
export function editAudioClip(
  clip: AudioClip,
  delta: number,
  mode: AudioEdit,
  scopeDuration: number,
): AudioClip {
  if (mode === "move")
    return {
      ...clip,
      start: clamp(
        clip.start + delta,
        0,
        Math.max(0, scopeDuration - clip.length),
      ),
    };
  if (mode === "trim-start") {
    const shift = clamp(
      delta,
      Math.max(-clip.start, -clip.trimIn),
      Math.min(clip.length - 0.01, clip.duration - clip.trimIn - 0.01),
    );
    return {
      ...clip,
      start: clip.start + shift,
      trimIn: clip.trimIn + shift,
      length: clip.length - shift,
    };
  }
  const available = clip.loop ? 600 : clip.duration - clip.trimIn;
  return {
    ...clip,
    length: clamp(
      clip.length + delta,
      0.01,
      Math.min(600, available, Math.max(0.01, scopeDuration - clip.start)),
    ),
  };
}
