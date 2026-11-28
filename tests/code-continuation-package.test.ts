// @vitest-environment node
import { expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { newProject } from "../shared/project";
import { codeContinuationInputSchema, buildContinuationDirectorPrompt, buildCodeContinuationPrompt } from "../shared/code-continuation";

vi.mock("../server/export", () => ({ renderExport: vi.fn() }));
vi.mock("../server/structured-generate-package", () => ({
  archiveGenerateFiles: vi.fn(),
}));

import { renderExport } from "../server/export";
import { archiveGenerateFiles } from "../server/structured-generate-package";
import { writeCodeContinuationPackage } from "../server/code-continuation-package";
import { continuationReferenceContext } from "../shared/reference-config";

it("preserves current Kurzgesagt art direction on 3D continuation geometry without losing inherited story context", () => {
  const inherited = { renderingMode: "2d", referenceStyle: "Old generic look", fullScript: "The star's life", identityGuide: "Preserve our violet palette and flat color blocking" };
  const current = { renderingMode: "3d", referenceStyle: "Kurzgesagt-inspired: Rich flat-vector science illustration", referenceInfluence: "Strong" };
  const merged = continuationReferenceContext(inherited, current);
  expect(merged).toMatchObject({ ...inherited, ...current });
  expect(continuationReferenceContext(inherited, {})).toMatchObject(inherited);
  const p = newProject();
  const input = codeContinuationInputSchema.parse({
    source: { html: "<canvas></canvas>", css: "", js: "canvas.getContext('2d');" },
    title: "Star", settings: p.settings, assets: [], sourceOffset: 0,
    handoff: 2, timelineHandoff: 2, lastFrameTime: 1.9, duration: 3,
    direction: "", pacing: "", camera: "", narration: "Continue the star story",
    renderingMode: "3d", inheritedContext: JSON.stringify(merged),
  });
  for (const prompt of [buildContinuationDirectorPrompt(input), buildCodeContinuationPrompt(input)]) {
    expect(prompt).toContain("KURZGESAGT-INSPIRED ART DIRECTION ON TRUE 3D GEOMETRY");
    expect(prompt).toContain("matte or toon-like materials");
    expect(prompt).toContain("STYLE ACCEPTANCE");
    expect(prompt).toContain(inherited.fullScript);
    expect(prompt).toContain(inherited.identityGuide);
  }
});

it("enforces the current 3D choice over inherited 2D continuity in director and code prompts", () => {
  const p = newProject();
  const input = codeContinuationInputSchema.parse({
    source: { html: "<canvas></canvas>", css: "", js: "canvas.getContext('2d');" },
    title: "Flat previous scene", settings: p.settings, assets: [],
    sourceOffset: 0, handoff: 2, timelineHandoff: 2, lastFrameTime: 1.9, duration: 3,
    direction: "", pacing: "", camera: "", narration: "Continue the star story",
    renderingMode: "3d",
    inheritedContext: JSON.stringify({ renderingMode: "2d", identityGuide: "Keep flat fills and limited depth" }),
  });
  for (const prompt of [buildContinuationDirectorPrompt(input), buildCodeContinuationPrompt(input)]) {
    expect(prompt).toContain("CONFIGURED RENDERING — TRUE 3D REQUIRED");
    expect(prompt).toContain("takes precedence over conflicting flat/2D appearance");
    expect(prompt).not.toContain("CONFIGURED RENDERING — 2D REQUIRED");
    expect(prompt).not.toContain("Saved rendering, typography and story-direction controls are obsolete");
  }
  expect(buildCodeContinuationPrompt(input)).toContain("rebuild the NEW segment in true 3D");
  expect(buildCodeContinuationPrompt(input)).toContain("Call view.render() at the END");
  expect(buildCodeContinuationPrompt({ ...input, renderingMode: undefined,
    inheritedContext: JSON.stringify({ renderingMode: "3d" }) })).toContain("TRUE 3D REQUIRED");
  expect(buildCodeContinuationPrompt({ ...input, renderingMode: "auto" })).toContain("Keep the same rendering technology unless");
});

it.each([
  { duration: 2, fps: 30, sourceOffset: 0.25 },
  { duration: 0.1, fps: 1, sourceOffset: 600 },
])(
  "packages motion references with the original source clock ($fps fps)",
  async ({ duration, fps, sourceOffset }) => {
    const project = newProject();
    const input = codeContinuationInputSchema.parse({
      source: { html: project.html, css: project.css, js: project.js },
      title: "Continuation",
      settings: { ...project.settings, duration, fps },
      assets: [],
      sourceOffset,
      handoff: 20 + duration,
      timelineHandoff: 40 + duration,
      lastFrameTime: (Math.ceil(duration * fps - 1e-9) - 1) / fps,
      duration: 3,
      direction: "Continue the movement",
      pacing: "",
      camera: "",
      narration: "",
    });
    const directorInput = {
      ...input,
      inheritedContext: JSON.stringify({ fullScript: "The complete star story", identityGuide: "Keep violet subjects", referenceStyle: "Selected look", referenceLookSettings: { "Selected look": { font: "Georgia" } } }),
      narration: "00:00:01.000 --> 00:00:02.000\nReveal the core",
      selectedDirection: "Hold the violet core, then reveal its layers",
    };
    const director = buildContinuationDirectorPrompt(directorInput);
    expect(director).toContain("The complete star story");
    expect(director).toContain("Keep violet subjects");
    expect(director).toContain("Reveal the core");
    expect(director).toContain(input.source.js);
    expect(director).toContain(`exact source boundary: ${sourceOffset + duration}s`);
    expect(director).toContain("references/handoff.png");
    expect(director).toContain("First propose THREE");
    expect(director).toContain("What you will see:");
    expect(director).toContain("My recommendation: [A/B/C");
    expect(director).toContain("Reference look font: Georgia.");
    expect(buildCodeContinuationPrompt(directorInput)).toContain("Reference look font: Georgia.");
    expect(buildCodeContinuationPrompt(directorInput)).toContain(directorInput.selectedDirection);
    expect(buildCodeContinuationPrompt(directorInput)).toContain("Keep violet subjects");
    expect(buildCodeContinuationPrompt(directorInput)).toContain("INHERITED SETTINGS");
    expect(buildContinuationDirectorPrompt({ ...directorInput, fullScript: "Updated full story" })).toContain("Updated full story");
    vi.mocked(renderExport).mockImplementation(
      async (
        capturedProject,
        options,
        destination,
        _ffmpeg,
        _signal,
        _progress,
        _chrome,
        tuning,
      ) => {
        expect(options.format).toBe("sequence");
        expect(capturedProject.workflow?.scenes[0].sourceOffset).toBe(
          sourceOffset,
        );
        expect(tuning?.workers).toBe(1);
        await fs.mkdir(destination);
        await Promise.all(
          tuning!.sequenceTimes!.map((time, index) =>
            fs.writeFile(
              path.join(
                destination,
                `frame-${String(index).padStart(6, "0")}.png`,
              ),
              String(sourceOffset + time),
            ),
          ),
        );
        return destination;
      },
    );
    vi.mocked(archiveGenerateFiles).mockClear();
    const directory = path.resolve(
      "test-results/continuation-package-" + crypto.randomUUID(),
    );
    await fs.mkdir(directory, { recursive: true });
    try {
      const prompt = await writeCodeContinuationPackage(
        input,
        path.join(directory, "extension.zip"),
      );
      const [, files] = vi.mocked(archiveGenerateFiles).mock.calls[0];
      const motion = JSON.parse(
        String(
          files.find((file) => file.path === "references/motion.json")!.content,
        ),
      );
      expect(motion.sourceTimeAtHandoff).toBe(sourceOffset + duration);
      expect(motion.frames.length).toBeGreaterThanOrEqual(1);
      expect(motion.frames.length).toBeLessThanOrEqual(6);
      expect(motion.frames.at(-1)).toEqual({
        path: "references/handoff.png",
        time: input.lastFrameTime,
        sourceTime: sourceOffset + input.lastFrameTime,
      });
      for (const frame of motion.frames) {
        expect(frame.time).toBeGreaterThanOrEqual(0);
        expect(frame.time).toBeLessThan(duration);
        expect(
          String(files.find((file) => file.path === frame.path)!.content),
        ).toBe(String(frame.sourceTime));
      }
      expect(prompt).toContain(`source time ${sourceOffset + duration} + t`);
      expect(
        String(files.find((file) => file.path === "TASK.md")!.content),
      ).toBe(prompt);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
