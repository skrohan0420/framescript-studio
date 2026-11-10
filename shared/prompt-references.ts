import { z } from "zod";

export const structuredContextLimitMiB = 8;

export const promptReferenceSchema = z.strictObject({
  name: z.string().min(1).max(200),
  kind: z.enum(["png", "jpeg", "webp", "code"]),
  data: z
    .string()
    .min(1)
    .max(2800000)
    .regex(/^[A-Za-z0-9+/]*={0,2}$/),
});
export const promptReferencesSchema = z
  .array(promptReferenceSchema)
  .max(6)
  .refine(
    (files) =>
      files.reduce((sum, file) => sum + file.data.length, 0) <= 8388608,
    "References exceed the 6 MB package budget",
  );

export type PromptReferences = z.infer<typeof promptReferencesSchema>;

export function describeReferences(references: PromptReferences = []) {
  return references.map(({ kind, name }, index) => ({
    path:
      kind === "code"
        ? `references/example-code/${index + 1}.txt`
        : `references/images/${index + 1}.${kind}`,
    role: kind === "code" ? "example-code" : "visual-reference",
    name,
    usage: "Inspect for guidance. Reference-only content.",
  }));
}

export function referenceGuide(files: { path: string; name?: string }[]) {
  return files.length
    ? "\nInspect these optional references for guidance:\n" +
        files
          .map((file) => `- ${file.path}${file.name ? ` (${file.name})` : ""}`)
          .join("\n") +
        "\n"
    : "";
}

export const promptContextSchema = z.strictObject({
  references: promptReferencesSchema.optional(),
  captureFrame: z.number().int().nonnegative().max(72000).optional(),
});
export type PromptContext = z.infer<typeof promptContextSchema>;

export function contextFrameRange(
  scene: { fps: number; durationFrames: number },
  placement?: { sourceOffset: number; duration: number },
) {
  const first = Math.ceil((placement?.sourceOffset ?? 0) * scene.fps - 1e-7);
  const end = placement
    ? (placement.sourceOffset + placement.duration) * scene.fps
    : scene.durationFrames;
  return {
    first,
    last: Math.min(scene.durationFrames, Math.ceil(end - 1e-7)) - 1,
  };
}
