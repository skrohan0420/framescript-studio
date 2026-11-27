import { z } from "zod";

export const referenceConfigSchema = z.object({
  referenceStyle: z.string().max(30000).catch(""),
  referenceInfluence: z.enum(["Subtle", "Balanced", "Strong"]).catch("Balanced"),
  referenceNotes: z.string().max(30000).catch(""),
  referenceLookSettings: z.record(z.string().max(30000), z.object({
    font: z.string().trim().min(1).max(100).catch("Outfit"),
  })).catch({}),
});

export type ReferenceConfig = z.infer<typeof referenceConfigSchema>;

export function referenceLookKey(style?: string) {
  return style?.trim() || "Original / no reference";
}

export function referenceLookFont(config: {
  referenceStyle?: string;
  referenceLookSettings?: ReferenceConfig["referenceLookSettings"];
}) {
  return config.referenceLookSettings?.[referenceLookKey(config.referenceStyle)]?.font
    || "Outfit";
}

export function readReferenceConfig(value: unknown): ReferenceConfig {
  return referenceConfigSchema.parse(
    value && typeof value === "object" ? value : {},
  );
}
