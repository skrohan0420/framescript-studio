import { waveform } from "../shared/audio";
import type { AudioClip } from "../shared/project";
export async function readData(file: File) {
  if (file.size > 30_000_000) throw Error("Assets must be under 30 MB");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}
export async function audioDetails(data: string) {
  const encoded = data.split(",")[1];
  if (!encoded) throw Error("Invalid audio file");
  const binary = atob(encoded),
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(bytes.buffer);
    return {
      duration: audio.duration,
      peaks: waveform(audio.getChannelData(0)),
    };
  } finally {
    await context.close();
  }
}
export function clipFromAudio(
  value: { name: string; data: string; duration: number; peaks?: number[] },
  lane: AudioClip["lane"],
  sceneId?: string,
): AudioClip {
  return {
    ...value,
    id: crypto.randomUUID(),
    lane,
    sceneId,
    start: 0,
    trimIn: 0,
    length: Math.min(600, value.duration),
    volume: lane === "music" ? 0.15 : 1,
    fadeIn: lane === "music" ? 0.3 : 0,
    fadeOut: lane === "music" ? 0.5 : 0,
    loop: lane === "music",
    muted: false,
    license: "User supplied; verify usage rights",
  };
}
