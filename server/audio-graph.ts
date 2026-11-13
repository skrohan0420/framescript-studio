import type { ExportOptions, Project } from "../shared/project";
import { sceneOffset } from "../shared/workflow";
import { musicDuckExpression, speechRanges } from "../shared/audio-ducking";

export const AUDIO_RATE = 48000;
export const audioSample = (seconds: number) =>
  Math.round(seconds * AUDIO_RATE);
export function audioSampleCount(
  o: Pick<ExportOptions, "duration" | "speed" | "fps">,
) {
  // Match the video endpoint, rounded up to its final output frame.
  return audioSample(Math.ceil((o.duration / o.speed) * o.fps) / o.fps);
}
export function audioPlan(p: Project, o: ExportOptions) {
  const offset = p.workflow ? sceneOffset(p, p.workflow.selectedId) : 0;
  return (p.audio ?? [])
    .filter(
      (a) =>
        !a.muted &&
        (!a.sceneId || !p.workflow || a.sceneId === p.workflow.selectedId),
    )
    .map((a) => ({
      ...a,
      start: a.start + (a.sceneId ? sceneOffset(p, a.sceneId) : 0) - offset,
    }))
    .filter((a) => a.start < o.duration && a.start + a.length > 0);
}
export function tempos(speed: number) {
  const values: number[] = [];
  while (speed > 2) {
    values.push(2);
    speed /= 2;
  }
  while (speed < 0.5) {
    values.push(0.5);
    speed /= 0.5;
  }
  values.push(speed);
  return values.map((v) => `atempo=${v}`).join(",");
}

/** The same source timing, clip processing and duck envelope for mix and stems. */
export function audioGraph(
  p: Project,
  o: ExportOptions,
  clips: ReturnType<typeof audioPlan>,
  inputOffset: number,
  processed = true,
  stereo = false,
) {
  const offset = p.workflow ? sceneOffset(p, p.workflow.selectedId) : 0;
  const voices = speechRanges(
    p,
    (p.audio ?? []).filter(
      (a) => !a.sceneId || !p.workflow || a.sceneId === p.workflow.selectedId,
    ),
    offset,
    o.duration,
  );
  const filters: string[] = [];
  clips.forEach((clip, i) => {
    const start = Math.max(0, clip.start);
    const skip = Math.max(0, -clip.start);
    const length = Math.min(clip.length - skip, o.duration - start);
    const parts = [
      `aresample=${AUDIO_RATE}`,
      `atrim=start_sample=${audioSample(clip.trimIn)}`,
      "asetpts=PTS-STARTPTS",
    ];
    if (stereo)
      parts.unshift("aformat=sample_fmts=fltp:channel_layouts=stereo");
    if (clip.loop)
      parts.push(
        `aloop=loop=-1:size=${Math.max(1, audioSample(clip.duration - clip.trimIn))}`,
      );
    parts.push(`atrim=end_sample=${audioSample(clip.length)}`);
    if (clip.fadeIn)
      parts.push(`afade=t=in:ss=0:ns=${Math.max(1, audioSample(clip.fadeIn))}`);
    if (clip.fadeOut)
      parts.push(
        `afade=t=out:ss=${audioSample(Math.max(0, clip.length - clip.fadeOut))}:ns=${Math.max(1, audioSample(clip.fadeOut))}`,
      );
    const outputLength = Math.max(1, audioSample(length / o.speed));
    parts.push(
      `atrim=start_sample=${audioSample(skip)}:end_sample=${audioSample(skip + length)}`,
      "asetpts=PTS-STARTPTS",
      tempos(o.speed),
      `apad=whole_len=${outputLength}`,
      `atrim=end_sample=${outputLength}`,
      `volume=${clip.volume}`,
      `adelay=${audioSample(start / o.speed)}S:all=1`,
    );
    if (processed && clip.lane === "music" && voices.length)
      parts.push(`volume='${musicDuckExpression(voices, o.speed)}':eval=frame`);
    filters.push(`[${i + inputOffset}:a]${parts.join(",")}[a${i}]`);
  });
  return filters;
}

export function embeddedAudio(data: string) {
  const match = data.match(/^data:audio\/[\w.+-]+;base64,(.+)$/s);
  if (!match) throw Error("Invalid embedded audio");
  return Buffer.from(match[1], "base64");
}
