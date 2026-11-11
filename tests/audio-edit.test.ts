import { expect, it } from "vitest";
import {
  audioTimelineRows,
  editAudioClip,
  snapAudioEdit,
  updateAudioClip,
} from "../shared/audio-edit";
import { newProject, projectSchema, type AudioClip } from "../shared/project";
import { initialWorkflow, totalDuration } from "../shared/workflow";
const clip: AudioClip = {
  id: "take",
  name: "Take",
  data: "data:audio/wav;base64,AA==",
  duration: 10,
  lane: "voice",
  start: 2,
  trimIn: 1,
  length: 4,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  loop: false,
  muted: false,
  license: "Test",
};
it("shares rows for adjacent clips while keeping overlaps and audio types separate", () => {
  const first = { ...clip, id: "first", start: 0, length: 2 };
  const second = { ...clip, id: "second", start: 2, length: 3 };
  const overlap = { ...clip, id: "overlap", start: 1, length: 2 };
  const music = { ...first, id: "music", lane: "music" as const };
  const rows = audioTimelineRows([second, overlap, first, music]);
  expect(rows.map((row) => row.clips.map((item) => item.id))).toEqual([
    ["first", "second"],
    ["music"],
    ["overlap"],
  ]);
  expect(
    audioTimelineRows(
      [first, second],
      (item) => item.start + (item.id === "first" ? 10 : 0),
    ),
  ).toHaveLength(1);
});
it("snaps the nearest moving or trimming edge and respects source and scope limits", () => {
  expect(snapAudioEdit(clip, 1.04, "move", 12, [3], 0.08).clip.start).toBe(3);
  expect(
    snapAudioEdit(clip, 0.96, "move", 12, [7], 0.08).clip.start + clip.length,
  ).toBe(7);
  const start = snapAudioEdit(clip, 0.97, "trim-start", 12, [3], 0.08);
  expect(start.clip.start).toBe(3);
  expect(start.clip.trimIn).toBe(2);
  expect(start.clip.start + start.clip.length).toBe(6);
  expect(snapAudioEdit(clip, 0.96, "trim-end", 12, [7], 0.08).clip.length).toBe(
    5,
  );
  expect(
    snapAudioEdit(clip, 1.2, "move", 12, [3], 0.08).target,
  ).toBeUndefined();
  expect(snapAudioEdit(clip, 1, "move", 6, [3], 0.08).clip.start).toBe(2);
  expect(
    snapAudioEdit(clip, 5, "trim-end", 20, [11.04], 0.08).target,
  ).toBeUndefined();
});
it("moves audio inside its scope and trims the source without moving its right edge", () => {
  expect(editAudioClip(clip, -100, "move", 8).start).toBe(0);
  expect(editAudioClip(clip, 100, "move", 8).start).toBe(4);
  const trimmed = editAudioClip(clip, 1.5, "trim-start", 8);
  expect(trimmed.start).toBe(3.5);
  expect(trimmed.trimIn).toBe(2.5);
  expect(trimmed.start + trimmed.length).toBe(clip.start + clip.length);
  expect(editAudioClip(clip, -100, "trim-start", 8).trimIn).toBe(0);
});
it("does not extend beyond the recording or scope and permits looped source reuse", () => {
  expect(editAudioClip(clip, 100, "trim-end", 20).length).toBe(9);
  expect(editAudioClip(clip, 100, "trim-end", 6).length).toBe(4);
  expect(
    editAudioClip({ ...clip, loop: true }, 100, "trim-end", 20).length,
  ).toBe(18);
  expect(editAudioClip(clip, -100, "trim-end", 20).length).toBe(0.01);
});

it("appends audio by extending its timeline while preserving visual continuations and other audio", () => {
  const project = newProject();
  project.settings.duration = 6;
  project.workflow = initialWorkflow(project);
  const scene = project.workflow.scenes[0];
  scene.visualDuration = 3;
  scene.visualContinuations = [
    {
      id: crypto.randomUUID(),
      start: 3,
      duration: 3,
      html: "<div>Continuation</div>",
      css: "",
      js: "",
    },
  ];
  const first = {
    ...clip,
    id: "first",
    sceneId: scene.id,
    start: 0,
    length: 6,
  };
  const second = { ...clip, sceneId: scene.id, start: 2, length: 4 };
  project.audio = [first, second];
  const moved = snapAudioEdit(second, 4.02, "move", 600, [6], 0.08).clip;
  const next = projectSchema.parse({
    ...project,
    ...updateAudioClip(project, moved),
  });
  expect(next.settings.duration).toBe(10);
  expect(next.workflow!.scenes[0]).toEqual({ ...scene, duration: 10 });
  expect(next.audio![0]).toEqual(first);
  expect(next.audio![1]).toEqual({ ...second, start: 6 });
  expect(audioTimelineRows(next.audio!)).toHaveLength(1);
});

it("extends the last timeline for master audio and respects locks and the total duration limit", () => {
  const project = newProject();
  project.settings.duration = 6;
  project.workflow = initialWorkflow(project);
  project.workflow.scenes.push({
    ...project.workflow.scenes[0],
    id: "second",
    duration: 2,
  });
  project.audio = [clip];
  const moved = { ...clip, start: 8 };
  const next = projectSchema.parse({
    ...project,
    ...updateAudioClip(project, moved),
  });
  expect(totalDuration(next)).toBe(12);
  expect(next.settings.duration).toBe(6);
  expect(next.workflow!.scenes[1].visualDuration).toBe(2);
  expect(() => updateAudioClip(project, { ...clip, start: 599 })).toThrow(
    "ten-minute",
  );
  project.workflow.scenes[1].locked = true;
  expect(() => updateAudioClip(project, moved)).toThrow("Unlock");
});
