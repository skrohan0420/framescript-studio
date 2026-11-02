import { expect, it } from "vitest";
import {
  audioTimelineRows,
  editAudioClip,
  snapAudioEdit,
} from "../shared/audio-edit";
import type { AudioClip } from "../shared/project";
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
