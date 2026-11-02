import { expect, it } from "vitest";
import { waveformColumns } from "../shared/waveform-view";

it("preserves transients anywhere within each displayed interval", () => {
  const peaks = Array(100).fill(0);
  peaks[9] = 0.9;
  peaks[99] = 1;
  expect(waveformColumns(peaks, 10, 0, 10, 10)).toEqual([
    0.9, 0, 0, 0, 0, 0, 0, 0, 0, 1,
  ]);
});
it("maps trimmed ranges to their actual source positions", () => {
  expect(waveformColumns([0.1, 0.2, 0.3, 0.4], 4, 1, 2, 2)).toEqual([0.2, 0.3]);
});
it("aggregates across loop boundaries and leaves out-of-source regions silent", () => {
  expect(waveformColumns([0.8, 0.2, 0.1, 0.4], 4, 3.5, 1, 1, true)).toEqual([
    0.8,
  ]);
  expect(waveformColumns([0.8, 0.2, 0.1, 0.4], 4, 3.5, 1, 2)).toEqual([0.4, 0]);
  expect(waveformColumns([], 0, 0, 1, 4)).toEqual([0, 0, 0, 0]);
});
