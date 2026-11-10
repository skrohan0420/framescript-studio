import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { structuredResultModuleInstructions } from "../shared/structured-result";
import {
  extendResultSchema,
  type ExtendTask,
} from "../shared/structured-extend";
import {
  starGlowAtSourceFrame,
  starModuleSource,
} from "../shared/structured-star";
import {
  additionalCapturePath,
  assertStructuredPackageBudget,
  describePackageFiles,
  packageReferences,
  referenceGuide,
  renderPackageCapture,
} from "./structured-package-context";
import { archiveSequence } from "./archive";
import { atomicWrite } from "./storage";

export async function writeExtendPackage(
  task: ExtendTask,
  projectId: string | null,
  destination: string,
  record: string,
) {
  const { scene, placement, addedFrames, brief, context } = task.input;
  if (!scene.star) throw Error("Glow continuation requires a star.");
  const startFrame = Math.round(
    (placement.sourceOffset + placement.duration) * scene.fps,
  );
  const endFrame = startFrame + addedFrames;
  const references = packageReferences(context?.references);
  const extraFrame = context?.captureFrame;
  const extraPath = additionalCapturePath(scene, extraFrame, placement);
  const guide = referenceGuide(
    extraPath ? [...references, { path: extraPath }] : references,
  );
  const framePath = "references/preview-frames/handoff.png";
  const sourcePath = "source/scene.json";
  const handoffPath = "context/handoff.json";
  const prompt = `Extend ${scene.title} from source frame ${startFrame} to ${endFrame}. ${brief}\nRead TASK.md, inspect ${framePath}, and use ${handoffPath} for the starting glow and frame interval. The full scene is in ${sourcePath}.${guide} Preserve all earlier animation. Return one JavaScript module following OUTPUT_CONTRACT.md. If a required file is inaccessible, name it before proceeding.\n`;
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  const baseFiles = [
    { path: "TASK.md", role: "task", content: prompt },
    {
      path: "OUTPUT_CONTRACT.md",
      role: "contract",
      content: `${structuredResultModuleInstructions}\n\nThe exported scene-extension object must follow schemas/extend-result.schema.json. Echo requestId "${task.requestId}", sceneId "${scene.sceneId}", baseRevision ${scene.revision}, startFrame ${startFrame}, endFrame ${endFrame}. Choose only the final glow value between 0 and 1. The built-in renderer interpolates from the existing glow at the handoff. Scene source, title and preceding animation are preserved by FrameScript.\n`,
    },
    { path: sourcePath, role: "source", content: json(scene) },
    {
      path: scene.star.modulePath,
      role: "runtime-module",
      content: starModuleSource,
    },
    {
      path: handoffPath,
      role: "handoff",
      content: json({
        startFrame,
        endFrame,
        timeBasis: "source-frames",
        fps: scene.fps,
        placement,
        sourceDurationFrames: scene.durationFrames,
        preservedSource: { startFrame: 0, endFrameExclusive: startFrame },
        star: {
          nodeId: scene.star.id,
          glowIntensity: starGlowAtSourceFrame(scene.star, startFrame),
        },
        evidence: framePath,
      }),
    },
    {
      path: "schemas/extend-result.schema.json",
      role: "schema",
      content: json(z.toJSONSchema(extendResultSchema)),
    },
  ];
  assertStructuredPackageBudget("Extend", [...baseFiles, ...references]);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(path.dirname(destination), "extend-package-"),
  );
  try {
    const signal = AbortSignal.timeout(60000);
    const evidence = await renderPackageCapture(
      scene,
      startFrame,
      root,
      framePath,
      "required-evidence",
      signal,
    );
    const extra =
      extraPath && extraFrame !== undefined
        ? [
            await renderPackageCapture(
              scene,
              extraFrame,
              root,
              extraPath,
              "context-frame",
              signal,
            ),
          ]
        : [];
    const files = [...baseFiles, evidence, ...extra, ...references];
    const savedTask = {
      requestId: task.requestId,
      input: { ...task.input, context: undefined },
    };
    const manifest = {
      packageType: "framescript-task",
      packageVersion: "1",
      mode: "extend",
      contractVersion: "1",
      requestId: task.requestId,
      input: {
        clipId: task.input.clipId,
        sceneId: scene.sceneId,
        baseRevision: scene.revision,
        sourcePath,
        placement,
        addedFrames,
        brief,
      },
      files: describePackageFiles(files),
    };
    const entries = [
      ...files,
      { path: "manifest.json", content: json(manifest) },
    ];
    assertStructuredPackageBudget("Extend", entries);
    for (const file of entries) {
      const target = path.join(root, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content);
    }
    await archiveSequence(root, destination, AbortSignal.timeout(60000));
    try {
      await atomicWrite(
        record,
        json({ task: savedTask, projectId, prompt, manifest }),
      );
    } catch (error) {
      await fs.rm(destination, { force: true });
      throw error;
    }
    return prompt;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
