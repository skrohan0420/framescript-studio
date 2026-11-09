import { z } from "zod";
import { editSceneSchema } from "./structured-edit";
import { parseStructuredResult } from "./structured-result";
import { structuredStarCode } from "./structured-star";
import type { Project } from "./project";
import { activateScene, initialWorkflow, totalDuration } from "./workflow";
import { promptReferencesSchema } from "./prompt-references";

export const generateInputSchema = z
  .strictObject({
    brief: z.string().trim().min(1).max(12000),
    width: z.number().int().min(64).max(7680),
    height: z.number().int().min(64).max(4320),
    fps: z.number().int().min(1).max(120),
    durationFrames: z.number().int().positive(),
    references: promptReferencesSchema.optional(),
  })
  .refine(
    (input) =>
      input.durationFrames / input.fps >= 0.1 &&
      input.durationFrames / input.fps <= 600,
    "Duration must be between 0.1 and 600 seconds",
  );
export const generateRequestSchema = z.strictObject({
  requestId: z.string().uuid(),
  input: generateInputSchema,
});
export const generateResultSchema = z.strictObject({
  contractVersion: z.literal("1"),
  type: z.literal("new-scene"),
  requestId: z.string().uuid(),
  scene: editSceneSchema.safeExtend({
    title: z.string().min(1).max(200),
    label: editSceneSchema.shape.label
      .unwrap()
      .extend({ text: z.string().min(1).max(1000) })
      .optional(),
  }),
});
export type GenerateInput = z.infer<typeof generateInputSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateResult = z.infer<typeof generateResultSchema>;

export function parseGenerateResult(text: string) {
  return parseStructuredResult(text, generateResultSchema, "scene result");
}

export function prepareGeneratedScene(
  project: Project,
  task: GenerateRequest,
  result: GenerateResult,
): Partial<Project> {
  const scene = result.scene;
  const { input, requestId } = task;
  if (
    result.requestId !== requestId ||
    scene.sceneId !== requestId ||
    scene.revision !== 1
  )
    throw Error(
      "The scene identity or revision does not match the saved request.",
    );
  if (
    scene.width !== input.width ||
    scene.height !== input.height ||
    scene.fps !== input.fps ||
    scene.durationFrames !== input.durationFrames
  )
    throw Error(
      "Scene dimensions, frame rate and duration must match the saved request.",
    );
  if (
    scene.width !== project.settings.width ||
    scene.height !== project.settings.height ||
    scene.fps !== project.settings.fps ||
    project.settings.timing !== "seek"
  )
    throw Error(
      "The project frame settings changed. Export a fresh Generate task in seek mode.",
    );
  const workflow = project.workflow ?? initialWorkflow(project);
  if (
    workflow.scenes.some(
      (clip) =>
        clip.id === requestId || clip.structuredEdit?.sceneId === scene.sceneId,
    )
  )
    throw Error("This generated scene is already in the project.");
  const duration = scene.durationFrames / scene.fps;
  if (
    workflow.scenes.length >= 30 ||
    totalDuration({ ...project, workflow }) + duration > 600
  )
    throw Error("The new scene would exceed the project timeline limits.");
  const next = {
    ...workflow,
    scenes: [
      ...workflow.scenes,
      {
        id: requestId,
        title: scene.title,
        narration: "",
        visual: "",
        duration,
        locked: false,
        template: "custom",
        ...structuredStarCode(scene),
        structuredEdit: scene,
      },
    ],
  };
  return activateScene({ ...project, workflow: next }, requestId);
}
