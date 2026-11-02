import { normalizeCuts, type CutRange } from "../shared/silence";
import { waveform } from "../shared/audio";

export async function decodeRecording(data: string) {
  const context = new AudioContext();
  try {
    const bytes = Uint8Array.from(atob(data.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    return await context.decodeAudioData(bytes.buffer);
  } finally {
    await context.close();
  }
}
export function cutRecording(audio: AudioBuffer, input: CutRange[]) {
  const rate = audio.sampleRate;
  const cuts = normalizeCuts(input, audio.duration).map((c) => ({
    start: Math.floor(c.start * rate) / rate,
    end: Math.floor(c.end * rate) / rate,
  }));
  const keep: CutRange[] = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start > cursor) keep.push({ start: cursor, end: cut.start });
    cursor = cut.end;
  }
  if (cursor < audio.duration)
    keep.push({ start: cursor, end: audio.duration });
  const ranges = keep.map((c) => ({
    start: Math.round(c.start * rate),
    end: Math.round(c.end * rate),
  }));
  const frames = ranges.reduce((n, c) => n + c.end - c.start, 0),
    count = audio.numberOfChannels;
  if (frames < rate * 0.05) throw Error("Keep at least 0.05 seconds of audio.");
  const size = 44 + frames * count * 2;
  if ((size * 4) / 3 > 49_000_000)
    throw Error(
      "Cleaned WAV would exceed the audio size limit. Use a shorter recording.",
    );
  const bytes = new Uint8Array(size),
    view = new DataView(bytes.buffer);
  const str = (offset: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, size - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, count, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * count * 2, true);
  view.setUint16(32, count * 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, size - 44, true);
  const channels = Array.from({ length: count }, (_, i) =>
    audio.getChannelData(i),
  );
  const peaksInput = new Float32Array(frames);
  let output = 0;
  for (const range of ranges)
    for (let i = range.start; i < range.end; i++) {
      for (let ch = 0; ch < count; ch++) {
        // Tiny boundary fades suppress splice clicks without changing time.
        const gain = Math.min(
          1,
          (i - range.start) / Math.max(1, rate * 0.003),
          (range.end - 1 - i) / Math.max(1, rate * 0.003),
        );
        const sample = Math.max(-1, Math.min(1, channels[ch][i] * gain));
        view.setInt16(
          44 + (output * count + ch) * 2,
          Math.round(sample * 32767),
          true,
        );
        peaksInput[output] = Math.max(peaksInput[output], Math.abs(sample));
      }
      output++;
    }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    data: "data:audio/wav;base64," + btoa(binary),
    duration: frames / rate,
    peaks: waveform(peaksInput, 2048),
    cuts,
  };
}
