import type { TranscriptWord } from "./transcript";
export type CutRange = { start: number; end: number };

export function normalizeCuts(cuts: CutRange[], duration: number): CutRange[] {
  const result: CutRange[] = [];
  for (const cut of cuts
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end))
    .map((c) => ({
      start: Math.max(0, c.start),
      end: Math.min(duration, c.end),
    }))
    .filter((c) => c.end > c.start)
    .sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && cut.start <= last.end) last.end = Math.max(last.end, cut.end);
    else result.push({ ...cut });
  }
  return result;
}
export function mapAudioTime(time: number, cuts: CutRange[]) {
  return Math.max(
    0,
    time -
      cuts.reduce(
        (sum, c) => sum + Math.max(0, Math.min(time, c.end) - c.start),
        0,
      ),
  );
}
export function retimeWords(words: TranscriptWord[], cuts: CutRange[]) {
  return words
    .filter(
      (word) =>
        word.end - word.start >
        cuts.reduce(
          (sum, c) =>
            sum +
            Math.max(
              0,
              Math.min(word.end, c.end) - Math.max(word.start, c.start),
            ),
          0,
        ) +
          1e-7,
    )
    .map((word) => ({
      ...word,
      start: mapAudioTime(word.start, cuts),
      end: mapAudioTime(word.end, cuts),
    }));
}
export function detectSilence(
  channels: Float32Array[],
  rate: number,
  thresholdDb = -40,
  minimum = 0.35,
  padding = 0.08,
  words: TranscriptWord[] = [],
) {
  const frames = channels[0]?.length ?? 0,
    window = Math.max(1, Math.round(rate * 0.01));
  const threshold = 10 ** (thresholdDb / 20),
    cuts: CutRange[] = [];
  let silenceStart: number | undefined;
  const finish = (end: number) => {
    if (silenceStart === undefined) return;
    const from = silenceStart / rate,
      to = end / rate;
    if (to - from >= minimum) {
      let segments = [
        {
          start: from === 0 ? 0 : from + padding,
          end: end === frames ? to : to - padding,
        },
      ];
      // Preserve known speech even if a quiet syllable falls under the threshold.
      for (const word of words)
        segments = segments.flatMap((c) =>
          word.end + padding <= c.start || word.start - padding >= c.end
            ? [c]
            : [
                { start: c.start, end: Math.min(c.end, word.start - padding) },
                { start: Math.max(c.start, word.end + padding), end: c.end },
              ].filter((c) => c.end > c.start),
        );
      cuts.push(...segments.filter((c) => c.end - c.start >= 0.03));
    }
    silenceStart = undefined;
  };
  for (let i = 0; i < frames; i += window) {
    let loud = false;
    for (const channel of channels) {
      let energy = 0;
      for (let j = i; j < Math.min(i + window, frames); j++)
        energy += channel[j] ** 2;
      if (Math.sqrt(energy / Math.min(window, frames - i)) > threshold)
        loud = true;
    }
    if (!loud && silenceStart === undefined) silenceStart = i;
    if (loud) finish(i);
  }
  finish(frames);
  return normalizeCuts(cuts, frames / rate);
}
