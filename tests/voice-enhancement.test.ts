import { expect, it } from "vitest";
import { analyzeVoice, masterVoice, voiceFilterChain } from "../server/voice-enhancement";
import { encodeAudioSamples } from "../shared/audio";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { mixAudio } from "../server/audio-export";
import { newProject, exportSchema } from "../shared/project";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

it("masters varying speech-like audio with measured loudness, peak headroom and exact duration", async () => {
  const rate = 48000;
  const samples = Float32Array.from({ length: rate * 8 }, (_, i) => {
    const t = i / rate, phase = t % 1;
    const envelope = phase < 0.75 ? Math.min(1, phase / 0.03, (0.75 - phase) / 0.03) : 0;
    return envelope * (Math.floor(t) % 2 ? 0.12 : 0.35) * (Math.sin(t * 2 * Math.PI * 180) + 0.3 * Math.sin(t * 2 * Math.PI * 3000));
  });
  const input = encodeAudioSamples(samples, rate);
  const result = await masterVoice({ data: input.data, sampleRate: rate, frames: samples.length, channels: 1 });
  expect(result.comparisonOriginalGain).toBeGreaterThan(0);
  expect(result.comparisonOriginalGain).toBeLessThanOrEqual(1);
  expect(result.comparisonProcessedGain).toBeGreaterThan(0);
  expect(result.comparisonProcessedGain).toBeLessThanOrEqual(1);
  const buffer = Buffer.from(result.data.split(",")[1], "base64");
  let offset = 12, length = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32LE(offset + 4);
    if (buffer.toString("ascii", offset, offset + 4) === "data") { length = size; break; }
    offset += 8 + size + size % 2;
  }
  expect(length / 2).toBe(samples.length);
  expect(result.data).not.toBe(input.data);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "voice-test-"));
  try {
    const file = path.join(work, "out.wav");
    await fs.writeFile(file, buffer);
    const measured = await promisify(execFile)(ffmpeg!, ["-hide_banner", "-i", file, "-af", "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"], { windowsHide: true });
    const m = JSON.parse(measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)![0]);
    expect(Number(m.input_i)).toBeGreaterThan(-17);
    expect(Number(m.input_i)).toBeLessThan(-15);
    expect(Number(m.input_tp)).toBeLessThanOrEqual(-1.3);
    const originalFile = path.join(work, "original.wav");
    await fs.writeFile(originalFile, Buffer.from(input.data.split(",")[1], "base64"));
    const originalLog = await promisify(execFile)(ffmpeg!, ["-hide_banner", "-i", originalFile, "-af", "loudnorm=print_format=json", "-f", "null", "-"], { windowsHide: true });
    const original = JSON.parse(originalLog.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)![0]);
    expect(Number(original.input_i) + 20 * Math.log10(result.comparisonOriginalGain)).toBeCloseTo(Number(m.input_i) + 20 * Math.log10(result.comparisonProcessedGain), 1);
  } finally { await fs.rm(work, { recursive: true, force: true }); }
}, 60000);

it("does not classify clean silence or continuous tones as a noise-only region", () => {
  expect(analyzeVoice(new Float32Array(48000), 48000).denoise).toBe(false);
  const tone = Float32Array.from({ length: 48000 }, (_, i) => Math.sin(i / 48000 * Math.PI * 400) * 0.2);
  expect(analyzeVoice(tone, 48000).denoise).toBe(false);
  expect(voiceFilterChain(analyzeVoice(tone, 48000)).join(",")).not.toContain("deesser");
});

