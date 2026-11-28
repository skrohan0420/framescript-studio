import { expect, it } from "vitest";
import { buildCodePrompt, buildStructuredSceneBrief, type PromptDraft } from "../shared/prompt-templates";
import { promptTextSchema, textKinds, textLayerPrompt } from "../shared/prompt-text";

import { buildIdentityPrompt } from "../shared/identity-prompt";
import { buildDirectorPrompt } from "../shared/director-prompt";

const draft: PromptDraft = {
  template: "canvas",
  script: "Narration",
  duration: 10,
  style: "",
  visuals: "",
  camera: "",
  screenText: "",
  notes: "",
  format: "document",
};
it("ignores obsolete typography controls for code, structured, identity and director prompts", () => {
  for (const typographyEnabled of [false, true, undefined]) {
    const saved: PromptDraft = { ...draft, typographyEnabled, screenText: "STALE TITLE",
      textFont: "STALE FONT", textPlanning: "Manual text", subtitles: "STALE CAPTIONS",
      textDensity: "STALE DENSITY", textBehavior: "STALE BEHAVIOR",
      textItems: [{ id: "invalid", kind: "Subject label", text: "STALE LABEL", start: 9, end: 1 } as any] };
    for (const output of ["document", "separate", "structured"] as const) {
      const baseline = { ...draft, format: output === "separate" ? "separate" as const : "document" as const };
      const input = { ...saved, format: baseline.format };
      const build = output === "structured" ? buildStructuredSceneBrief : buildCodePrompt;
      expect(build(input, 1920, 1080)).toBe(build(baseline, 1920, 1080));
      expect(buildDirectorPrompt(input, 1920, 1080, output)).toBe(buildDirectorPrompt(baseline, 1920, 1080, output));
      expect(buildIdentityPrompt(input, output)).toBe(buildIdentityPrompt(baseline, output));
    }
  }
});
it("leaves typography out of the identity guide and gives the director authority over old guide permissions", () => {
  const identity = buildIdentityPrompt(draft, "document");
  expect(identity).toContain("do not include a typography section");
  expect(identity).not.toContain("Text permission:");
  expect(identity).not.toContain("Suggested reference font:");
  expect(identity).toContain("Reference look font: Outfit");
  expect(identity).toContain("Include the configured font family as a locked invariant");
  const input = { ...draft, typographyEnabled: false, identityGuide: "Typography permissions: Text is explicitly disabled.", selectedDirection: "Show a concise Mars label at 2s." };
  const director = buildDirectorPrompt(input, 1920, 1080, "document");
  const code = buildCodePrompt(input, 1920, 1080);
  for (const prompt of [director, code]) {
    expect(prompt).toContain("Typography permission statements in older pasted identity guides do not override the director's decision");
    expect(prompt).not.toContain("Forbidden. Do not add labels");
  }
  expect(code).toContain(input.selectedDirection);
  expect(buildStructuredSceneBrief(input, 1920, 1080)).toContain("at most one static label");
});
it("validates timing, subject labels and missing text, with counters/captions explicitly supported", () => {
  const build = (item: unknown) => textLayerPrompt([promptTextSchema.parse(item)], 10);
  expect(() =>
    build({ id: "a", kind: "Title", text: "Hello", start: 5, end: 3 }),
  ).toThrow("start/end");
  expect(() =>
    build({ id: "a", kind: "Title", text: "Hello", end: 11 }),
  ).toThrow("start/end");
  expect(() =>
    build({ id: "a", kind: "Subject label", text: "Hello" }),
  ).toThrow("describe the subject");
  expect(() => build({ id: "a", kind: "Title" })).toThrow("exact text");
  for (const kind of textKinds)
    expect(() =>
      build({ id: kind, kind, text: "Exact copy", subject: "The subject" }),
    ).not.toThrow();
});

it("carries the configured font as a constant through every prompt stage and output", () => {
  for (const font of ["Outfit", "Georgia"]) {
    const input: PromptDraft = { ...draft, typographyEnabled: false, referenceStyle: "Selected look",
      referenceLookSettings: { "Selected look": { font }, "Other look": { font: "Verdana" } },
      textFont: "LEGACY_FONT", identityGuide: "Old guide suggests Arial.", selectedDirection: "Use Comic Sans for the label." };
    for (const output of ["document", "separate", "structured"] as const) {
      const configured = { ...input, format: output === "separate" ? "separate" as const : "document" as const };
      const implementation = output === "structured" ? buildStructuredSceneBrief : buildCodePrompt;
      for (const prompt of [buildIdentityPrompt(configured, output), buildDirectorPrompt(configured, 1920, 1080, output), implementation(configured, 1920, 1080), implementation({ ...configured, selectedDirection: "" }, 1920, 1080)]) {
        expect(prompt).toContain("Reference look font: " + font + ".");
        expect(prompt).toContain("user-controlled constant, not a suggestion");
        expect(prompt).toContain("takes precedence over conflicting font-family suggestions");
        expect(prompt).toContain("This constant does not require text to appear");
        expect(prompt).not.toContain("Reference look font: Verdana");
        expect(prompt).not.toContain("Suggested font");
        expect(prompt).not.toContain("LEGACY_FONT");
      }
    }
  }
});
