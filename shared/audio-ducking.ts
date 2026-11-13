import type { AudioClip, Project } from "./project";
import { sceneOffset } from "./workflow";

export type SpeechRange = { start: number; end: number };
/** Source-time activity, then trims/loops/scene offsets, shared by preview and export. */
export function speechRanges(
  project: Project,
  clips: AudioClip[],
  offset = 0,
  duration = 600,
): SpeechRange[] {
  const ranges: SpeechRange[] = [];
  for (const clip of clips) {
    if (clip.lane !== "voice" || clip.muted || clip.volume <= 0) continue;
    let activity: SpeechRange[];
    if (clip.transcriptWords?.length) activity = clip.transcriptWords;
    else if (clip.peaks?.length) {
      const threshold = Math.max(0.01, Math.max(...clip.peaks) * 0.08);
      const step = clip.duration / clip.peaks.length;
      activity = clip.peaks.flatMap((peak, i) =>
        peak >= threshold ? [{ start: i * step, end: (i + 1) * step }] : [],
      );
    } else activity = [{ start: 0, end: clip.duration }];
    const start =
      clip.start +
      (clip.sceneId ? sceneOffset(project, clip.sceneId) : 0) -
      offset;
    const period = Math.max(0.01, clip.duration - clip.trimIn);
    for (
      let repeat = 0;
      repeat < (clip.loop ? Math.ceil(clip.length / period) : 1);
      repeat++
    ) {
      for (const range of activity) {
        const a =
          start + Math.max(0, range.start - clip.trimIn) + repeat * period;
        const b = Math.min(
          start + clip.length,
          start + range.end - clip.trimIn + repeat * period,
        );
        if (b > a && b > 0 && a < duration)
          ranges.push({ start: Math.max(0, a), end: Math.min(duration, b) });
      }
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const merged: SpeechRange[] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start - last.end <= 0.3)
      last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}
export function musicDuckGain(ranges: SpeechRange[], time: number) {
  let activity = 0;
  for (const range of ranges)
    activity = Math.max(
      activity,
      Math.max(
        0,
        Math.min(
          1,
          (time - range.start + 0.08) / 0.08,
          (range.end + 0.35 - time) / 0.35,
        ),
      ),
    );
  return 1 - activity * 0.65;
}
export function musicDuckExpression(ranges: SpeechRange[], speed: number) {
  // t in FFmpeg is playback seconds; envelope remains tied to project time.
  const terms = ranges.map(
    (r) =>
      `max(0,min(1,min((t*${speed}-${r.start}+0.08)/0.08,(${r.end}+0.35-t*${speed})/0.35)))`,
  );
  return `1-0.65*(${terms.reduce((a, b) => `max(${a},${b})`, "0")})`;
}
