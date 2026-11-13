import { promises as fs } from "node:fs";
import path from "node:path";
import { runProcess } from "./process";
import type { Project, ExportOptions } from "../shared/project";
import {
  audioPlan,
  audioGraph,
  audioSampleCount,
  embeddedAudio,
} from "./audio-graph";
export { audioPlan } from "./audio-graph";
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
  try {
    for (let i = 0; i < clips.length; i++) {
      if (signal.aborted) throw Error("Export cancelled");
      const file = path.join(work, `clip-${i}.bin`);
      await fs.writeFile(file, embeddedAudio(clips[i].data));
      args.push("-i", file);
    }
    filters.push(...audioGraph(p, o, clips, 1));
    const duration = audioSampleCount(o) / 48000;
    filters.push(
      `${clips.map((_, i) => `[a${i}]`).join("")}amix=inputs=${clips.length}:duration=longest:normalize=0,${clips.some((c) => c.lane === "voice" && c.enhanced) ? "loudnorm=I=-16:TP=-2:LRA=7,aresample=192000,alimiter=limit=0.794328:level=0:attack=5:release=80:latency=1,aresample=48000," : "alimiter=limit=0.95:latency=1,"}apad=whole_len=${audioSampleCount(o)},atrim=end_sample=${audioSampleCount(o)}[mix]`,
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
      "-b:a",
      "192k",
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
