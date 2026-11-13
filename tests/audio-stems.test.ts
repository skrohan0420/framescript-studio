// @vitest-environment node
import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { inflateRawSync } from "node:zlib";
import ffmpeg from "ffmpeg-static";
import { renderExport } from "../server/export";
import { renderAudioStems } from "../server/audio-stems";
import { audioPlan, audioSampleCount } from "../server/audio-graph";
import { newProject, exportSchema, type Project } from "../shared/project";
import { encodeAudioSamples } from "../shared/audio";
import { clipFromAudio } from "../src/audio";
import { initialWorkflow } from "../shared/workflow";
import { composeProject } from "../shared/composition";

function unzip(zip: Buffer) {
  const result: Record<string, Buffer> = {};
  const end = zip.lastIndexOf(Buffer.from("504b0506", "hex"));
  let entry = zip.readUInt32LE(end + 16);
  while (entry < end) {
    const nameLength = zip.readUInt16LE(entry + 28);
    const name = zip.toString("utf8", entry + 46, entry + 46 + nameLength);
    const local = zip.readUInt32LE(entry + 42);
    const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + zip.readUInt32LE(entry + 20));
    result[name] =
      zip.readUInt16LE(entry + 10) === 8 ? inflateRawSync(data) : data;
    entry +=
      46 +
      nameLength +
      zip.readUInt16LE(entry + 30) +
      zip.readUInt16LE(entry + 32);
  }
  return result;
}
function wav(file: Buffer, fromSample = 0) {
  let format: Buffer | undefined, data: Buffer | undefined;
  for (let i = 12; i + 8 <= file.length;) {
    const size = file.readUInt32LE(i + 4);
    const name = file.toString("ascii", i, i + 4);
    if (name === "fmt ") format = file.subarray(i + 8, i + 8 + size);
    if (name === "data") data = file.subarray(i + 8, i + 8 + size);
    i += 8 + size + (size % 2);
  }
  expect(format!.readUInt32LE(4)).toBe(48000);
  expect(format!.readUInt16LE(2)).toBe(2);
  expect(format!.readUInt16LE(14)).toBe(24);
  return {
    count: data!.length / 6,
    samples: Array.from(
      { length: Math.max(0, data!.length / 3 - fromSample * 2) },
      (_, i) => data!.readIntLE((i + fromSample * 2) * 3, 3) / 8388608,
    ),
  };
}
function clip(lane: "voice" | "music" | "sfx", level = 0.2) {
  const samples = Float32Array.from({ length: 24000 }, (_, i) =>
    i >= 2400 && i < 7200 ? level : 0,
  );
  return {
    ...clipFromAudio(
      { ...encodeAudioSamples(samples, 48000), name: lane, duration: 0.5 },
      lane,
    ),
    volume: 1,
    fadeIn: 0,
    fadeOut: 0,
    loop: false,
  };
}
const options = (speed = 1) =>
  exportSchema.parse({
    format: "stems",
    width: 320,
    height: 180,
    fps: 30,
    duration: 1,
    speed,
    quality: 18,
    fit: "fit",
    transparent: false,
    stemMode: "dry",
  });
