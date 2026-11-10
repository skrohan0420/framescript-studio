import { z } from "zod";
import {
  describeReferences,
  promptReferencesSchema,
  referenceGuide,
} from "./prompt-references";

export const codeGenerateInputSchema = z.strictObject({
  format: z.enum(["document", "separate"]),
  prompt: z.string().trim().min(1).max(6_200_000),
  references: promptReferencesSchema.optional(),
});

export type CodeGenerateInput = z.infer<typeof codeGenerateInputSchema>;

export function buildCodeGeneratePrompt(input: CodeGenerateInput) {
  const prompt = input.prompt.replace(/\r\n?/g, "\n");
  const guide = referenceGuide(describeReferences(input.references));
  return guide
    ? `Use the attached FrameScript ZIP as reference material.${guide}Treat these files as guidance for the self-contained scene.\n\n${prompt}`
    : prompt;
}
