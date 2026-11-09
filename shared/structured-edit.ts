import { z } from "zod";
import { parseStructuredResult } from "./structured-result";

const version = z.literal("1");
const id = z.string().min(1).max(128);
const revision = z.number().int().nonnegative();
const frame = z.number().int().nonnegative();
const glow = z.number().min(0).max(1);
export const editPlacementSchema = z.strictObject({
  sourceOffset: z.number().min(0).max(600),
  duration: z.number().min(0.1).max(600),
});
export const editScopeSchema = z.enum(["clip", "shared"]);
const target = z.strictObject({
  nodeId: id,
  property: z.enum(["glowIntensity", "x", "y", "opacity"]),
  keyframeId: id,
});
export const editTargetSchema = target;
const shapeSchema = z.strictObject({
  id,
  kind: z.enum(["circle", "rectangle"]),
  x: z.number().min(-10000).max(10000),
  y: z.number().min(-10000).max(10000),
  width: z.number().positive().max(10000),
  height: z.number().positive().max(10000),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  opacity: glow,
  tracks: z
    .array(
      z.strictObject({
        property: z.enum(["x", "y", "opacity"]),
        keyframe: z.strictObject({
          id,
          frame,
          value: z.number().min(-10000).max(10000),
        }),
      }),
    )
    .max(3),
});

export const editSceneSchema = z
  .strictObject({
    schemaVersion: version,
    sceneId: id,
    revision,
    title: z.string().min(1),
    width: z.number().int().min(64).max(7680),
    height: z.number().int().min(64).max(4320),
    fps: z.number().int().min(1).max(120),
    durationFrames: z.number().int().positive(),
    objects: z.array(shapeSchema).max(20).optional(),
    continuation: z
      .strictObject({
        startFrame: z.number().int().nonnegative(),
        endFrame: z.number().int().positive(),
        value: glow,
      })
      .optional(),
    star: z
      .strictObject({
        id,
        moduleVersion: version,
        modulePath: z.literal("source/modules/star.mjs"),
        glowIntensity: glow,
        keyframe: z.strictObject({ id, frame, value: glow }),
      })
      .optional(),
    label: z.strictObject({ id, text: z.string().min(1) }).optional(),
  })
  .refine(
    (scene) =>
      (!scene.star || scene.star.keyframe.frame < scene.durationFrames) &&
      scene.durationFrames / scene.fps >= 0.1 &&
      scene.durationFrames / scene.fps <= 600,
    "Duration or star keyframe is outside the supported range",
  )
  .refine(
    (scene) => !!(scene.star || scene.label || scene.objects?.length),
    "Include a star, an on-screen label, or at least one shape",
  )
  .refine(
    (scene) =>
      !scene.continuation ||
      (!!scene.star &&
        scene.continuation.startFrame < scene.continuation.endFrame &&
        scene.continuation.endFrame <= scene.durationFrames),
    "A continuation requires a star and a valid frame interval",
  )
  .refine((scene) => {
    const ids = [
      ...(scene.star ? [scene.star.id] : []),
      ...(scene.label ? [scene.label.id] : []),
      ...(scene.objects ?? []).map((item) => item.id),
    ];
    return (
      new Set(ids).size === ids.length &&
      (scene.objects ?? []).every(
        (item) =>
          new Set(item.tracks.map((track) => track.property)).size ===
            item.tracks.length &&
          new Set(item.tracks.map((track) => track.keyframe.id)).size ===
            item.tracks.length &&
          item.tracks.every(
            (track) =>
              track.keyframe.frame < scene.durationFrames &&
              (track.property !== "opacity" ||
                (track.keyframe.value >= 0 && track.keyframe.value <= 1)),
          ),
      )
    );
  }, "Duplicate IDs, invalid tracks or out-of-range keyframes");

export function sceneEditTargets(scene: z.infer<typeof editSceneSchema>) {
  const star = scene.star;
  return [
    ...(star
      ? [{
          nodeId: star.id,
          property: "glowIntensity" as const,
          keyframeId: star.keyframe.id,
          frame: star.keyframe.frame,
          value: star.keyframe.value,
          min: 0,
          max: 1,
        }]
      : []),
    ...(scene.objects ?? []).flatMap((object) =>
      object.tracks.map((track) => ({
        nodeId: object.id,
        property: track.property,
        keyframeId: track.keyframe.id,
        frame: track.keyframe.frame,
        value: track.keyframe.value,
        min: track.property === "opacity" ? 0 : -10000,
        max: track.property === "opacity" ? 1 : 10000,
      })),
    ),
  ];
}

export const editRequestSchema = z.strictObject({
  contractVersion: version,
  mode: z.literal("edit"),
  requestId: id,
  sceneId: id,
  baseRevision: revision,
  allowedTarget: target,
  requestedValue: z.number().min(-10000).max(10000),
});

export const editPatchSchema = z.strictObject({
  contractVersion: version,
  type: z.literal("scene-patch"),
  requestId: id,
  sceneId: id,
  baseRevision: revision,
  operations: z.tuple([
    target.extend({
      op: z.literal("set-keyframe-value"),
      value: z.number().min(-10000).max(10000),
    }),
  ]),
});

export function parseEditResult(text: string) {
  return parseStructuredResult(text, editPatchSchema, "patch");
}

// Produce a review candidate without mutating or advancing the saved scene.
export function prepareEditCandidate(
  sceneInput: unknown,
  requestInput: unknown,
  patchInput: unknown,
) {
  const scene = editSceneSchema.parse(sceneInput);
  const request = editRequestSchema.parse(requestInput);
  const patch = editPatchSchema.parse(patchInput);
  if (patch.requestId !== request.requestId) throw Error("Wrong request ID");
  if (patch.sceneId !== request.sceneId || scene.sceneId !== request.sceneId)
    throw Error("Wrong target scene");
  if (
    patch.baseRevision !== request.baseRevision ||
    scene.revision !== request.baseRevision
  )
    throw Error("Stale scene revision");

  const [operation] = patch.operations;
  const allowed = request.allowedTarget;
  const selected = sceneEditTargets(scene).find(
    (item) =>
      item.nodeId === operation.nodeId &&
      item.property === operation.property &&
      item.keyframeId === operation.keyframeId,
  );
  if (
    operation.nodeId !== allowed.nodeId ||
    operation.property !== allowed.property ||
    operation.keyframeId !== allowed.keyframeId ||
    !selected
  )
    throw Error("Edit is outside the saved request scope");
  if (operation.value < selected.min || operation.value > selected.max)
    throw Error("Value must be >=0 and <=1 for glow or opacity");
  if (operation.value !== request.requestedValue)
    throw Error("Value differs from the saved request");

  if (operation.property === "glowIntensity")
    scene.star!.keyframe.value = operation.value;
  else {
    const object = scene.objects!.find((item) => item.id === operation.nodeId)!;
    object.tracks.find(
      (item) => item.property === operation.property,
    )!.keyframe.value = operation.value;
  }
  return scene;
}
