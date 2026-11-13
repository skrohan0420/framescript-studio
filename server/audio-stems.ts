import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExportOptions, Project } from "../shared/project";
import {
  audioGraph,
  audioPlan,
  audioSample,
  audioSampleCount,
  AUDIO_RATE,
  embeddedAudio,
} from "./audio-graph";
import { archiveSequence } from "./archive";
import { runProcess } from "./process";

const lanes = ["voice", "music", "sfx"] as const;
const names = { voice: "narration", music: "music", sfx: "sfx" };

async function peak(file: string, signal: AbortSignal) {
  const handle = await fs.open(file, "r");
  let maximum = 0;
  try {
    const buffer = Buffer.alloc(256 * 1024);
    while (true) {
      if (signal.aborted) throw Error("Export cancelled");
      const { bytesRead } = await handle.read(buffer);
      if (!bytesRead) break;
      for (let i = 0; i < bytesRead; i += 4) {
        const value = buffer.readFloatLE(i);
        if (!Number.isFinite(value))
          throw Error("Audio contains non-finite samples");
        maximum = Math.max(maximum, Math.abs(value));
      }
    }
    return maximum;
  } finally {
    await handle.close();
  }
}

/** Bounded disk intermediates keep float headroom until one shared gain is known. */
export async function renderAudioStems(
  p: Project,
  o: ExportOptions,
  destination: string,
  ffmpeg: string,
  signal: AbortSignal,
  progress: (p: {
    stage: string;
    done: number;
    total: number;
    destination: string;
  }) => void,
) {
  const work = destination + ".work-" + crypto.randomUUID();
  const packaged = path.join(work, "package");
  const clips = audioPlan(p, o);
  const processed = (o.stemMode ?? "processed") === "processed";
  const count = audioSampleCount(o);
  const total = o.stemMaster === false ? 7 : 8;
  let done = 0;
  const report = (stage: string) =>
    progress({ stage, done: done++, total, destination });
  if (signal.aborted) throw Error("Export cancelled");
  await fs.mkdir(packaged, { recursive: true });
  try {
    const sourceFiles: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (!processed && clip.enhanced && !clip.enhancement)
        throw Error(
          "Dry stems need the original recording. Restore or reimport older enhanced audio first.",
        );
      const file = path.join(work, `source-${i}.bin`);
      await fs.writeFile(
        file,
        embeddedAudio(
          processed ? clip.data : (clip.enhancement?.originalData ?? clip.data),
        ),
      );
      sourceFiles.push(file);
    }
    const peaks: number[] = [];
    for (const lane of lanes) {
      report("Rendering " + names[lane] + " stem");
      const selected = clips.filter((c) => c.lane === lane);
      const raw = path.join(work, lane + ".f32");
      if (!selected.length) {
        await runProcess(
          ffmpeg,
          [
            "-y",
            "-f",
            "lavfi",
            "-i",
            `anullsrc=r=${AUDIO_RATE}:cl=stereo`,
            "-af",
            `atrim=end_sample=${count}`,
            "-c:a",
            "pcm_f32le",
            "-f",
            "f32le",
            raw,
          ],
          signal,
          "Silent stem",
        );
      } else {
        const inputs = selected.flatMap((c) => [
          "-i",
          sourceFiles[clips.indexOf(c)],
        ]);
        const filters = audioGraph(p, o, selected, 0, processed, true);
        filters.push(
          `${selected.map((_, i) => `[a${i}]`).join("")}amix=inputs=${selected.length}:normalize=0:duration=longest,apad=whole_len=${count},atrim=end_sample=${count}[stem]`,
        );
        await runProcess(
          ffmpeg,
          [
            "-y",
            ...inputs,
            "-filter_complex",
            filters.join(";"),
            "-map",
            "[stem]",
            "-ar",
            String(AUDIO_RATE),
            "-ac",
            "2",
            "-c:a",
            "pcm_f32le",
            "-f",
            "f32le",
            raw,
          ],
          signal,
          "Stem rendering",
        );
      }
      const size = (await fs.stat(raw)).size;
      if (size !== count * 2 * 4)
        throw Error("Stem sample count did not match the requested timeline");
      peaks.push(await peak(raw, signal));
    }
    // A shared linear attenuation preserves summation and avoids per-stem limiting.
    // The sum of lane peaks is a conservative bound on the mixed peak.
    const sharedGain = Math.min(
      1,
      0.999 / (peaks.reduce((a, b) => a + b, 0) || 1),
    );
    const rawInput = (lane: string) => [
      "-f",
      "f32le",
      "-ar",
      String(AUDIO_RATE),
      "-ac",
      "2",
      "-i",
      path.join(work, lane + ".f32"),
    ];
    for (const lane of lanes) {
      report("Encoding " + names[lane] + " WAV");
      await runProcess(
        ffmpeg,
        [
          "-y",
          ...rawInput(lane),
          "-af",
          `volume=${sharedGain}:precision=double`,
          "-c:a",
          "pcm_s24le",
          path.join(packaged, names[lane] + ".wav"),
        ],
        signal,
        "WAV encoding",
      );
    }
    if (o.stemMaster !== false) {
      report("Encoding master WAV");
      await runProcess(
        ffmpeg,
        [
          "-y",
          ...lanes.flatMap(rawInput),
          "-filter_complex",
          `[0:a][1:a][2:a]amix=inputs=3:normalize=0,volume=${sharedGain}:precision=double,atrim=end_sample=${count}[master]`,
          "-map",
          "[master]",
          "-c:a",
          "pcm_s24le",
          path.join(packaged, "master.wav"),
        ],
        signal,
        "Master encoding",
      );
    }
    const manifest = {
      version: 1,
      project: p.name,
      mode: processed ? "processed" : "dry",
      sampleRate: AUDIO_RATE,
      channels: 2,
      bitDepth: 24,
      encoding: "pcm_s24le",
      startSample: 0,
      sampleCount: count,
      durationSeconds: count / AUDIO_RATE,
      sourceDurationSeconds: o.duration,
      speed: o.speed,
      referenceFps: o.fps,
      timebase:
        "48,000 samples/second; nearest sample, exact halves rounded up; endpoint rounded up to the reference video frame then nearest sample",
      sharedGain,
      headroom:
        "One shared linear attenuation based on the sum of lane peaks; no per-stem limiter or master loudness normalization",
      processing: {
        source: processed
          ? "Currently enabled source enhancement"
          : "Saved original recordings",
        clipGainAndFades: true,
        speechDucking: processed,
        master:
          o.stemMaster !== false
            ? "Linear sum of the three stems"
            : "Not included",
      },
      stems: lanes.map((lane, i) => ({
        lane,
        file: names[lane] + ".wav",
        sampleCount: count,
        peakBeforeSharedGain: peaks[i],
      })),
      clips: clips.map((c) => ({
        id: c.id,
        lane: c.lane,
        startSample: audioSample(Math.max(0, c.start) / o.speed),
        trimInSample: audioSample(c.trimIn),
        skippedSourceSamples: audioSample(Math.max(0, -c.start)),
        lengthSeconds: c.length,
        loop: c.loop,
        gain: c.volume,
        fadeInSeconds: c.fadeIn,
        fadeOutSeconds: c.fadeOut,
        enhanced: processed && !!c.enhanced,
      })),
      notes: [
        "Import all WAVs at timeline time zero; empty lanes contain silence.",
        "Dry retains clip placement, trims, speed, fades and gain; it bypasses enhancement and music ducking.",
        "Processed follows enabled source processing and speech ducking, without final video-mix mastering.",
        "Summing the three PCM stems matches master within 24-bit quantization tolerance. Do not also sum master.",
      ],
    };
    await fs.writeFile(
      path.join(packaged, "manifest.json"),
      JSON.stringify(manifest, null, 2),
    );
    report("Packaging audio stems");
    await archiveSequence(packaged, destination, signal);
    progress({ stage: "Complete", done: total, total, destination });
    return destination;
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}
