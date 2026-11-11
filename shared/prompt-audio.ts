import { z } from "zod";

export const musicStyles = [
  "Automatic",
  "Ambient",
  "Cinematic",
  "Electronic",
  "Lo-fi",
  "Orchestral",
] as const;
export const musicMoods = [
  "Automatic",
  "Calm",
  "Mysterious",
  "Uplifting",
  "Tense",
  "Dramatic",
] as const;
export const musicEnergies = ["Subtle", "Balanced", "Intense"] as const;
export const musicTempos = [
  "Automatic",
  "Slow",
  "Medium",
  "Fast",
  "Custom BPM",
] as const;
export const musicTextures = [
  "Warm pads",
  "Soft keys",
  "Plucked tones",
  "Low pulse",
  "Light percussion",
  "Airy noise",
] as const;
export const musicTimings = [
  "Continuous",
  "After the introduction",
  "Build toward the reveal",
] as const;
export const musicEndings = [
  "Fade out",
  "Resolve naturally",
  "Continue into the next clip",
] as const;
export const effectTypes = [
  "Whooshes",
  "Impacts",
  "Clicks",
  "Risers",
  "Ambience",
] as const;
export const effectDensities = ["Minimal", "Key moments", "Frequent"] as const;
export const effectCharacters = [
  "Soft",
  "Realistic",
  "Cinematic",
  "Futuristic",
] as const;
export const effectPlacements = [
  "Transitions",
  "Reveals",
  "Camera moves",
  "Important words",
] as const;
export const narrationBalances = [
  "Narration first",
  "Balanced",
  "Music forward",
] as const;

export const audioDirectionSchema = z.object({
  musicStyle: z.enum(musicStyles).catch("Automatic").default("Automatic"),
  musicMood: z.enum(musicMoods).catch("Automatic").default("Automatic"),
  musicEnergy: z.enum(musicEnergies).catch("Subtle").default("Subtle"),
  musicTempo: z.enum(musicTempos).catch("Automatic").default("Automatic"),
  musicBpm: z.number().int().min(40).max(240).catch(120).default(120),
  musicVolume: z.number().min(0).max(1).catch(0.25).default(0.25),
  musicFadeIn: z.number().min(0).max(10).catch(0.5).default(0.5),
  musicFadeOut: z.number().min(0).max(10).catch(0.8).default(0.8),
  musicTextures: z
    .array(z.enum(musicTextures))
    .max(6)
    .catch(["Warm pads"])
    .default(["Warm pads"]),
  musicNotes: z.string().max(2000).catch("").default(""),
  musicTiming: z.enum(musicTimings).catch("Continuous").default("Continuous"),
  musicEnding: z.enum(musicEndings).catch("Fade out").default("Fade out"),
  effectTypes: z
    .array(z.enum(effectTypes))
    .max(5)
    .catch(["Whooshes", "Impacts"])
    .default(["Whooshes", "Impacts"]),
  effectDensity: z
    .enum(effectDensities)
    .catch("Key moments")
    .default("Key moments"),
  effectCharacter: z.enum(effectCharacters).catch("Soft").default("Soft"),
  effectVolume: z.number().min(0).max(1).catch(0.65).default(0.65),
  effectNotes: z.string().max(2000).catch("").default(""),
  effectPlacement: z
    .array(z.enum(effectPlacements))
    .max(4)
    .catch(["Transitions", "Reveals"])
    .default(["Transitions", "Reveals"]),
  narrationBalance: z
    .enum(narrationBalances)
    .catch("Narration first")
    .default("Narration first"),
  notes: z.string().max(4000).catch("").default(""),
});
export type AudioDirection = z.infer<typeof audioDirectionSchema>;

export function restoreAudioDirection(value: unknown): AudioDirection {
  const parsed = audioDirectionSchema.safeParse(value);
  return parsed.success ? parsed.data : audioDirectionSchema.parse({});
}

