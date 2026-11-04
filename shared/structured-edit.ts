import { z } from "zod";

const version = z.literal("1");
const id = z.string().min(1).max(128);
const revision = z.number().int().nonnegative();
const frame = z.number().int().nonnegative();
const glow = z.number().min(0).max(1);
export const editPlacementSchema = z.strictObject({
  sourceOffset: z.number().min(0).max(600),
  duration: z.number().min(0.1).max(600),
});
const target = z.strictObject({
  nodeId: id,
  property: z.literal("glowIntensity"),
  keyframeId: id,
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
    star: z.strictObject({
      id,
      moduleVersion: version,
      modulePath: z.literal("source/modules/star.mjs"),
      glowIntensity: glow,
      keyframe: z.strictObject({ id, frame, value: glow }),
    }),
    label: z.strictObject({ id, text: z.string().min(1) }),
  })
  .refine(
    (scene) =>
      scene.star.id !== scene.label.id &&
      scene.star.keyframe.frame < scene.durationFrames &&
      scene.durationFrames / scene.fps >= 0.1 &&
      scene.durationFrames / scene.fps <= 600,
    "Node IDs must differ and the keyframe must fall within the scene",
  );

export const editRequestSchema = z.strictObject({
  contractVersion: version,
  mode: z.literal("edit"),
  requestId: id,
  sceneId: id,
  baseRevision: revision,
  allowedTarget: target,
  requestedValue: glow,
});

export const editPatchSchema = z.strictObject({
  contractVersion: version,
  type: z.literal("scene-patch"),
  requestId: id,
  sceneId: id,
  baseRevision: revision,
  operations: z.tuple([
    target.extend({ op: z.literal("set-keyframe-value"), value: glow }),
  ]),
});

export function parseEditResult(text: string) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  let value: unknown;
  try {
    value = JSON.parse(fenced?.[1] ?? trimmed);
  } catch {
    throw Error(
      "The result must contain one JSON patch. Paste or upload the complete JSON.",
    );
  }
  const result = editPatchSchema.safeParse(value);
  if (!result.success)
    throw Error(
      result.error.issues
        .map((issue) => `${issue.path.join(".") || "Result"}: ${issue.message}`)
        .join("\n"),
    );
  return result.data;
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
  if (
    operation.nodeId !== allowed.nodeId ||
    operation.property !== allowed.property ||
    operation.keyframeId !== allowed.keyframeId ||
    operation.nodeId !== scene.star.id ||
    operation.keyframeId !== scene.star.keyframe.id
  )
    throw Error("Edit is outside the saved request scope");
  if (operation.value !== request.requestedValue)
    throw Error("Value differs from the saved request");

  scene.star.keyframe.value = operation.value;
  return scene;
}
