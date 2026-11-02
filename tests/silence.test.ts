import { expect, it } from "vitest";
import {
  detectSilence,
  normalizeCuts,
  mapAudioTime,
  retimeWords,
} from "../shared/silence";
import { cutRecording } from "../src/silence-audio";
it("detects silence across all channels, preserves short gaps and protects known speech", () => {
  const left = new Float32Array(2000),
    right = new Float32Array(2000);
  right.fill(0.2, 400, 800);
  right.fill(0.2, 1200, 1600);
  const cuts = detectSilence([left, right], 1000, -40, 0.35, 0.08);
  expect(cuts).toEqual([
    { start: 0, end: 0.32 },
    { start: 0.88, end: 1.1199999999999999 },
    { start: 1.6800000000000002, end: 2 },
  ]);
  const protectedCuts = detectSilence([left], 1000, -40, 0.35, 0.08, [
    { text: "soft", start: 0.5, end: 1.5 },
  ]);
  expect(protectedCuts).toEqual([
    { start: 0, end: 0.42 },
    { start: 1.58, end: 2 },
  ]);
  expect(detectSilence([left], 1000, -40, 3, 0.08)).toEqual([]);
});
it("merges cuts and retimes words without shifting retained speech incorrectly", () => {
  const cuts = normalizeCuts(
    [
      { start: 2, end: 3 },
      { start: 0, end: 1 },
      { start: 0.5, end: 1.5 },
    ],
    4,
  );
  expect(cuts).toEqual([
    { start: 0, end: 1.5 },
    { start: 2, end: 3 },
  ]);
  expect(mapAudioTime(3.5, cuts)).toBe(1);
  expect(
    retimeWords(
      [
        { text: "gone", start: 0.2, end: 0.4 },
        { text: "kept", start: 3.2, end: 3.7 },
      ],
      cuts,
    ),
  ).toEqual([
    { text: "kept", start: 0.7000000000000002, end: 1.2000000000000002 },
  ]);
});
it("writes a shorter stereo WAV and uses the same sample-aligned cuts for timing", () => {
  const channels = [
    new Float32Array(2000).fill(0.2),
    new Float32Array(2000).fill(-0.3),
  ];
  const audio = {
    sampleRate: 1000,
    duration: 2,
    numberOfChannels: 2,
    getChannelData: (i: number) => channels[i],
  } as AudioBuffer;
  const result = cutRecording(audio, [{ start: 0.5, end: 1 }]);
  expect(result.duration).toBe(1.5);
  expect(mapAudioTime(1.2, result.cuts)).toBe(0.7);
  const bytes = Uint8Array.from(atob(result.data.split(",")[1]), (c) =>
    c.charCodeAt(0),
  );
  const view = new DataView(bytes.buffer);
  expect(view.getUint16(22, true)).toBe(2);
  expect(bytes.length).toBe(44 + 1500 * 2 * 2);
  expect(view.getInt16(44 + 100 * 4, true)).toBeGreaterThan(0);
  expect(view.getInt16(46 + 100 * 4, true)).toBeLessThan(0);
  expect(() => cutRecording(audio, [{ start: 0, end: 2 }])).toThrow(
    "Keep at least",
  );
});
