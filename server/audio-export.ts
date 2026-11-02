import { promises as fs } from "node:fs";
import path from "node:path";
import { runProcess } from "./process";
import type { Project, ExportOptions } from "../shared/project";
import { sceneOffset } from "../shared/workflow";
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
function tempos(speed: number) {
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
export async function mixAudio(
  ffmpeg: string,
  video: string,
  p: Project,
  o: ExportOptions,
  signal: AbortSignal,
) {
  const clips = audioPlan(p, o);
  if (!clips.length) return;
  const work = video + ".audio-" + crypto.randomUUID();
  await fs.mkdir(work);
  const output = path.join(work, "mixed." + o.format);
  const args = ["-y", "-i", video],
    filters: string[] = [];
  const voices = clips
    .filter((a) => a.lane === "voice")
    .map((a) => ({
      start: Math.max(0, a.start) / o.speed,
      end: Math.min(o.duration, a.start + a.length) / o.speed,
    }));
  try {
    for (let i = 0; i < clips.length; i++) {
      if (signal.aborted) throw Error("Export cancelled");
      const clip = clips[i],
        match = clip.data.match(/^data:audio\/[\w.+-]+;base64,(.+)$/s);
      if (!match) throw Error("Invalid embedded audio");
      const file = path.join(work, `clip-${i}.bin`);
      await fs.writeFile(file, Buffer.from(match[1], "base64"));
      args.push("-i", file);
      const start = Math.max(0, clip.start),
        skip = Math.max(0, -clip.start),
        length = Math.min(clip.length - skip, o.duration - start);
      const parts = [
        `aresample=48000`,
        `atrim=start=${clip.trimIn}`,
        "asetpts=PTS-STARTPTS",
      ];
      if (clip.loop)
        parts.push(
          `aloop=loop=-1:size=${Math.max(1, Math.round((clip.duration - clip.trimIn) * 48000))}`,
        );
      parts.push(`atrim=duration=${clip.length}`);
      if (clip.fadeIn) parts.push(`afade=t=in:st=0:d=${clip.fadeIn}`);
      if (clip.fadeOut)
        parts.push(
          `afade=t=out:st=${Math.max(0, clip.length - clip.fadeOut)}:d=${clip.fadeOut}`,
        );
      parts.push(
        `atrim=start=${skip}:duration=${length}`,
        "asetpts=PTS-STARTPTS",
        tempos(o.speed),
        `volume=${clip.volume}`,
        `adelay=${Math.round((start / o.speed) * 1000)}:all=1`,
      );
      if (clip.lane === "music" && voices.length)
        parts.push(
          `volume='if(gt(${voices.map((v) => `between(t,${v.start},${v.end})`).join("+")},0),0.35,1)':eval=frame`,
        );
      filters.push(`[${i + 1}:a]${parts.join(",")}[a${i}]`);
    }
    const duration = Math.ceil((o.duration / o.speed) * o.fps) / o.fps;
    filters.push(
      `${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:duration=longest:normalize=0,alimiter=limit=0.95:latency=1,apad,atrim=duration=${duration}[mix]`,
    );
    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      "0:v:0",
      "-map",
      "[mix]",
      "-c:v",
      "copy",
      "-c:a",
      o.format === "webm" ? "libopus" : "aac",
      "-t",
      String(duration),
      output,
    );
    await runProcess(ffmpeg, args, signal, "Audio mixing");
    if (signal.aborted) throw Error("Export cancelled");
    await fs.copyFile(output, video);
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