const defaults = audioDirectionSchema.parse({});
export const audioPresets = [
  {
    name: "Documentary",
    bgm: true,
    sfx: true,
    audio: {
      ...defaults,
      musicStyle: "Ambient",
      musicMood: "Mysterious",
      musicTempo: "Slow",
      effectTypes: ["Ambience"],
      effectDensity: "Minimal",
      effectPlacement: ["Reveals"],
    },
  },
  {
    name: "Explainer",
    bgm: true,
    sfx: true,
    audio: {
      ...defaults,
      musicStyle: "Electronic",
      musicMood: "Uplifting",
      musicEnergy: "Balanced",
      musicTempo: "Medium",
      effectTypes: ["Clicks", "Whooshes"],
      effectPlacement: ["Reveals", "Important words"],
    },
  },
  {
    name: "Cinematic reveal",
    bgm: true,
    sfx: true,
    audio: {
      ...defaults,
      musicStyle: "Cinematic",
      musicMood: "Tense",
      musicEnergy: "Intense",
      musicTempo: "Slow",
      musicTiming: "Build toward the reveal",
      musicEnding: "Resolve naturally",
      effectTypes: ["Risers", "Impacts"],
      effectCharacter: "Cinematic",
      effectPlacement: ["Reveals", "Camera moves"],
    },
  },
  {
    name: "Minimal",
    bgm: true,
    sfx: false,
    audio: {
      ...defaults,
      musicStyle: "Ambient",
      musicMood: "Calm",
      musicTempo: "Slow",
      effectTypes: ["Clicks"],
      effectDensity: "Minimal",
      effectPlacement: ["Important words"],
    },
  },
] satisfies {
  name: string;
  bgm: boolean;
  sfx: boolean;
  audio: AudioDirection;
}[];

export function audioDirectionPrompt(draft: {
  bgm?: boolean;
  sfx?: boolean;
  audio?: AudioDirection;
}) {
  if (!draft.bgm && !draft.sfx) return "";
  const audio = restoreAudioDirection(draft.audio);
  return [
    "SOUNDTRACK DIRECTION",
    ...(draft.bgm
      ? [
          `Music style: ${audio.musicStyle}. Mood: ${audio.musicMood}. Energy: ${audio.musicEnergy}. Tempo: ${audio.musicTempo}.`,
          `Music timing: ${audio.musicTiming}. Music ending: ${audio.musicEnding}.`,
          ...(audio.musicTempo === "Custom BPM"
            ? [`Music tempo target: ${audio.musicBpm} BPM.`]
            : []),
          `Music texture: ${audio.musicTextures.join(", ") || "Automatic"}. Music track volume: ${audio.musicVolume}. Fade in: ${audio.musicFadeIn}s. Fade out: ${audio.musicFadeOut}s.`,
          ...(audio.musicNotes.trim()
            ? [`Music-specific direction: ${audio.musicNotes.trim()}`]
            : []),
        ]
      : []),
    ...(draft.sfx
      ? [
          `Sound effect types: ${audio.effectTypes.join(", ") || "Automatic"}. Density: ${audio.effectDensity}. Character: ${audio.effectCharacter}.`,
          `Place sound effects at: ${audio.effectPlacement.join(", ") || "appropriate visual beats"}. Follow supplied narration cues when available.`,
          `Sound effect track volume: ${audio.effectVolume}.`,
          ...(audio.effectNotes.trim()
            ? [`Effect-specific direction: ${audio.effectNotes.trim()}`]
            : []),
        ]
      : []),
    `Narration balance: ${audio.narrationBalance}.`,
    ...(audio.narrationBalance === "Narration first"
      ? [
          "Keep music and effects quiet beneath speech. Compose space around narration using score gains, track volume and cue placement.",
        ]
      : []),
    ...(audio.notes.trim()
      ? [`Additional audio direction: ${audio.notes.trim()}`]
      : []),
  ].join("\n");
}
