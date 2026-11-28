import { expect, it } from "vitest";
import {
  buildCodePrompt,
  buildStructuredSceneBrief,
  promptTemplates,
  referenceStyles,
  editingStyles,
  templateDetails,
  type PromptDraft,
} from "../shared/prompt-templates";
const draft: PromptDraft = {
  template: "canvas",
  script: "Our galaxy has a black hole.",
  duration: 8.05,
  style: "Deep blue and gold",
  visuals: "Zoom into the galaxy",
  camera: "Slow push",
  screenText: "",
  notes: "Keep objects consistent",
  format: "document",
};
it("keeps legacy preset metadata readable without letting presets constrain implementation", () => {
  expect(promptTemplates).toHaveLength(14);
  for (const template of promptTemplates) {
    expect(templateDetails[template.id].detail.length).toBeGreaterThan(20);
    expect(templateDetails[template.id].example.length).toBeGreaterThan(20);
    const prompt = buildCodePrompt(
      { ...draft, template: template.id },
      1920,
      1080,
    );
    expect(prompt).toBe(buildCodePrompt(draft, 1920, 1080));
    expect(prompt).not.toContain("undefined");
  }
});
it("keeps reference strength and editorial fine tuning explicit and preserves narration priority", () => {
  const prompt = buildCodePrompt(
    {
      ...draft,
      referenceStyle: "Custom illustration",
      referenceInfluence: "Subtle",
      referenceNotes: "Muted copper",
      editingStyle: "Data story",
      pacingEnergy: "Calm / spacious",
      transitionPreference: "Hard cuts",
      editingNotes: "Hold the comparison",
    },
    1920,
    1080,
  );
  for (const value of [
    "Reference influence: Subtle",
    "Borrow a few broad visual principles",
    "Custom visual direction: Muted copper",
    "Pacing energy: Calm / spacious",
    "Explicit transition preference: Hard cuts",
    "overrides conflicting transition suggestions",
    "Custom editing direction: Hold the comparison",
    "preserving supplied narration timestamps",
  ])
    expect(prompt).toContain(value);
});
it("delegates typography instead of exporting saved text controls", () => {
  const prompt = buildCodePrompt(draft, 1920, 1080);
  expect(prompt).toContain("The director decides whether on-screen text helps");
  expect(prompt).toContain("including choosing no text");
  expect(buildCodePrompt({ ...draft, typographyEnabled: true, subtitles: "Word-by-word highlight",
    textFont: "Editorial serif", textAnimation: "Mask reveal", screenText: "STALE LABEL",
    titleSize: 120, captionSize: 48, textFill: "#ffcc00" }, 1920, 1080)).toBe(prompt);
});
it("includes every reference and editing preset as actionable direction", () => {
  for (const [name, direction] of referenceStyles) {
    const prompt = buildCodePrompt(
      { ...draft, referenceStyle: `${name}: ${direction}` },
      1920,
      1080,
    );
    expect(prompt).toContain(direction);
    expect(prompt).toContain("original procedural artwork");
  }
  for (const [name, direction] of editingStyles) {
    expect(
      buildCodePrompt(
        { ...draft, editingStyle: `${name}: ${direction}` },
        1920,
        1080,
      ),
    ).toContain(direction);
  }
});
it("carries the visual guide into the prompt and makes continuity optional", () => {
  const guide = {
    ...draft,
    palette: "Ivory and coral",
    characters: "Robot with one blue eye",
    environment: "Paper city",
    lighting: "Soft left key",
    mood: "Hopeful",
    motion: "Slow match cuts",
    audience: "Beginner designers",
    avoid: "No glow",
  };
  const prompt = buildCodePrompt(guide, 1920, 1080);
  for (const value of [
    guide.palette,
    guide.characters,
    guide.environment,
    guide.lighting,
    guide.mood,
    guide.motion,
    guide.audience,
    guide.avoid,
  ])
    expect(prompt).toContain(value);
  expect(prompt).toContain("CONTINUITY LOCK");
  expect(
    buildCodePrompt({ ...guide, consistency: false }, 1920, 1080),
  ).not.toContain("CONTINUITY LOCK");
});
it("includes the actual brief and editor playback/output contract", () => {
  const prompt = buildCodePrompt(draft, 1920, 1080);
  expect(prompt).toContain("Duration: 8.05 seconds");
  expect(prompt).toContain(draft.script);
  expect(prompt).toContain("window.renderFrame = function(timeInSeconds)");
  expect(prompt).toContain("Do not start requestAnimationFrame");
  expect(prompt).toContain("ONE complete HTML document");
  expect(prompt).toContain("The director decides whether on-screen text helps");
});
it("adapts directing guidance to the frame and available timing", () => {
  const portrait = buildCodePrompt(
    { ...draft, template: "explain" },
    1080,
    1920,
  );
  expect(portrait).toContain("do not invent statistics");
  expect(portrait).toContain("(portrait)");
  expect(portrait).toContain("No timing authority was supplied");
  expect(portrait).toContain("immediately before/after every beat boundary");
  const timed = buildCodePrompt(
    {
      ...draft,
      timedNarration: "00:00:02 --> 00:00:03 Reveal",
      template: "repair",
    },
    1920,
    1080,
  );
  expect(timed).toContain("code repair only when explicitly requested");
  expect(timed).toContain("Anchor beat boundaries");
  expect(timed).not.toContain("No timing authority was supplied");
});
it("ignores saved music and effects flags and requests visuals only", () => {
  const prompt = buildCodePrompt(
    { ...draft, bgm: true, sfx: true },
    1920,
    1080,
  );
  expect(prompt).not.toContain('id="framescript-audio"');
  expect(prompt).toContain("Generate visuals only");
  expect(prompt).toBe(buildCodePrompt(draft, 1920, 1080));
  expect(prompt).not.toContain("audio plan after the code");
});
it("uses timed narration as the visual synchronization authority without requesting captions", () => {
  const timedNarration = "1\n00:00:02,200 --> 00:00:02,800\nExplosion.\n";
  const prompt = buildCodePrompt({ ...draft, timedNarration }, 1920, 1080);
  expect(prompt).toContain(timedNarration.trim());
  expect(prompt).toContain("do not distribute the narration evenly");
  expect(prompt).toContain("not a requirement to display captions; the director decides whether text helps");
});
it("ignores saved presets in structured and directed prompts and attaches code only when supplied", () => {
  for (const template of promptTemplates)
    expect(
      buildCodePrompt({ ...draft, template: template.id }, 1080, 1920),
    ).toBe(buildCodePrompt(draft, 1080, 1920));
  for (const template of promptTemplates) {
    const directed = { ...draft, selectedDirection: "Show particles forming a galaxy, then hold the final pose." };
    expect(buildCodePrompt({ ...directed, template: template.id }, 1920, 1080)).toBe(buildCodePrompt(directed, 1920, 1080));
    expect(buildStructuredSceneBrief({ ...directed, template: template.id }, 1920, 1080)).toBe(buildStructuredSceneBrief(directed, 1920, 1080));
  }
  expect(
    buildCodePrompt({ ...draft, format: "separate" }, 1080, 1920),
  ).toContain("THREE clearly labeled code blocks");
  expect(buildCodePrompt(draft, 1920, 1080)).not.toContain(
    "EXISTING CODE TO REPAIR",
  );
  expect(
    buildCodePrompt(draft, 1920, 1080, {
      html: "<div id='example'></div>",
      css: "body{}",
      js: "window.renderFrame=()=>{}",
    }),
  ).toContain("<div id='example'></div>");
});
