import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
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
  const references = (input.references ?? []).map((file, index) => {
    const content = Buffer.from(file.data, "base64");
    if (content.length > 2 * 1024 * 1024)
      throw Error("Each reference must fit within 2 MB.");
    return {
      path:
        file.kind === "code"
          ? `references/example-code/${index + 1}.txt`
          : `references/images/${index + 1}.${file.kind}`,
      role: file.kind === "code" ? "example-code" : "visual-reference",
      name: file.name,
      usage: "Inspect for guidance. Reference-only content.",
      content,
    };
  });
  const referenceGuide = references.length
    ? "\nInspect these references for guidance:\n" +
      references.map((file) => `- ${file.path} (${file.name})`).join("\n") +
      "\n"
    : "";
  const prompt = `Generate a structured FrameScript scene with a star and optional native shapes. ${input.brief}\n\nRead TASK.md in the attached ZIP.${referenceGuide} Return one JSON result following OUTPUT_CONTRACT.md. If a required file is inaccessible, name it before proceeding.\n`;
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  const files = [
    { path: "TASK.md", role: "task", content: prompt },
    {
      path: "OUTPUT_CONTRACT.md",
      role: "contract",
      content: `Follow schemas/generate-result.schema.json. Return one new-scene JSON object with requestId and scene.sceneId both "${requestId}", scene revision 1, dimensions ${input.width}×${input.height}, fps ${input.fps} and durationFrames ${input.durationFrames}. Choose the scene title, label text, base glow and one glow keyframe inside the duration. You may include up to 20 native circles or rectangles in objects, each with independent x, y and opacity tracks. Circle x/y identify its center; rectangle x/y identify its top-left. Coordinates and sizes are pixels. Objects draw in array order above the star; the title draws above the canvas. Tracks interpolate linearly from base values to their one keyframe and hold afterward. IDs must be unique. Use references as guidance within these renderer capabilities. FrameScript provides the renderer. Return scene data only.\n`,
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
