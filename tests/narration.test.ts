import { expect, it } from "vitest";
import { applyAI, newProject } from "../shared/project";
import {
  initialWorkflow,
  localStoryboard,
  scenesFromPlan,
  activateScene,
} from "../shared/workflow";
import {
  narrationLength,
  timeScenesToNarration,
  withAudioClip,
} from "../shared/narration";
import { audioPlan } from "../server/audio-export";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";
const script = "Stars shine above us. ".repeat(18).trim();
function setup() {
  const p = newProject();
  p.workflow = { ...initialWorkflow(p), script };
  const voice = {
    ...clipFromAudio(synthesizeSound("Ambient loop"), "voice"),
    transcript: script,
  };
  return { p, voice };
}
it("composes all scenes to measured full narration, preserving script and source audio", () => {
  const { p, voice } = setup();
  const withVoice = withAudioClip(p, voice);
  const scenes = timeScenesToNarration(
    scenesFromPlan(script, localStoryboard(script), p),
    voice,
    script,
  );
  expect(scenes.length).toBeGreaterThan(1);
  expect(scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBeCloseTo(
    voice.duration,
    8,
  );
  expect(scenes.map((scene) => scene.narration).join(" ")).toBe(script);
  expect(withVoice.audio![0].data).toBe(voice.data);
  expect(withVoice.settings.duration).toBe(voice.duration);
});
it("uses playable audio after trim and rejects changed scripts or locked timing", () => {
  const { p, voice } = setup();
  const scenes = scenesFromPlan(script, localStoryboard(script), p);
  const trimmed = { ...voice, start: 0.2, trimIn: 2, length: 8 };
  expect(narrationLength(trimmed)).toBe(6);
  expect(
    timeScenesToNarration(scenes, trimmed, script).reduce(
      (n, s) => n + s.duration,
      0,
    ),
  ).toBeCloseTo(6.2);
  expect(() =>
    timeScenesToNarration(scenes, voice, script + " Changed."),
  ).toThrow("script changed");
  expect(() =>
    timeScenesToNarration(
      scenes.map((s) => ({ ...s, locked: true })),
      voice,
      script,
    ),
  ).toThrow("Unlock");
});
it("fits scene narration atomically and replaces old takes without removing effects", () => {
  const { p } = setup();
  const id = p.workflow!.selectedId;
  const effect = clipFromAudio(synthesizeSound("Soft pop"), "sfx", id);
  const old = clipFromAudio(synthesizeSound("Ambient loop"), "voice", id);
  p.audio = [effect, old];
  const take = clipFromAudio(synthesizeSound("Success chime"), "voice", id);
  const next = withAudioClip(p, take);
  expect(next.settings.duration).toBeCloseTo(1.2);
  expect(next.workflow!.scenes[0].duration).toBeCloseTo(1.2);
  expect(next.audio!.find((a) => a.id === old.id)!.muted).toBe(true);
  expect(next.audio!.find((a) => a.id === effect.id)!.muted).toBe(false);
  expect(p.settings.duration).toBe(10);
  expect(() =>
    withAudioClip(
      {
        ...p,
        workflow: {
          ...p.workflow!,
          scenes: p.workflow!.scenes.map((s) => ({ ...s, locked: true })),
        },
      },
      take,
    ),
  ).toThrow("Unlock");
});
it("preserves audio-controlled scene length during AI visual generation", () => {
  const { p, voice } = setup();
  const next = withAudioClip(p, voice);
  const result = applyAI(next, {
    action: "update",
    html: '<div id="visual"></div>',
    settings: { duration: 0.1 },
    explanation: "New visuals",
  });
  expect(result.settings.duration).toBe(voice.duration);
  expect(result.audio).toEqual(next.audio);
});
it("scene export seeks into the full narration at the selected scene offset", () => {
  const { p, voice } = setup();
  const scenes = timeScenesToNarration(
    scenesFromPlan(script, localStoryboard(script), p),
    voice,
    script,
  );
  p.workflow = { ...p.workflow!, scenes, selectedId: scenes[1].id };
  Object.assign(p, activateScene(p, scenes[1].id));
  p.audio = [voice];
  const plan = audioPlan(p, {
    format: "mp4",
    width: 320,
    height: 180,
    duration: scenes[1].duration,
    fps: 10,
    speed: 1,
    quality: 24,
    fit: "fit",
    transparent: false,
    time: 0,
  });
  expect(plan).toHaveLength(1);
  expect(plan[0].start).toBeCloseTo(-scenes[0].duration);
});
it("does not overlap full-script and scene voices and refuses silently truncated long narration", () => {
  const { p, voice } = setup();
  const full = withAudioClip(p, voice);
  const sceneTake = { ...voice, sceneId: p.workflow!.selectedId };
  expect(() => withAudioClip(full, sceneTake)).toThrow("Mute the full-script");
  expect(() => withAudioClip(p, { ...voice, duration: 601 })).toThrow(
    "ten-minute",
  );
  const previous = withAudioClip(p, sceneTake);
  const replaced = withAudioClip(previous, { ...voice, id: "full" });
  expect(replaced.audio!.find((a) => a.id === sceneTake.id)!.muted).toBe(true);
});
