import { expect, it } from "vitest";
import {
  buildCodePrompt,
  promptTemplates,
  referenceStyles,
  editingStyles,
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
it("keeps subtitles opt-in and includes typography direction when requested", () => {
  expect(buildCodePrompt(draft, 1920, 1080)).toContain(
    "Off. Narration remains context only",
  );
  const prompt = buildCodePrompt(
    {
      ...draft,
      subtitles: "Word-by-word highlight",
      textFont: "Editorial serif",
      textAnimation: "Mask reveal",
      screenText: "EXACT LABEL",
    },
    1920,
    1080,
  );
  for (const value of [
    "Word-by-word highlight",
    "Editorial serif",
    "Mask reveal",
    "EXACT LABEL",
    "Word highlighting requires actual word timestamps",
  ])
    expect(prompt).toContain(value);
  const custom = buildCodePrompt(
    {
      ...draft,
      titleSize: 120,
      captionSize: 48,
      textFill: "#ffcc00",
      titlePlacement: "Top left",
      textAnimationDuration: 0.7,
      captionLines: 3,
    },
    1920,
    1080,
  );
  expect(custom).toContain(
    "Title / label font size: 120px; subtitle font size: 48px",
  );
  expect(custom).toContain("Text fill: #ffcc00");
  expect(custom).toContain("maximum subtitle lines: 3");
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
  expect(prompt).toContain("None. Do not add titles");
});
it("adapts directing guidance to the template, frame and available timing", () => {
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
  expect(timed).toContain("Make the smallest coherent repairs");
  expect(timed).toContain("Anchor beat boundaries");
  expect(timed).not.toContain("No timing authority was supplied");
});
it("requests real code-defined music and effects rather than an audio plan", () => {
  const prompt = buildCodePrompt(
    { ...draft, bgm: true, sfx: true },
    1920,
    1080,
  );
  expect(prompt).toContain('id="framescript-audio"');
  expect(prompt).toContain('"lane":"music"');
  expect(prompt).toContain('"lane":"sfx"');
  expect(prompt).toContain("creates editable music/SFX timeline tracks");
  expect(prompt).not.toContain("audio plan after the code");
});
it("uses timed narration as the visual synchronization authority without requesting captions", () => {
  const timedNarration = "1\n00:00:02,200 --> 00:00:02,800\nExplosion.\n";
  const prompt = buildCodePrompt({ ...draft, timedNarration }, 1920, 1080);
  expect(prompt).toContain(timedNarration.trim());
  expect(prompt).toContain("do not distribute the narration evenly");
  expect(prompt).toContain("not permission to add on-screen text");
});
it("supports each template and attaches code only when supplied", () => {
  for (const template of promptTemplates)
    expect(
      buildCodePrompt({ ...draft, template: template.id }, 1080, 1920),
    ).toContain(template.brief);
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
