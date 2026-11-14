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
      inheritedContext: JSON.stringify({ fullScript: "The complete star story", identityGuide: "Keep violet subjects" }),
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
