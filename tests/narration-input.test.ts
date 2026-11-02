import { expect, it } from "vitest";
import { parseNarrationInput } from "../shared/narration-input";
it("keeps plain narration and ordinary numbered lists as text", () => {
  const input = "1. Introduce the subject.\n2. Reveal it.";
  expect(parseNarrationInput(input)).toEqual({
    script: input,
    timedNarration: "",
    format: "Plain text",
  });
});
it("separates SRT text from timing while preserving the pasted source", () => {
  const input =
    "1\n00:00:02,200 --> 00:00:03,000\nHello there.\n\n2\n00:00:04,000 --> 00:00:05,000\nNext idea.";
  expect(parseNarrationInput(input)).toEqual({
    script: "Hello there. Next idea.",
    timedNarration: input,
    format: "SRT",
  });
});
it("handles VTT headers, cue identifiers, settings and markup", () => {
  const input =
    "WEBVTT\n\nNOTE ignore this\nmetadata\n\nintro\n00:01.000 --> 00:03.000 align:start\n<b>Hello.</b>\n\n";
  expect(parseNarrationInput(input)).toEqual({
    script: "Hello.",
    timedNarration: input,
    format: "VTT",
  });
});
it("recognizes timestamped lines and clears timing for replacement prose", () => {
  const input = "[00:02] First idea.\n00:05.200 Next idea.";
  expect(parseNarrationInput(input).script).toBe("First idea. Next idea.");
  expect(parseNarrationInput(input).format).toBe("Timestamped text");
  expect(parseNarrationInput("New untimed script").timedNarration).toBe("");
});
