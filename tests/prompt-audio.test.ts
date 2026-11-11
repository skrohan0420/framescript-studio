import { expect, it } from "vitest";
import {
  restoreAudioDirection,
  audioPresets,
  audioDirectionPrompt,
} from "../shared/prompt-audio";
import {
  buildCodePrompt,
  buildStructuredSceneBrief,
  type PromptDraft,
} from "../shared/prompt-templates";

const draft: PromptDraft = {
  template: "canvas",
  script: "Reveal the galaxy.",
  duration: 10,
  style: "Cinematic",
  visuals: "",
  camera: "",
  screenText: "",
  notes: "",
  format: "document",
};

it("keeps advanced music and effect directions scoped to enabled tracks", () => {
  const audio = restoreAudioDirection({
    musicTempo: "Custom BPM",
    musicBpm: 138,
    musicTextures: ["Soft keys", "Low pulse"],
    musicVolume: 0.18,
    musicFadeIn: 1.2,
    musicFadeOut: 1.5,
    musicNotes: "Leave space for speech",
    effectNotes: "One reveal impact",
    effectVolume: 0.45,
  });
  const music = audioDirectionPrompt({ bgm: true, audio });
  expect(music).toContain("138 BPM");
  expect(music).toContain("Soft keys, Low pulse");
  expect(music).toContain("Fade in: 1.2s. Fade out: 1.5s.");
  expect(music).toContain(audio.musicNotes);
  expect(music).not.toContain(audio.effectNotes);
  const effects = audioDirectionPrompt({ sfx: true, audio });
  expect(effects).toContain("Sound effect track volume: 0.45");
  expect(effects).toContain(audio.effectNotes);
  expect(effects).not.toContain("138 BPM");
  expect(effects).not.toContain(audio.musicNotes);
});

it("restores old drafts and recovers invalid fields without losing valid choices", () => {
  expect(restoreAudioDirection(undefined)).toMatchObject({
    musicStyle: "Automatic",
    narrationBalance: "Narration first",
  });
  expect(
    restoreAudioDirection({
      musicStyle: "obsolete",
      musicMood: "Calm",
      notes: "Quiet bed",
    }),
  ).toMatchObject({
    musicStyle: "Automatic",
    musicMood: "Calm",
    notes: "Quiet bed",
  });
  expect(buildCodePrompt({ ...draft, bgm: true }, 1920, 1080)).toContain(
    "Music style: Automatic",
  );
});

it("includes the selected direction in coded and structured prompts and excludes disabled audio", () => {
  const audio = {
    ...audioPresets[2].audio,
    notes: "One soft impact when the galaxy appears.",
  };
  for (const build of [buildCodePrompt, buildStructuredSceneBrief]) {
    const prompt = build({ ...draft, bgm: true, sfx: true, audio }, 1920, 1080);
    for (const text of [
      "Music style: Cinematic",
      "Mood: Tense",
      "Build toward the reveal",
      "Resolve naturally",
      "Risers, Impacts",
      "Reveals, Camera moves",
      "Narration balance: Narration first",
      audio.notes,
    ])
      expect(prompt).toContain(text);
    const musicOnly = build(
      { ...draft, bgm: true, sfx: false, audio },
      1920,
      1080,
    );
    expect(musicOnly).toContain("Music style: Cinematic");
    expect(musicOnly).not.toContain("Risers, Impacts");
    const effectsOnly = build(
      { ...draft, bgm: false, sfx: true, audio },
      1920,
      1080,
    );
    expect(effectsOnly).toContain("Risers, Impacts");
    expect(effectsOnly).not.toContain("Music style: Cinematic");
    const silent = build(
      { ...draft, bgm: false, sfx: false, audio },
      1920,
      1080,
    );
    expect(silent).not.toContain("SOUNDTRACK DIRECTION");
    expect(silent).not.toContain(audio.notes);
  }
});
