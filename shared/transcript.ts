import { z } from "zod";
import type { AudioClip } from "./project";
export const transcriptWordSchema = z
  .object({
    text: z.string().max(500),
    start: z.number().min(0).max(3600),
    end: z.number().min(0).max(3600),
  })
  .refine((word) => word.end >= word.start, "Word end must follow its start");
export type TranscriptWord = z.infer<typeof transcriptWordSchema>;
export function voiceoverWordsForScene(
  clip: AudioClip,
  duration: number,
  sceneStart = 0,
): TranscriptWord[] {
  const start = clip.start - (clip.sceneId ? 0 : sceneStart);
  const words: TranscriptWord[] = [];
  const cycles = clip.loop
    ? Math.min(1000, Math.ceil((clip.trimIn + clip.length) / clip.duration))
    : 1;
  for (let cycle = 0; cycle < cycles; cycle++)
    for (const word of clip.transcriptWords ?? []) {
      const from = word.start + cycle * clip.duration - clip.trimIn;
      const to = word.end + cycle * clip.duration - clip.trimIn;
      if (
        to <= 0 ||
        from >= clip.length ||
        start + to <= 0 ||
        start + from >= duration
      )
        continue;
      words.push({
        text: word.text,
        start: Math.max(0, start + Math.max(0, from)),
        end: Math.min(duration, start + Math.min(clip.length, to)),
      });
      if (words.length >= 10000) return words;
    }
  return words;
}
export function transcriptSrt(words: TranscriptWord[]) {
  const cues: { start: number; end: number; text: string }[] = [];
  let cue: { start: number; end: number; text: string } | undefined;
  for (const word of [...words].sort((a, b) => a.start - b.start)) {
    if (!word.text.trim()) continue;
    if (
      cue &&
      (cue.text.length + word.text.length > 70 ||
        word.end - cue.start > 4 ||
        word.start - cue.end > 0.8)
    ) {
      cues.push(cue);
      cue = undefined;
    }
    if (!cue)
      cue = { start: word.start, end: word.end, text: word.text.trim() };
    else {
      cue.text += " " + word.text.trim();
      cue.end = Math.max(cue.end, word.end);
    }
    if (/[.!?]$/.test(word.text.trim())) {
      cues.push(cue);
      cue = undefined;
    }
  }
  if (cue) cues.push(cue);
  const time = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
  };
  return (
    cues
      .map(
        (item, index) =>
          `${index + 1}\n${time(item.start)} --> ${time(Math.max(item.end, item.start + 0.001))}\n${item.text}`,
      )
      .join("\n\n") + (cues.length ? "\n" : "")
  );
}
