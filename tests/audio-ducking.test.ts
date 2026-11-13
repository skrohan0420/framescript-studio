import { expect, it } from "vitest";
import { musicDuckGain, musicDuckExpression, speechRanges } from "../shared/audio-ducking";
import { newProject } from "../shared/project";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

it("ducks only speech with attack and release and identical export envelopes at playback speeds", () => {
  const ranges = [{ start: 2, end: 3 }, { start: 5, end: 6 }];
  expect(musicDuckGain(ranges, 1)).toBe(1);
  expect(musicDuckGain(ranges, 2.5)).toBeCloseTo(0.35);
  expect(musicDuckGain(ranges, 3.175)).toBeCloseTo(0.675);
  expect(musicDuckGain(ranges, 4)).toBe(1);
  for (const speed of [0.5, 1, 2]) {
    const expression = musicDuckExpression(ranges, speed).replace(/max\(/g, "Math.max(").replace(/min\(/g, "Math.min(");
    const exported = new Function("t", `return ${expression}`);
    for (const time of [1.95, 2, 2.5, 3.175, 4, 5.5])
      expect(exported(time / speed)).toBeCloseTo(musicDuckGain(ranges, time));
  }
});
it("respects source trim, clip position, mute and speech gaps", () => {
  const clip = { ...clipFromAudio(synthesizeSound("Success chime"), "voice"), duration: 5, start: 2, trimIn: 1, length: 3,
    transcriptWords: [{ text: "one", start: 1.2, end: 1.6 }, { text: "two", start: 3, end: 3.4 }] };
  const p = { ...newProject(), audio: [clip] };
  const ranges = speechRanges(p, p.audio);
  expect(ranges[0].start).toBeCloseTo(2.2);
  expect(ranges[1].end).toBeCloseTo(4.4);
  expect(musicDuckGain(ranges, 3.5)).toBe(1);
  expect(speechRanges(p, [{ ...clip, muted: true }])).toEqual([]);
});
