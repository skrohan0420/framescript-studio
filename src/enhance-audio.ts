import { waveform } from "../shared/audio";
import type { AudioClip } from "../shared/project";
import { bridge } from "./bridge";
import { audioDetails } from "./audio";

export async function toggleAudioEnhancement(clip: AudioClip) {
  if (
    clip.enhancement &&
    (clip.enhanced || clip.enhancement.version === 4 || clip.lane !== "voice")
  ) {
    const enabled = !clip.enhanced;
    return {
      enhanced: enabled,
      enhancement: clip.enhancement,
      data: enabled
        ? clip.enhancement.processedData
        : clip.enhancement.originalData,
      peaks: enabled
        ? clip.enhancement.processedPeaks
        : clip.enhancement.originalPeaks,
    };
  }
  if (clip.enhanced)
    throw Error(
      "This older enhancement has no saved original. Undo the earlier enhancement or reimport the original to enable toggling.",
    );
  const originalData = clip.enhancement?.originalData ?? clip.data;
  const result = await enhanceAudio(originalData, clip.lane === "voice");
  return {
    ...result,
    enhanced: true,
    enhancement: {
      version: 4,
      comparisonOriginalGain:
        "comparisonOriginalGain" in result
          ? (result.comparisonOriginalGain as number)
          : undefined,
      comparisonProcessedGain:
        "comparisonProcessedGain" in result
          ? (result.comparisonProcessedGain as number)
          : undefined,
      originalData,
      originalPeaks: clip.enhancement?.originalPeaks ?? clip.peaks,
      processedData: result.data,
      processedPeaks: result.peaks,
    },
  };
}

/** Local processing retains channel count, sample rate and sample positions. */
export async function enhanceAudio(data: string, voice: boolean) {
  const context = new AudioContext();
  let decoded: AudioBuffer;
  try {
    const bytes = Uint8Array.from(atob(data.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    decoded = await context.decodeAudioData(bytes.buffer);
  } finally {
    await context.close();
  }
  if (voice) {
    const result = await bridge.call("enhanceVoice", {
      data,
      sampleRate: decoded.sampleRate,
      frames: decoded.length,
      channels: decoded.numberOfChannels,
    });
    return {
      data: result.data,
      comparisonOriginalGain: result.comparisonOriginalGain,
      comparisonProcessedGain: result.comparisonProcessedGain,
      peaks: (await audioDetails(result.data)).peaks,
    };
  }
  const byteLength = 44 + decoded.length * decoded.numberOfChannels * 2;
  if (Math.ceil(byteLength / 3) * 4 > 49_000_000)
    throw Error(
      "This recording is too large to enhance locally. Use a shorter source recording.",
    );
  const offline = new OfflineAudioContext(
    decoded.numberOfChannels,
    decoded.length,
    decoded.sampleRate,
  );
  const source = offline.createBufferSource();
  source.buffer = decoded;
  const filter = offline.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = voice ? 70 : 25;
  filter.Q.value = 0.707;
  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = voice ? -20 : -12;
  compressor.knee.value = 18;
  compressor.ratio.value = voice ? 2.5 : 1.5;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.18;
  source.connect(filter).connect(compressor).connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const channels = Array.from({ length: rendered.numberOfChannels }, (_, i) =>
    rendered.getChannelData(i),
  );
  let peak = 0,
    energy = 0;
  for (const channel of channels)
    for (const value of channel) {
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
  const rms = Math.sqrt(energy / (rendered.length * channels.length));
  // Bound boost to 6 dB and leave 1 dB sample-peak headroom; silence stays silent.
  const gain =
    rms > 0.0001
      ? Math.min(
          2,
          Math.pow(10, -20 / 20) / rms,
          Math.pow(10, -1 / 20) / Math.max(peak, 1e-9),
        )
      : 1;
  const bytes = new Uint8Array(byteLength),
    view = new DataView(bytes.buffer);
  const str = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, byteLength - 8, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, rendered.sampleRate, true);
  view.setUint32(28, rendered.sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, byteLength - 44, true);
  const peaks = channels.map((channel) =>
    waveform(
      Float32Array.from(channel, (v) => v * gain),
      2048,
    ),
  );
  for (let i = 0; i < rendered.length; i++)
    for (let c = 0; c < channels.length; c++)
      view.setInt16(
        44 + (i * channels.length + c) * 2,
        Math.round(Math.max(-1, Math.min(1, channels[c][i] * gain)) * 32767),
        true,
      );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    data: "data:audio/wav;base64," + btoa(binary),
    peaks: peaks[0].map((_, i) => Math.max(...peaks.map((p) => p[i]))),
  };
}
