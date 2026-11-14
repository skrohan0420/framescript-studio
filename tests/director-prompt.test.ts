import { describe, expect, it } from "vitest";
import { buildDirectorPrompt } from "../shared/director-prompt";
import type { PromptDraft } from "../shared/prompt-templates";
import { buildCodePrompt } from "../shared/prompt-templates";
import { buildIdentityPrompt } from "../shared/identity-prompt";
import { directionSnapshot } from "../shared/direction-approval";

const draft: PromptDraft = {
  template: "canvas", script: "Planets orbit the Sun.",
  timedNarration: "00:00:02.000 --> 00:00:04.000\nPlanets orbit the Sun.",
  duration: 6, style: "Flat", referenceStyle: "Space documentary",
  visuals: "Solar system", camera: "", screenText: "", notes: "",
  format: "document", selectedDirection: "OLD UNAPPROVED IDEA",
};

describe("director prompt", () => {
  it("uses selected beats without competing typography and audio defaults", () => {
    const prompt = buildCodePrompt({ ...draft, selectedDirection: "Hold violet planet until 4s; reveal ring at 4s.",
      bgm: true, typographyEnabled: true, textPlanning: "AI decides", identityGuide: "Violet subjects" }, 1920, 1080);
    expect(prompt).toContain("SELECTED CREATIVE DIRECTION — IMPLEMENT THIS PLAN");
    expect(prompt).toContain("Hold violet planet until 4s");
    expect(prompt).toContain("Violet subjects");
    expect(prompt).toContain("FRAMESCRIPT REQUIREMENTS — FOLLOW EXACTLY");
    expect(prompt).toContain("GENERATED SOUNDTRACK CONTRACT");
    expect(prompt).not.toContain("EXPLICIT TYPE SPECIFICATION");
    expect(prompt).not.toContain("INTERNAL SHOT PLAN — IMPLEMENT");
    expect(prompt).not.toContain("Music timing: Continuous");
  });
  it("invalidates approval when inputs, references or scene change but not when recording approval", () => {
    const snapshot = directionSnapshot(draft, { scene: "a", references: [] });
    expect(directionSnapshot({ ...draft, directionApproval: snapshot }, { scene: "a", references: [] })).toBe(snapshot);
    expect(directionSnapshot({ ...draft, duration: 9 }, { scene: "a", references: [] })).not.toBe(snapshot);
    expect(directionSnapshot(draft, { scene: "b", references: [] })).not.toBe(snapshot);
    expect(directionSnapshot(draft, { scene: "a", references: ["new image"] })).not.toBe(snapshot);
  });
  it("delegates fine-tuning without including removed saved controls", () => {
    const prompt = buildDirectorPrompt({ ...draft, camera: "LEGACY_CAMERA", notes: "LEGACY_NOTES" }, 1920, 1080, "document");
    expect(prompt).not.toContain("LEGACY_");
    expect(prompt).toContain("Choose camera framing and additional creative treatment yourself");
    expect(prompt).toContain("Preserve safe margins");
  });
  it("delegates enabled typography and excludes old text controls", () => {
    const prompt = buildDirectorPrompt({ ...draft, typographyEnabled: true,
      textPlanning: "LEGACY_MANUAL", textFont: "LEGACY_FONT", subtitles: "LEGACY_SUBTITLES",
      textItems: [], screenText: "LEGACY_COPY" }, 1920, 1080, "document");
    expect(prompt).toContain("enabled: you choose concise wording");
    expect(prompt).toContain("unless explicitly requested in essential instructions");
    expect(prompt).not.toContain("LEGACY_");
  });
  it("grounds identity generation in the reference and carries the locked guide into both stages", () => {
    const input = { ...draft, fullScript: "A star's whole life", identityGuide: "Keep subject violet", consistency: true };
    const identity = buildIdentityPrompt(input, "document");
    expect(identity).toContain("Space documentary");
    expect(identity).toContain("A star's whole life");
    expect(identity).toContain("LOCKED INVARIANTS");
    expect(identity).toContain("Propose THREE distinct visual identity options");
    expect(identity).toContain("STOP and wait for their reply");
    expect(identity).toContain("STAGE 2 — EXPAND ONLY AFTER SELECTION");
    expect(identity).toContain("WHOLE VIDEO'S THEME AND VISUAL INSTRUCTION GUIDE");
    expect(identity).toContain("# VIDEO THEME — [Selected name]");
    for (const heading of ["1. Overall visual direction", "2. Color system", "3. Subject design",
      "4. Environments and composition", "5. Lighting and effects", "6. Motion language",
      "7. Consistency rules", "8. Allowed variation and exclusions"]) {
      expect(identity).toContain(`## ${heading}`);
    }
    expect(identity).toContain("Do not wrap it in a code fence");
    expect(identity).toContain("Write direct, actionable instructions");
    expect(buildDirectorPrompt(input, 1920, 1080, "document")).toContain("LOCKED: Preserve");
    expect(buildCodePrompt(input, 1920, 1080)).toContain("VISUAL IDENTITY — LOCKED\nKeep subject violet");
    expect(buildDirectorPrompt({ ...input, consistency: false }, 1920, 1080, "document"))
      .toContain("ADVISORY: Consider");
  });
  it("retains audio permissions while delegating treatment and respecting structured limits", () => {
    const enabled = { ...draft, bgm: true, sfx: false };
    const prompt = buildDirectorPrompt(enabled, 1920, 1080, "document");
    expect(prompt).toContain("Background music: enabled. Sound effects: disabled.");
    expect(prompt).toContain("choose style, mood, energy, tempo");
    expect(prompt).toContain("Disabled categories must remain absent");
    expect(buildDirectorPrompt(enabled, 1920, 1080, "structured"))
      .toContain("regardless of saved toggle values");
  });
  it("preserves rendering mode while delegating legacy motion controls", () => {
    const prompt = buildDirectorPrompt({ ...draft, renderingMode: "2.5d",
      animationTechniques: [{ id: "spring", amount: "LEGACY_BOUNCE" }],
      animationIntensity: "LEGACY_INTENSITY" }, 1920, 1080, "document");
    expect(prompt).toContain("Selected rendering mode: 2.5d");
    expect(prompt).toContain("do not require a real 3D renderer");
    expect(prompt).toContain("Decide their intensity, easing");
    expect(prompt).not.toContain("LEGACY_");
  });
  it("delegates pacing without exporting legacy pacing selections", () => {
    const prompt = buildDirectorPrompt({ ...draft, editingStyle: "LEGACY_EDIT",
      editingNotes: "LEGACY_NOTES", pacingEnergy: "LEGACY_ENERGY",
      transitionPreference: "LEGACY_TRANSITION" }, 1920, 1080, "document");
    expect(prompt).toContain("You also decide editing and pacing");
    expect(prompt).toContain("Narration timestamps and scene duration remain authoritative");
    expect(prompt).not.toContain("LEGACY_");
  });
  it("expands reference look, influence and notes into actionable visual direction", () => {
    const prompt = buildDirectorPrompt({ ...draft,
      referenceStyle: "Kurzgesagt-inspired: Rich flat-vector science illustration",
      referenceInfluence: "Strong", referenceNotes: "Keep our violet identity colors",
    }, 1920, 1080, "document");
    expect(prompt).toContain("SELECTED PRESET EXPANSION");
    expect(prompt).toContain("Keep our violet identity colors");
    expect(prompt).toContain("clearly visible across every beat");
    expect(prompt).toContain("Shape and construction");
    expect(prompt).toContain("Beat-level application");
    expect(prompt).toContain("never import their subjects");
  });
  it("separates the full story from the selected scene and its local timing", () => {
    const prompt = buildDirectorPrompt({ ...draft, fullScript: "First stars form. Later galaxies collide." }, 1920, 1080, "document");
    expect(prompt).toContain("First stars form. Later galaxies collide.");
    expect(prompt).toContain("SELECTED SCENE NARRATION");
    expect(prompt).toContain(draft.script);
    expect(prompt).toContain(draft.timedNarration);
    expect(prompt).toContain("do not use them as scene-local cues");
    expect(prompt).toContain("Do not animate the entire script");
  });
  it("preserves timing and reference look while keeping exploration separate from implementation", () => {
    const prompt = buildDirectorPrompt(draft, 1920, 1080, "document");
    expect(prompt).toContain(draft.timedNarration);
    expect(prompt).toContain("Space documentary");
    expect(prompt).toContain("THREE meaningfully distinct");
    expect(prompt).toContain("disabled: do not propose on-screen text");
    expect(prompt).toContain("not animation code");
    expect(prompt).not.toContain("OLD UNAPPROVED IDEA");
  });
  it("constrains structured concepts and includes active code only when supplied", () => {
    const prompt = buildDirectorPrompt(draft, 1080, 1920, "structured");
    expect(prompt).toContain("No custom code, 3D, audio");
    expect(prompt).toContain("one keyframe per property");
    expect(prompt).not.toContain("ACTIVE CODE");
    expect(buildDirectorPrompt(draft, 1080, 1920, "document", { html: "subject", css: "", js: "" }))
      .toContain("HTML:\nsubject");
  });
});
