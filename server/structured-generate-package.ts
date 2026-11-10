import {
  packageReferences,
  referenceGuide,
} from "./structured-package-context";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { structuredResultModuleInstructions } from "../shared/structured-result";
import {
  generateResultSchema,
  type GenerateRequest,
} from "../shared/structured-generate";
import { starModuleSource } from "../shared/structured-star";
import { archiveSequence } from "./archive";
import { atomicWrite } from "./storage";

export async function writeGeneratePackage(
  task: GenerateRequest,
  projectId: string | null,
  destination: string,
  record: string,
) {
  const { requestId, input } = task;
  const references = packageReferences(input.references);
  const prompt = `Generate a structured FrameScript scene with native shapes, an on-screen label, or a built-in star as requested. ${input.brief}\n\nRead TASK.md in the attached ZIP.${referenceGuide(references)} Return one JavaScript module following OUTPUT_CONTRACT.md. If a required file is inaccessible, name it before proceeding.\n`;
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  const files = [
    { path: "TASK.md", role: "task", content: prompt },
    {
      path: "OUTPUT_CONTRACT.md",
      role: "contract",
      content: `${structuredResultModuleInstructions}\n\nThe exported object must follow schemas/generate-result.schema.json. Return a new-scene result with requestId and scene.sceneId both "${requestId}", scene revision 1, dimensions ${input.width}×${input.height}, fps ${input.fps} and durationFrames ${input.durationFrames}. The scene title is the required timeline name. The star and on-screen label are independently optional. Include at least one shape, a star, or a label. For a shapes-only scene omit star and label. If a star is present, choose its base glow and one glow keyframe inside the duration. You may include up to 20 native circles or rectangles in objects, each with independent x, y and opacity tracks. Circle x/y identify its center; rectangle x/y identify its top-left. Coordinates and sizes are pixels. Objects draw in array order above the star; the title draws above the canvas. Tracks interpolate linearly from base values to their one keyframe and hold afterward. IDs must be unique. Use references as guidance within these renderer capabilities. When converting a nonnegative timestamp in seconds to a source frame, multiply by fps and round to the nearest integer, with exact halves rounded up. Every keyframe must satisfy 0 <= frame < durationFrames.\n`,
    },
    {
      path: "schemas/generate-result.schema.json",
      role: "schema",
      content: json(z.toJSONSchema(generateResultSchema)),
    },
    {
      path: "source/modules/star.mjs",
      role: "runtime-module",
      content: starModuleSource,
    },
    ...references,
  ];
  const manifest = {
    packageType: "framescript-task",
    packageVersion: "1",
    contractVersion: "1",
    mode: "generate",
    requestId,
    input: { ...input, references: undefined },
    files: files.map(({ content, ...file }) => ({
      ...file,
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
  };
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(path.dirname(destination), "generate-package-"),
  );
  try {
    for (const file of files) {
      const target = path.join(root, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content);
    }
    await fs.writeFile(path.join(root, "manifest.json"), json(manifest));
    await archiveSequence(root, destination, AbortSignal.timeout(60_000));
    try {
      await atomicWrite(record, json({ task, projectId, prompt, manifest }));
    } catch (error) {
      await fs.rm(destination, { force: true });
      throw error;
    }
    return prompt;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
