import { z } from "zod";
import {
  editSceneSchema,
  editPlacementSchema,
} from "./structured-edit";
import { parseStructuredResult } from "./structured-result";
import type { Project } from "./project";
import { structuredExtensionTiming } from "./structured-edit-timing";
import { structuredStarCode } from "./structured-star";
import { totalDuration } from "./workflow";

export const extendInputSchema = z
  .strictObject({
    scene: editSceneSchema,
    clipId: z.string().min(1).max(128),
    placement: editPlacementSchema,
    addedFrames: z.number().int().positive().max(72000),
    brief: z.string().trim().min(1).max(12000),
  })
  .refine(({ scene, placement, addedFrames }) => {
    const frame = (placement.sourceOffset + placement.duration) * scene.fps;
    return (
      !!scene.star &&
      !scene.continuation &&
      Math.abs(frame - Math.round(frame)) < 1e-7 &&
      frame <= scene.durationFrames &&
      (frame + addedFrames) / scene.fps <= 600
    );
  }, "A star is required. Use a frame-aligned handoff within the source and one continuation per source.");
export const extendTaskSchema = z.strictObject({
  requestId: z.string().uuid(),
  input: extendInputSchema,
});
export const extendResultSchema = z.strictObject({
  contractVersion: z.literal("1"),
  type: z.literal("scene-extension"),
  requestId: z.string().uuid(),
  sceneId: z.string().min(1),
  baseRevision: z.number().int().nonnegative(),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  value: z.number().min(0).max(1),
});
export type ExtendTask = z.infer<typeof extendTaskSchema>;
export type ExtendResult = z.infer<typeof extendResultSchema>;
export function parseExtendResult(text: string) {
  return parseStructuredResult(text, extendResultSchema, "extension");
}
export function prepareExtension(
  project: Project,
  clipId: string,
  task: ExtendTask,
  result: ExtendResult,
  sourceId: string,
): Partial<Project> {
  const { scene, placement, addedFrames } = task.input;
  const timing = structuredExtensionTiming(project, clipId);
  const current = timing?.clip;
  if (
    !timing ||
    !current ||
    task.input.clipId !== clipId ||
    JSON.stringify(current.structuredEdit) !== JSON.stringify(scene) ||
    (current.sourceOffset ?? 0) !== placement.sourceOffset ||
    current.duration !== placement.duration
  )
    throw Error("The clip or source changed. Export a fresh Extend task.");
  const startFrame = Math.round(timing.handoff * scene.fps);
  if (
    result.requestId !== task.requestId ||
    result.sceneId !== scene.sceneId ||
    result.baseRevision !== scene.revision ||
    result.startFrame !== startFrame ||
    result.endFrame !== startFrame + addedFrames
  )
    throw Error(
      "The extension must match the saved request, revision and frame interval.",
    );
  const added = addedFrames / scene.fps;
  if (totalDuration(project) + added > 600)
    throw Error("The extended timeline exceeds ten minutes.");
  const structuredEdit = editSceneSchema.parse({
    ...scene,
    sceneId: sourceId,
    revision: scene.revision + 1,
    durationFrames: Math.max(scene.durationFrames, result.endFrame),
    continuation: {
      startFrame,
      endFrame: result.endFrame,
      value: result.value,
    },
  });
  const code = structuredStarCode(structuredEdit);
  if (
    project.workflow?.selectedId === clipId &&
    (project.html !== current.html ||
      project.css !== current.css ||
      project.js !== current.js)
  )
    throw Error("Apply or discard pending code changes before extending.");
  if (!project.workflow) throw Error("The clip is no longer available.");
  return {
    ...(project.workflow.selectedId === clipId ? code : {}),
    settings:
      project.workflow.selectedId === clipId
        ? { ...project.settings, duration: current.duration + added }
        : project.settings,
    workflow: {
      ...project.workflow,
      scenes: project.workflow.scenes.map((clip) =>
        clip.id === clipId
          ? {
              ...clip,
              ...code,
              structuredEdit,
              duration: clip.duration + added,
            }
          : clip,
      ),
    },
  };
}
