import { expect, it } from "vitest";
import {
  animationDirection,
  restoreTechniques,
} from "../shared/animation-techniques";
import { buildCodePrompt, type PromptDraft } from "../shared/prompt-templates";
import { documentFor } from "../shared/runtime";
import { newProject } from "../shared/project";

const draft: PromptDraft = {
  template: "canvas",
  script: "A molecule assembles",
  duration: 10,
  style: "",
  visuals: "",
  camera: "",
  screenText: "",
  notes: "",
  format: "document",
};
it("leaves existing prompts unchanged until animation choices are made", () => {
  expect(animationDirection({}, 10)).toBe("");
  expect(buildCodePrompt(draft, 1920, 1080)).not.toContain(
    "SELECTED ANIMATION TECHNIQUES",
  );
});
it("composes 3D direction with selected techniques, bounds timings and preserves text opt-in", () => {
  const prompt = buildCodePrompt(
    {
      ...draft,
      renderingMode: "3d",
      animationIntensity: "Subtle",
      animationTechniques: [
        {
          id: "assembly",
          variant: "Assemble",
          amount: "shell last",
          start: 8,
          duration: 5,
        },
        { id: "camera", variant: "Orbit" },
      ],
    },
    1920,
    1080,
  );
  expect(prompt).toContain("bundled window.THREE");
  expect(prompt).toContain("Timing window: 8–10s");
  expect(prompt).toContain("shell last");
  expect(prompt).toContain("Shared intensity: Subtle");
  expect(prompt).toContain("Core Three.js only");
  expect(prompt).toContain("overrides any template suggestion");
  expect(prompt).toContain("Do not add any text");
});
it("filters corrupt saved selections and duplicates", () => {
  expect(
    restoreTechniques([
      null,
      { id: "bogus" },
      { id: "camera", start: -3, duration: -2 },
      { id: "camera" },
    ]),
  ).toEqual([
    {
      id: "camera",
      start: 0,
      duration: 0.05,
      variant: undefined,
      amount: undefined,
    },
  ]);
});
it("embeds the offline library only for 3D code in preview and portable exports", () => {
  const project = newProject();
  expect(documentFor(project)).not.toContain("window.THREE=");
  project.js = "window.renderFrame=()=>{console.log(THREE.REVISION)}";
  for (const options of [undefined, { export: true }, { standalone: true }]) {
    const doc = documentFor(project, options);
    expect(doc).toContain("window.THREE=");
    expect(doc).toContain("preserveDrawingBuffer");
    expect(doc).toContain("connect-src 'none'");
    expect(doc).not.toContain("<script src=");
  }
});