it("keeps quiet voiced speech and distinguishes a stationary noise bed from sibilance", () => {
  const rate = 48000;
  const quietSpeech = Float32Array.from({ length: rate * 2 }, (_, i) => Math.sin(i / rate * Math.PI * 400) * (i < rate ? 0.004 : 0.2));
  expect(analyzeVoice(quietSpeech, rate).denoise).toBe(false);
  let seed = 123;
  const noisy = Float32Array.from({ length: rate * 2 }, (_, i) => {
    seed = (seed * 16807) % 2147483647;
    return ((seed / 2147483647) * 2 - 1) * 0.003 + (i < rate ? 0 : Math.sin(i / rate * Math.PI * 400) * 0.2);
  });
  expect(analyzeVoice(noisy, rate).denoise).toBe(true);
  const sibilant = Float32Array.from({ length: rate * 2 }, (_, i) => Math.sin(i / rate * Math.PI * (i % rate < rate / 4 ? 14000 : 400)) * 0.15);
  expect(analyzeVoice(sibilant, rate).deessIntensity).toBeGreaterThan(0);
  expect(voiceFilterChain(analyzeVoice(sibilant, rate)).join(",")).toContain("deesser");
});

it("reduces sibilant treble bursts while preserving the voiced body", async () => {
  const rate = 48000;
  let seed = 321, lp = 0;
  const samples = Float32Array.from({ length: rate * 2 }, (_, i) => {
    seed = seed * 16807 % 2147483647;
    const noise = (seed / 2147483647 * 2 - 1) * 0.3;
    lp += 0.35 * (noise - lp);
    return Math.sin(i / rate * Math.PI * 400) * 0.12 + (i >= rate ? noise - lp : 0);
  });
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "deess-test-"));
  try {
    const input = path.join(work, "in.wav"), out = path.join(work, "out.f32");
    await fs.writeFile(input, Buffer.from(encodeAudioSamples(samples, rate).data.split(",")[1], "base64"));
    await promisify(execFile)(ffmpeg!, ["-hide_banner", "-y", "-i", input, "-af", "deesser=i=0.55:m=0.65:f=0.3", "-f", "f32le", out], { windowsHide: true });
    const data = await fs.readFile(out);
    let beforeBody = 0, afterBody = 0, beforeTreble = 0, afterTreble = 0, beforeLp = 0, afterLp = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = data.readFloatLE(i * 4);
      beforeLp += 0.35 * (samples[i] - beforeLp);
      afterLp += 0.35 * (v - afterLp);
      if (i > rate / 4 && i < rate * 0.75) { beforeBody += samples[i] ** 2; afterBody += v ** 2; }
      if (i > rate * 1.25) { beforeTreble += (samples[i] - beforeLp) ** 2; afterTreble += (v - afterLp) ** 2; }
    }
    expect(10 * Math.log10(afterBody / beforeBody)).toBeGreaterThan(-1);
    expect(10 * Math.log10(afterTreble / beforeTreble)).toBeLessThan(-3);
  } finally { await fs.rm(work, { recursive: true, force: true }); }
});

it("exports an enhanced voice and ducked music through the real FFmpeg graph", async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "voice-mix-test-"));
  const video = path.join(work, "video.mp4");
  try {
    await promisify(execFile)(ffmpeg!, ["-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:r=24:d=3", "-c:v", "libx264", video], { windowsHide: true });
    const p = newProject();
    p.audio = [
      { ...clipFromAudio(synthesizeSound("Success chime"), "voice"), enhanced: true, start: 0.5, transcriptWords: [{ text: "test", start: 0.1, end: 0.8 }] },
      { ...clipFromAudio(synthesizeSound("Ambient loop"), "music"), length: 3 },
    ];
    const options = exportSchema.parse({ format: "mp4", width: 64, height: 64, fps: 24, duration: 3, speed: 1, quality: 20, fit: "fit", transparent: false });
    await mixAudio(ffmpeg!, video, p, options, new AbortController().signal);
    const checked = await promisify(execFile)(ffmpeg!, ["-hide_banner", "-i", video, "-map", "0:a", "-af", "loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"], { windowsHide: true });
    const m = JSON.parse(checked.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)![0]);
    expect(Number(m.input_i)).toBeGreaterThan(-18);
    expect(Number(m.input_i)).toBeLessThan(-14);
    expect(Number(m.input_tp), checked.stderr).toBeLessThanOrEqual(-1);
  } finally { await fs.rm(work, { recursive: true, force: true }); }
}, 60000);
