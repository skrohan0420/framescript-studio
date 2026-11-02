import { expect, it } from "vitest";
import { transcriptSrt, voiceoverWordsForScene } from "../shared/transcript";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";
it("aligns source words to a trimmed clip and active scene, including master audio", () => {
  const clip = {
    ...clipFromAudio(synthesizeSound("Success chime"), "voice"),
    duration: 10,
    start: 2,
    trimIn: 1,
    length: 4,
    sceneId: "scene",
    transcriptWords: [
      { text: "Before", start: 0.1, end: 0.4 },
      { text: "Word", start: 1.2, end: 1.8 },
      { text: "Outside", start: 9, end: 10 },
    ],
  };
  expect(voiceoverWordsForScene(clip, 5)).toEqual([
    { text: "Word", start: 2.2, end: 2.8 },
  ]);
  expect(
    voiceoverWordsForScene({ ...clip, sceneId: undefined, start: 12 }, 5, 10),
  ).toEqual([{ text: "Word", start: 2.2, end: 2.8 }]);
});
it("formats real word timestamps as SRT with sentence and silence boundaries", () => {
  expect(
    transcriptSrt([
      { text: "Hello", start: 1.125, end: 1.5 },
      { text: "world.", start: 1.6, end: 2.05 },
      { text: "Next", start: 4, end: 4.5 },
      { text: "line", start: 4.5, end: 5 },
    ]),
  ).toBe(
    "1\n00:00:01,125 --> 00:00:02,050\nHello world.\n\n2\n00:00:04,000 --> 00:00:05,000\nNext line\n",
  );
  expect(transcriptSrt([])).toBe("");
});
