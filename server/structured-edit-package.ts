import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { z } from "zod";
import { newProject } from "../shared/project";
import { editPatchSchema, editRequestSchema } from "../shared/structured-edit";
import {
  starModuleSource,
  structuredStarCode,
  type StructuredEditScene,
} from "../shared/structured-star";
import { archiveSequence } from "./archive";
import { renderExport } from "./export";
import { atomicWrite } from "./storage";
import { structuredClipTiming } from "../shared/structured-edit-timing";

export async function writeStructuredEditPackage(
  scene: StructuredEditScene,
  requestId: string,
  requestedValue: number,
  destination: string,
  requestFile: string,
  clipId: string,
  projectId: string | null = null,
  placement?: { sourceOffset: number; duration: number },
  scope: "clip" | "shared" = "clip",
) {
  if (
    placement &&
    !structuredClipTiming({ ...placement, structuredEdit: scene })
  )
    throw Error("The source keyframe must be inside the selected clip.");
  const request = editRequestSchema.parse({
    contractVersion: "1",
    mode: "edit",
    requestId,
    sceneId: scene.sceneId,
    baseRevision: scene.revision,
    allowedTarget: {
      nodeId: scene.star.id,
      property: "glowIntensity",
      keyframeId: scene.star.keyframe.id,
    },
    requestedValue,
  });
  const frame = scene.star.keyframe.frame;
  const time = frame / scene.fps;
  const seconds = time.toFixed(3);
  const framePath = `references/preview-frames/glow-${seconds}s.png`;
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  const brief = `Edit ${scene.title}, revision ${scene.revision}. Set the star's glow at ${seconds}s to ${requestedValue}. Preserve the keyframe time, label and unrelated content.`;
  const prompt = `${brief}\n\nOpen the attached ZIP and read TASK.md first. Inspect ${framePath} and return JSON following OUTPUT_CONTRACT.md. If you cannot access a required file, name it before proceeding.\n`;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = await fs.mkdtemp(
    path.join(path.dirname(destination), "edit-package-"),
  );
  const root = path.join(temporary, "package");
  const capture = path.join(root, framePath);
  const project = newProject();
  const { width, height, fps } = scene;
  const duration = scene.durationFrames / fps;
  const signal = AbortSignal.timeout(60_000);
  try {
    await fs.mkdir(path.dirname(capture), { recursive: true });
    await renderExport(
      {
        ...project,
        ...structuredStarCode(scene),
        settings: {
          ...project.settings,
          width,
          height,
          fps,
          duration,
          speed: 1,
        },
      },
      {
        format: "png",
        width,
        height,
        fps,
        duration,
        time,
        speed: 1,
        quality: 0,
        fit: "fit",
        transparent: false,
      },
      capture,
      ffmpeg ?? "",
      signal,
      () => {},
    );
    const files = [
      {
        path: "TASK.md",
        role: "task",
        content: `${prompt}\nTarget \`${scene.star.id}.glowIntensity\` keyframe \`${scene.star.keyframe.id}\` at frame ${frame}. Read \`source/scene.json\` for the current value and use the preview PNG as evidence of the current appearance.\n`,
      },
      {
        path: "OUTPUT_CONTRACT.md",
        role: "contract",
        content: `Return one JSON object conforming to \`schemas/edit-result.schema.json\`. Echo request ID \`${request.requestId}\`, scene ID \`${scene.sceneId}\` and base revision ${scene.revision}. The only allowed operation is \`set-keyframe-value\` on \`${scene.star.id}.glowIntensity\`, keyframe \`${scene.star.keyframe.id}\`, with value ${requestedValue}.\n`,
      },
      { path: "source/scene.json", role: "scene-source", content: json(scene) },
      {
        path: scene.star.modulePath,
        role: "runtime-module",
        content: starModuleSource,
      },
      {
        path: framePath,
        role: "required-evidence",
        content: await fs.readFile(capture),
        frame,
        sceneRevision: scene.revision,
      },
      {
        path: "schemas/edit-result.schema.json",
        role: "schema",
        content: json(z.toJSONSchema(editPatchSchema)),
      },
    ];
    for (const file of files) {
      const destination = path.join(root, file.path);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, file.content);
    }
    const manifest = {
      packageType: "framescript-task",
      packageVersion: "1",
      ...request,
      placement,
      scope,
      files: files.map(({ content, ...entry }) => ({
        ...entry,
        sha256: createHash("sha256").update(content).digest("hex"),
      })),
    };
    await fs.writeFile(path.join(root, "manifest.json"), json(manifest));
    await archiveSequence(root, destination, signal);
    try {
      await atomicWrite(
        requestFile,
        json({
          request,
          scene,
          manifest,
          prompt,
          clipId,
          scope,
          projectId,
          placement,
        }),
      );
    } catch (error) {
      await fs.rm(destination, { force: true });
      throw error;
    }
    return { requestId, prompt };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
