import { expect, it } from "vitest";
import {
  buildCodePrompt,
  promptTemplates,
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
it("includes the actual brief and editor playback/output contract", () => {
  const prompt = buildCodePrompt(draft, 1920, 1080);
  expect(prompt).toContain("Duration: 8.05 seconds");
  expect(prompt).toContain(draft.script);
  expect(prompt).toContain("window.renderFrame = function(timeInSeconds)");
  expect(prompt).toContain("Do not start requestAnimationFrame");
  expect(prompt).toContain("ONE complete HTML document");
  expect(prompt).toContain("None. Do not add titles");
});
it("requests real code-defined music and effects rather than an audio plan", () => {
  const prompt = buildCodePrompt({ ...draft, bgm: true, sfx: true }, 1920, 1080);
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
