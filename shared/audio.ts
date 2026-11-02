export const builtinSounds = [
  { name: "Soft pop", lane: "sfx", duration: 0.3 },
  { name: "UI click", lane: "sfx", duration: 0.12 },
  { name: "Whoosh", lane: "sfx", duration: 0.8 },
  { name: "Impact", lane: "sfx", duration: 0.7 },
  { name: "Success chime", lane: "sfx", duration: 1.2 },
  { name: "Ambient loop", lane: "music", duration: 8 },
  { name: "Gentle pulse", lane: "music", duration: 8 },
  { name: "Minimal keys", lane: "music", duration: 8 },
] as const;
export function synthesizeSound(name: string) {
  const preset = builtinSounds.find((s) => s.name === name);
  if (!preset) throw Error("Unknown sound");
  const rate = 22050,
    n = Math.ceil(rate * preset.duration),
    samples = new Float32Array(n);
  let seed = 1234567,
    filtered = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate,
      u = t / preset.duration;
    seed = (seed * 16807) % 2147483647;
    const noise = (seed / 2147483647) * 2 - 1;
    filtered = filtered * 0.8 + noise * 0.2;
    let v = 0;
    if (preset.lane === "music") {
      const chords = [130.813, 164.814, 195.998],
        fade = Math.min(1, t / 0.04, (preset.duration - t) / 0.04);
      v =
        chords.reduce(
          (sum, f, j) => sum + Math.sin(t * f * 2 * Math.PI + j * 0.4),
          0,
        ) * 0.045;
      if (name === "Gentle pulse")
        v *= 0.4 + 0.6 * Math.pow(Math.sin(t * Math.PI * 2), 2);
      if (name === "Minimal keys") {
        const phase = t % 0.5;
        v =
          Math.sin(
            t *
              [261.626, 329.628, 391.995, 523.251][Math.floor(t * 2) % 4] *
              2 *
              Math.PI,
          ) *
          Math.exp(-phase * 9) *
          0.15;
      }
      v *= fade;
    } else if (name === "Whoosh") v = filtered * Math.sin(Math.PI * u) * 0.7;
    else if (name === "Impact")
      v =
        (Math.sin(t * 65 * 2 * Math.PI) * 0.4 + filtered * 0.3) *
        Math.exp(-t * 9);
    else if (name === "Success chime")
      v =
        Math.sin(t * (t < 0.4 ? 523.25 : 659.25) * 2 * Math.PI) *
        Math.exp(-(t % 0.4) * 8) *
        0.22 *
        (1 - u);
    else
      v =
        Math.sin(
          2 *
            Math.PI *
            (name === "UI click" ? 1000 * t : 500 * t - 650 * t * t),
        ) *
        Math.exp(-t * 25) *
        0.35;
    samples[i] = Math.max(-1, Math.min(1, v));
  }
  return {
    name: preset.name,
    lane: preset.lane,
    duration: preset.duration,
    ...encodeAudioSamples(samples, rate),
    license:
      "Original synthesized FrameScript preset; no external sample recording",
  };
}
export function encodeAudioSamples(samples: Float32Array, rate = 22050) {
  const n = samples.length;
  const bytes = new Uint8Array(44 + n * 2),
    view = new DataView(bytes.buffer);
  const str = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    view.setInt16(44 + i * 2, Math.round(samples[i] * 32767), true);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    data: "data:audio/wav;base64," + btoa(binary),
    peaks: waveform(samples),
  };
}
export function waveform(samples: Float32Array, bins = 64) {
  return Array.from({ length: bins }, (_, i) => {
    const start = Math.floor((samples.length * i) / bins),
      end = Math.floor((samples.length * (i + 1)) / bins);
    let peak = 0;
    for (let j = start; j < end; j++)
      peak = Math.max(peak, Math.abs(samples[j]));
    return Math.min(1, peak);
  });
}
