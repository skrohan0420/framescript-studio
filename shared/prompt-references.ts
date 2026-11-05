import { z } from "zod";

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
