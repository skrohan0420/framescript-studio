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
  const prompt = `Generate a structured FrameScript star scene. ${input.brief}\n\nRead TASK.md in the attached ZIP. Return one JSON result following OUTPUT_CONTRACT.md. If a required file is inaccessible, name it before proceeding.\n`;
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  const files = [
    { path: "TASK.md", role: "task", content: prompt },
    {
      path: "OUTPUT_CONTRACT.md",
      role: "contract",
      content: `Follow schemas/generate-result.schema.json. Return one new-scene JSON object with requestId and scene.sceneId both "${requestId}", scene revision 1, dimensions ${input.width}×${input.height}, fps ${input.fps} and durationFrames ${input.durationFrames}. Choose the scene title, label text, base glow and one glow keyframe inside the duration. Use the supplied star module as declared in the schema. FrameScript provides the renderer. Return scene data only.\n`,
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
  ];
  const manifest = {
    packageType: "framescript-task",
    packageVersion: "1",
    contractVersion: "1",
    mode: "generate",
    ...task,
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
