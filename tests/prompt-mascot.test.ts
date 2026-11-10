import { expect, it } from "vitest";
import { buildCodePrompt, type PromptDraft } from "../shared/prompt-templates";
const draft: PromptDraft = {
  template: "canvas",
  script: "Explore Mars",
  duration: 10,
  style: "",
  visuals: "",
  camera: "",
  screenText: "",
  notes: "",
  format: "document",
};
it("keeps saved mascot direction out unless explicitly enabled", () => {
  for (const mascotEnabled of [undefined, false]) {
    const prompt = buildCodePrompt(
      {
        ...draft,
        mascotEnabled,
        mascotName: "Orbit",
        mascotActions: "Point to Mars",
      },
      1920,
      1080,
    );
    expect(prompt).not.toContain("MASCOT — EXPLICITLY REQUESTED");
    expect(prompt).not.toContain("Orbit");
    expect(prompt).not.toContain("Point to Mars");
  }
});
it("uses separately attached LLM references without requiring a builder image or enabling text", () => {
  const prompt = buildCodePrompt(
    {
      ...draft,
      mascotEnabled: true,
      mascotName: "Orbit",
      mascotIdentity: "One blue eye",
      mascotRole: "Guide",
      mascotActions: "Point to Mars",
      mascotPlacement: "Bottom left",
      mascotScale: "25% frame height",
      mascotTiming: "2s to 8s",
      mascotNotes: "No costume changes",
    },
    1920,
    1080,
  );
  for (const value of [
    "Orbit",
    "One blue eye",
    "Guide",
    "Point to Mars",
    "Bottom left",
    "25% frame height",
    "2s to 8s",
    "No costume changes",
    "attach the mascot reference image(s) directly to this LLM conversation",
    "If no mascot reference is available",
    "self-contained procedural Canvas",
    "Do not add any text",
  ])
    expect(prompt).toContain(value);
  expect(prompt).not.toContain("TYPOGRAPHY & SUBTITLES");
  expect(prompt).not.toContain("data:image");
});
it("has useful defaults without inventing a named character", () => {
  const prompt = buildCodePrompt({ ...draft, mascotEnabled: true }, 1920, 1080);
  expect(prompt).toContain("the user's mascot");
  expect(prompt).toContain("Match the attached reference");
  expect(prompt).toContain("do not invent a replacement character");
});
