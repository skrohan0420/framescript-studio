import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import ffmpeg from "ffmpeg-static";
import {
  extendResultSchema,
  type ExtendTask,
} from "../shared/structured-extend";
import {
  structuredStarCode,
  starModuleSource,
} from "../shared/structured-star";
import { newProject } from "../shared/project";
import { renderExport } from "./export";
import { archiveSequence } from "./archive";
import { atomicWrite } from "./storage";

export async function writeExtendPackage(
  task: ExtendTask,
  projectId: string | null,
  destination: string,
  record: string,
) {
  const { scene, placement, addedFrames, brief } = task.input;
  const startFrame = Math.round(
    (placement.sourceOffset + placement.duration) * scene.fps,
  );
  const endFrame = startFrame + addedFrames;
  const prompt = `Extend ${scene.title} from source frame ${startFrame} to ${endFrame}. ${brief}\nRead TASK.md and inspect references/preview-frames/handoff.png in the attached ZIP. Preserve all earlier animation. Return one JSON extension following OUTPUT_CONTRACT.md. If a required file is inaccessible, name it before proceeding.\n`;
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const root = await fs.mkdtemp(
    path.join(path.dirname(destination), "extend-package-"),
  );
  try {
    const framePath = "references/preview-frames/handoff.png";
    const capture = path.join(root, framePath);
    await fs.mkdir(path.dirname(capture), { recursive: true });
    const base = newProject();
    const duration = scene.durationFrames / scene.fps;
    const project = {
      ...base,
      ...structuredStarCode(scene),
      settings: {
        ...base.settings,
        width: scene.width,
        height: scene.height,
        fps: scene.fps,
        duration,
      },
    };
    await renderExport(
      project,
      {
        format: "png",
        width: scene.width,
        height: scene.height,
        fps: scene.fps,
        duration,
        speed: 1,
        time: startFrame / scene.fps,
        quality: 0,
        fit: "fit",
        transparent: false,
      },
      capture,
      ffmpeg ?? "",
      AbortSignal.timeout(60000),
      () => {},
    );
    const files = [
      { path: "TASK.md", role: "task", content: prompt },
      {
        path: "OUTPUT_CONTRACT.md",
        role: "contract",
        content: `Return a scene-extension JSON object using schemas/extend-result.schema.json. Echo requestId "${task.requestId}", sceneId "${scene.sceneId}", baseRevision ${scene.revision}, startFrame ${startFrame}, endFrame ${endFrame}. Choose only the final glow value between 0 and 1. The built-in renderer interpolates from the existing glow at the handoff. Scene source, title and preceding animation are preserved by FrameScript.\n`,
      },
      { path: "source/scene.json", role: "source", content: json(scene) },
      {
        path: scene.star.modulePath,
        role: "runtime-module",
        content: starModuleSource,
      },
      {
        path: "context/handoff.json",
        role: "handoff",
        content: json({
          startFrame,
          endFrame,
          timeBasis: "source-frames",
          fps: scene.fps,
          placement,
        }),
      },
      {
        path: "schemas/extend-result.schema.json",
        role: "schema",
        content: json(z.toJSONSchema(extendResultSchema)),
      },
      {
        path: framePath,
        role: "required-evidence",
        content: await fs.readFile(capture),
      },
    ];
    for (const file of files) {
      const target = path.join(root, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content);
    }
    const manifest = {
      packageType: "framescript-task",
      packageVersion: "1",
      mode: "extend",
      ...task,
      files: files.map(({ content, ...entry }) => ({
        ...entry,
        sha256: createHash("sha256").update(content).digest("hex"),
      })),
    };
    await fs.writeFile(path.join(root, "manifest.json"), json(manifest));
    await archiveSequence(root, destination, AbortSignal.timeout(60000));
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