async function exported(p: Project, o = options()) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "framescript-stems-"),
  );
  const destination = path.join(directory, "stems.zip");
  try {
    // Public renderer entry point must bypass Chromium for audio-only exports.
    await renderExport(
      p,
      o,
      destination,
      ffmpeg!,
      new AbortController().signal,
      () => {},
      "nonexistent-chromium",
    );
    const files = unzip(await fs.readFile(destination));
    expect((await fs.readdir(directory)).sort()).toEqual(["stems.zip"]);
    return files;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

it("exports sample-aligned 24-bit stems, empty-lane silence and a summable master with submillisecond placement", async () => {
  const p = newProject();
  p.audio = [
    { ...clip("voice"), start: 0.100125, trimIn: 0.05, length: 0.3 },
    { ...clip("sfx"), start: 0.2, volume: 0.6 },
    { ...clip("music"), muted: true },
  ];
  const files = await exported(p);
  expect(Object.keys(files).sort()).toEqual([
    "manifest.json",
    "master.wav",
    "music.wav",
    "narration.wav",
    "sfx.wav",
  ]);
  const manifest = JSON.parse(files["manifest.json"].toString());
  expect(manifest.sampleCount).toBe(48000);
  expect(manifest.clips[0].startSample).toBe(4806);
  const voice = wav(files["narration.wav"]),
    music = wav(files["music.wav"]),
    sfx = wav(files["sfx.wav"]),
    master = wav(files["master.wav"]);
  for (const stem of [voice, music, sfx, master])
    expect(stem.count).toBe(48000);
  expect(music.samples.every((s) => s === 0)).toBe(true);
  const first = voice.samples.findIndex((s) => Math.abs(s) > 0.01) / 2;
  expect(first).toBe(4806);
  for (let i = 0; i < master.samples.length; i++)
    expect(
      Math.abs(voice.samples[i] + sfx.samples[i] - master.samples[i]),
    ).toBeLessThan(4 / 8388608);
}, 30000);

it.each([0.5, 2])(
  "pads trimmed, looped and faded overlapping clips to the video endpoint at %sx",
  async (speed) => {
    const p = newProject();
    p.audio = [
      {
        ...clip("voice"),
        start: 0.1,
        trimIn: 0.05,
        length: 0.3,
        fadeIn: 0.05,
        fadeOut: 0.05,
      },
      { ...clip("music"), start: 0.125, length: 0.8, loop: true },
    ];
    const o = { ...options(speed), duration: 1.013, stemMaster: false };
    const files = await exported(p, o);
    expect(files["master.wav"]).toBeUndefined();
    for (const name of ["narration", "music", "sfx"])
      expect(wav(files[name + ".wav"]).count).toBe(audioSampleCount(o));
    expect(
      wav(files["music.wav"]).samples.some((s) => Math.abs(s) > 0.01),
    ).toBe(true);
  },
  30000,
);

it("uses original audio for dry export, enabled enhancement for processed, and one shared headroom gain", async () => {
  const p = newProject();
  const original = clip("voice", 0.2),
    enhanced = clip("voice", 0.8);
  p.audio = [
    {
      ...original,
      data: enhanced.data,
      enhanced: true,
      enhancement: {
        version: 4,
        originalData: original.data,
        processedData: enhanced.data,
      },
    },
    clip("sfx", 0.8),
  ];
  const dry = await exported(p);
  const processed = await exported(p, { ...options(), stemMode: "processed" });
  const dryManifest = JSON.parse(dry["manifest.json"].toString());
  const processedManifest = JSON.parse(processed["manifest.json"].toString());
  expect(processedManifest.sharedGain).toBeLessThan(dryManifest.sharedGain);
  const dryVoice = wav(dry["narration.wav"]),
    processedVoice = wav(processed["narration.wav"]);
  expect(
    processedVoice.samples[6000] / processedManifest.sharedGain,
  ).toBeCloseTo((4 * dryVoice.samples[6000]) / dryManifest.sharedGain, 3);
  const master = wav(processed["master.wav"]);
  expect(Math.max(...master.samples.map(Math.abs))).toBeLessThanOrEqual(
    0.99901,
  );
  const v = wav(processed["narration.wav"]),
    s = wav(processed["sfx.wav"]);
  for (let i = 0; i < master.samples.length; i++)
    expect(
      Math.abs(v.samples[i] + s.samples[i] - master.samples[i]),
    ).toBeLessThan(4 / 8388608);
}, 30000);

it("keeps late cues sample-aligned across a minute-long timeline", async () => {
  const p = newProject();
  p.audio = [{ ...clip("sfx"), start: 59.700125, trimIn: 0.05, length: 0.25 }];
  const files = await exported(p, {
    ...options(),
    duration: 60,
    stemMaster: false,
  });
  const tail = wav(files["sfx.wav"], 59 * 48000);
  expect(tail.count).toBe(60 * 48000);
  expect(tail.samples.findIndex((s) => Math.abs(s) > 0.01) / 2).toBe(33606);
  expect(wav(files["narration.wav"], 60 * 48000).count).toBe(tail.count);
}, 30000);

it("applies speech ducking only to the processed music stem", async () => {
  const p = newProject();
  const bed = encodeAudioSamples(
    Float32Array.from(
      { length: 48000 },
      (_, i) => 0.05 * Math.sin((i * 2 * Math.PI * 220) / 48000),
    ),
    48000,
  );
  p.audio = [
    {
      ...clip("voice", 0),
      transcriptWords: [{ text: "speech", start: 0.1, end: 0.4 }],
    },
    { ...clip("music"), data: bed.data, duration: 1, length: 1 },
  ];
  const dry = wav((await exported(p))["music.wav"]);
  const wet = wav(
    (await exported(p, { ...options(), stemMode: "processed" }))["music.wav"],
  );
  const energy = (samples: number[], a: number, b: number) =>
    samples.slice(a * 96000, b * 96000).reduce((sum, s) => sum + s * s, 0);
  expect(
    energy(wet.samples, 0.2, 0.3) / energy(dry.samples, 0.2, 0.3),
  ).toBeCloseTo(0.35 ** 2, 2);
  expect(
    energy(wet.samples, 0.85, 0.95) / energy(dry.samples, 0.85, 0.95),
  ).toBeCloseTo(1, 2);
}, 30000);

it("selects active-scene audio and preserves scene offsets in combined exports", () => {
  let p = newProject();
  p.workflow = initialWorkflow(p);
  p.workflow.scenes[0].duration = 2;
  p.workflow.scenes.push({ ...p.workflow.scenes[0], id: "second" });
  p.workflow.selectedId = "second";
  p.audio = [
    { ...clip("voice"), sceneId: p.workflow.scenes[0].id },
    { ...clip("sfx"), sceneId: "second", start: 0.125 },
  ];
  expect(audioPlan(p, options()).map((c) => c.lane)).toEqual(["sfx"]);
  expect(audioPlan(p, options())[0].start).toBe(0.125);
  const master = composeProject(p);
  expect(audioPlan(master, { ...options(), duration: 4 })[1].start).toBe(2.125);
});

it("cleans up cancelled and invalid exports without publishing partial ZIPs", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "framescript-stems-fail-"),
  );
  try {
    const p = newProject();
    p.audio = [clip("voice")];
    const controller = new AbortController();
    await expect(
      renderAudioStems(
        p,
        options(),
        path.join(directory, "cancel.zip"),
        ffmpeg!,
        controller.signal,
        () => controller.abort(),
      ),
    ).rejects.toThrow(/cancel/i);
    p.audio[0].data = "data:audio/wav;base64,bm90LWF1ZGlv";
    await expect(
      renderAudioStems(
        p,
        options(),
        path.join(directory, "invalid.zip"),
        ffmpeg!,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow();
    expect(await fs.readdir(directory)).toEqual([]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}, 30000);
