import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";

const exec = promisify(execFile);
export type VoiceEnhancementInput = {
  data: string;
  sampleRate: number;
  frames: number;
  channels: number;
};
const db = (value: number) => 20 * Math.log10(Math.max(value, 1e-10));

/** Conservative signal analysis; quiet windows are only noise candidates, never assumed speech. */
export function analyzeVoice(samples: Float32Array, rate: number) {
  const windows: number[] = [];
  const features: {
    rms: number;
    low: number;
    high: number;
    crossings: number;
  }[] = [];
  const size = Math.max(1, Math.round(rate * 0.02));
  let total = 0,
    low = 0,
    high = 0,
    lp = 0,
    hp = 0,
    peak = 0;
  const a = 1 - Math.exp((-2 * Math.PI * 400) / rate);
  const b = 1 - Math.exp((-2 * Math.PI * 4000) / rate);
  for (let i = 0; i < samples.length; i += size) {
    let energy = 0,
      lowEnergy = 0,
      highEnergy = 0,
      crossings = 0;
    for (let j = i; j < Math.min(samples.length, i + size); j++) {
      const v = Number.isFinite(samples[j]) ? samples[j] : 0;
      lp += a * (v - lp);
      hp += b * (v - hp);
      low += lp * lp;
      high += (v - hp) ** 2;
      lowEnergy += lp * lp;
      highEnergy += (v - hp) ** 2;
      if (j > i && v * samples[j - 1] < 0) crossings++;
      total += v * v;
      energy += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    const rms = Math.sqrt(energy / Math.min(size, samples.length - i));
    windows.push(rms);
    features.push({
      rms,
      low: lowEnergy / Math.max(energy, 1e-20),
      high: highEnergy / Math.max(energy, 1e-20),
      crossings: crossings / size,
    });
  }
  windows.sort((a, b) => a - b);
  const quiet = windows[Math.floor(windows.length * 0.15)] ?? 0;
  const speech = windows[Math.floor(windows.length * 0.8)] ?? 0;
  const noiseDb = db(quiet);
  const active = features.filter((f) => f.rms >= Math.max(speech * 0.2, 0.003));
  const quietFrames = features.filter((f) => f.rms > 0 && f.rms <= quiet * 1.5);
  const mean = (values: number[]) =>
    values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
  const quietMean = mean(quietFrames.map((f) => f.rms));
  const quietVariation =
    Math.sqrt(mean(quietFrames.map((f) => (f.rms - quietMean) ** 2))) /
    Math.max(quietMean, 1e-10);
  // Require a sustained, spectrally noise-like quiet bed. Breath and soft voiced
  // syllables should not be treated as a stationary noise profile.
  let run = 0,
    longestQuiet = 0;
  for (const f of features) {
    run =
      f.rms > 0 && f.rms <= quiet * 1.5 && f.high > 0.15 && f.crossings > 0.08
        ? run + 1
        : 0;
    longestQuiet = Math.max(longestQuiet, run);
  }
  const activeHigh = mean(active.map((f) => f.high));
  const sibilanceFraction =
    active.filter((f) => f.high > 0.22 && f.crossings > 0.12).length /
    Math.max(1, active.length);
  return {
    peak,
    rmsDb: db(Math.sqrt(total / Math.max(1, samples.length))),
    noiseDb,
    denoise:
      noiseDb > -65 &&
      noiseDb < -32 &&
      db(speech) - noiseDb > 16 &&
      longestQuiet >= 8 &&
      quietVariation < 0.25,
    mud: mean(active.map((f) => f.low)) > 0.72,
    bright: activeHigh > 0.12,
    presenceGain: activeHigh < 0.04 ? 1.2 : activeHigh < 0.1 ? 0.6 : 0,
    deessIntensity:
      sibilanceFraction > 0.04
        ? Math.min(0.65, 0.45 + sibilanceFraction * 0.5)
        : 0,
    quietVariation,
    sibilanceFraction,
  };
}

export function voiceFilterChain(analysis: ReturnType<typeof analyzeVoice>) {
  const chain = ["highpass=f=60"];
  if (analysis.denoise)
    chain.push(
      `afftdn=nr=4:nf=${Math.max(-80, Math.min(-20, analysis.noiseDb)).toFixed(1)}:gs=10`,
    );
  if (analysis.mud) chain.push("equalizer=f=300:t=q:w=1:g=-1.5");
  if (analysis.presenceGain && !analysis.deessIntensity)
    chain.push(`equalizer=f=3000:t=q:w=0.7:g=${analysis.presenceGain}`);
  chain.push(
    "acompressor=threshold=0.15:ratio=1.8:attack=15:release=180:makeup=1:knee=2.8",
    "dynaudnorm=f=500:g=21:p=0.9:m=1.5:r=0.12:t=0.015",
  );
  // Level first so quiet recordings trigger the sibilance detector reliably.
  // Only detected treble bursts are ducked; the rest of the voice stays intact.
  if (analysis.deessIntensity)
    chain.push(`deesser=i=${analysis.deessIntensity.toFixed(3)}:m=0.65:f=0.3`);
  return chain;
}

export async function masterVoice(input: VoiceEnhancementInput) {
  if (!ffmpeg) throw Error("Local audio processing is unavailable.");
  const executable = ffmpeg;
  if (input.frames * input.channels * 2 > 36_000_000)
    throw Error("Recording is too large to enhance. Use a shorter source.");
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "framescript-voice-"));
  const source = path.join(work, "source.bin"),
    raw = path.join(work, "analysis.f32"),
    output = path.join(work, "enhanced.wav");
  const run = (args: string[]) =>
    exec(executable, ["-hide_banner", "-nostdin", "-y", ...args], {
      windowsHide: true,
      timeout: 180000,
      maxBuffer: 2_000_000,
    });
  try {
    const match = input.data.match(
      /^data:audio\/[\w.+-]+;base64,([A-Za-z0-9+/=\r\n]+)$/,
    );
    if (!match) throw Error("Invalid audio recording.");
    await fs.writeFile(source, Buffer.from(match[1], "base64"));
    await run([
      "-i",
      source,
      "-t",
      String(input.frames / input.sampleRate),
      "-ac",
      "1",
      "-ar",
      String(input.sampleRate),
      "-f",
      "f32le",
      raw,
    ]);
    const bytes = await fs.readFile(raw);
    const samples = new Float32Array(bytes.length / 4);
    for (let i = 0; i < samples.length; i++)
      samples[i] = bytes.readFloatLE(i * 4);
    const analysis = analyzeVoice(samples, input.sampleRate);
    const chain = voiceFilterChain(analysis);
    // Measure the actual processed signal, then normalize in a second pass.
    const normalizer = "loudnorm=I=-16:TP=-1.5:LRA=7";
    let loudness = normalizer;
    if (analysis.rmsDb > -70) {
      const measured = await run([
        "-i",
        source,
        "-af",
        [...chain, normalizer + ":print_format=json"].join(","),
        "-f",
        "null",
        "-",
      ]);
      const json = measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
      if (!json) throw Error("Unable to measure voice loudness.");
      const m = JSON.parse(json);
      if (
        [
          m.input_i,
          m.input_tp,
          m.input_lra,
          m.input_thresh,
          m.target_offset,
        ].every((v) => Number.isFinite(Number(v)))
      )
        loudness += `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
      chain.push(loudness);
    } else chain.splice(0, chain.length); // Do not amplify silence or near-silence.
    chain.push(
      `aresample=${input.sampleRate}`,
      `apad=whole_len=${input.frames}`,
      `atrim=end_sample=${input.frames}`,
    );
    await run([
      "-i",
      source,
      "-af",
      chain.join(","),
      "-ar",
      String(input.sampleRate),
      "-ac",
      String(input.channels),
      "-c:a",
      "pcm_s16le",
      output,
    ]);
    const result = await fs.readFile(output);
    const measure = async (file: string) => {
      const log = await run([
        "-i",
        file,
        "-af",
        "loudnorm=print_format=json",
        "-f",
        "null",
        "-",
      ]);
      const json = log.stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
      return json ? Number(JSON.parse(json).input_i) : NaN;
    };
    const [originalLufs, processedLufs] = await Promise.all([
      measure(source),
      measure(output),
    ]);
    const reference = Math.min(originalLufs, processedLufs);
    return {
      data: "data:audio/wav;base64," + result.toString("base64"),
      comparisonOriginalGain: Number.isFinite(reference)
        ? Math.pow(10, (reference - originalLufs) / 20)
        : 1,
      comparisonProcessedGain: Number.isFinite(reference)
        ? Math.pow(10, (reference - processedLufs) / 20)
        : 1,
    };
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}
