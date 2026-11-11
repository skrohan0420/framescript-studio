import { z } from "zod";
import { builtinSounds, synthesizeSound, encodeAudioSamples } from "./audio";
import { initialWorkflow } from "./workflow";
import type { AudioClip, Project } from "./project";
const noteSchema = z.object({
  at: z.number().min(0).max(30),
  duration: z.number().positive().max(30),
  frequency: z.number().min(20).max(10000).default(440),
  endFrequency: z.number().min(20).max(10000).optional(),
  wave: z.enum(["sine", "triangle", "square", "noise"]).default("sine"),
  gain: z.number().min(0).max(1).default(0.15),
});
export const generatedAudioSchema = z
  .object({
    tracks: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            name: z.string().min(1).max(200),
            lane: z.enum(["music", "sfx"]),
            start: z.number().min(0).max(600),
            length: z.number().positive().max(600),
            duration: z.number().min(0.05).max(30).optional(),
            loop: z.boolean().default(false),
            volume: z.number().min(0).max(1).default(0.5),
            fadeIn: z.number().min(0).max(60).optional(),
            fadeOut: z.number().min(0).max(60).optional(),
            preset: z.string().optional(),
            notes: z.array(noteSchema).min(1).max(256).optional(),
          })
          .refine(
            (track) => !!track.preset !== !!track.notes,
            "Each track needs either a preset or notes",
          )
          .refine(
            (track) => !track.notes || !!track.duration,
            "Note scores need duration",
          )
          .refine(
            (track) =>
              !track.preset ||
              builtinSounds.some((sound) => sound.name === track.preset),
            "Unknown audio preset",
          )
          .refine(
            (track) =>
              !track.notes ||
              track.notes.every(
                (note) => note.at + note.duration <= track.duration! + 0.000001,
              ),
            "Notes must fit the source duration",
          ),
      )
      .max(8),
  })
  .refine(
    (value) =>
      new Set(value.tracks.map((track) => track.id)).size ===
      value.tracks.length,
    "Audio track IDs must be unique",
  )
  .refine(
    (value) =>
      value.tracks.reduce((sum, track) => sum + (track.duration ?? 8), 0) <= 60,
    "Use at most 60 seconds of source audio per manifest; loop music for longer scenes",
  );
export function audioManifestSource(html: string) {
  if (!html.includes("framescript-audio")) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const scripts = doc.querySelectorAll(
    'script#framescript-audio[type="application/json"]',
  );
  if (scripts.length > 1)
    throw Error("Use only one framescript-audio manifest.");
  return scripts[0]?.textContent ?? "";
}
function scoreAudio(
  track: z.infer<typeof generatedAudioSchema>["tracks"][number],
) {
  if (track.preset) return synthesizeSound(track.preset);
  const rate = 22050,
    duration = track.duration!,
    samples = new Float32Array(Math.ceil(duration * rate));
  let seed = 1234567;
  for (const note of track.notes!) {
    const count = Math.ceil(note.duration * rate),
      start = Math.round(note.at * rate);
    for (let i = 0; i < count && start + i < samples.length; i++) {
      const time = i / rate,
        phase =
          2 *
          Math.PI *
          (note.frequency * time +
            (((note.endFrequency ?? note.frequency) - note.frequency) *
              time *
              time) /
              (2 * note.duration));
      seed = (seed * 16807) % 2147483647;
      const wave =
        note.wave === "noise"
          ? (seed / 2147483647) * 2 - 1
          : note.wave === "triangle"
            ? (2 / Math.PI) * Math.asin(Math.sin(phase))
            : note.wave === "square"
              ? Math.tanh(Math.sin(phase) * 5)
              : Math.sin(phase);
      const envelope = Math.max(
        0,
        Math.min(1, time / 0.01, (note.duration - time) / 0.03),
      );
      samples[start + i] += wave * note.gain * envelope;
    }
  }
  for (let i = 0; i < samples.length; i++)
    samples[i] = Math.max(-1, Math.min(1, samples[i]));
  return { name: track.name, duration, ...encodeAudioSamples(samples, rate) };
}
export function applyGeneratedAudio(project: Project): Project {
  const source = audioManifestSource(project.html);
  const manifest = source.trim()
    ? generatedAudioSchema.parse(JSON.parse(source))
    : { tracks: [] };
  const workflow = project.workflow ?? initialWorkflow(project);
  const existing = project.audio ?? [];
  const unmanaged = existing.filter(
    (clip) => !clip.generatedSource || clip.sceneId !== workflow.selectedId,
  );
  const generated = manifest.tracks.flatMap((track): AudioClip[] => {
    if (track.start >= project.settings.duration)
      throw Error(`Audio ${track.name} starts after this scene ends.`);
    const encoded = JSON.stringify(track);
    let hash = 2166136261;
    for (let i = 0; i < encoded.length; i++)
      hash = Math.imul(hash ^ encoded.charCodeAt(i), 16777619);
    const generatedSource = `code:${track.id}:${hash >>> 0}`;
    const cached = existing.filter(
      (clip) =>
        clip.sceneId === workflow.selectedId &&
        clip.generatedSource === generatedSource,
    );
    if (cached.length) return cached;
    const audio = scoreAudio(track);
    const length = Math.min(
      track.length,
      project.settings.duration - track.start,
      track.loop ? 600 : audio.duration,
    );
    return [
      {
        id: crypto.randomUUID(),
        name: track.name,
        data: audio.data,
        duration: audio.duration,
        peaks: audio.peaks,
        lane: track.lane,
        sceneId: workflow.selectedId,
        start: track.start,
        trimIn: 0,
        length,
        volume: track.volume,
        fadeIn: Math.min(track.fadeIn ?? 0.02, length / 2),
        fadeOut: Math.min(track.fadeOut ?? 0.04, length / 2),
        loop: track.loop,
        muted: false,
        generatedSource,
        license: "Procedural audio synthesized from scene code",
      },
    ];
  });
  if (unmanaged.length + generated.length > 60)
    throw Error("Generated audio exceeds the project’s 60-clip limit.");
  return {
    ...project,
    ...(manifest.tracks.length ? { workflow } : {}),
    audio: [...unmanaged, ...generated],
  };
}
