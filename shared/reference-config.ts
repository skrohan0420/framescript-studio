import { z } from "zod";
import { renderingModeSchema } from "./rendering-direction";

export const referenceConfigSchema = z.object({
  renderingMode: renderingModeSchema.catch("3d"),
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

/** Current explicit look choices override older clip context without erasing story/identity. */
export function continuationReferenceContext(inherited: unknown, current: unknown) {
  const previous = inherited && typeof inherited === "object" && !Array.isArray(inherited) ? inherited : {};
  const saved = current && typeof current === "object" && !Array.isArray(current) ? current : {};
  const config = readReferenceConfig(saved);
  return {
    ...previous,
    ...Object.fromEntries(Object.entries(config).filter(([key]) => Object.hasOwn(saved, key))),
  };
}

export function configuredFontPrompt(config: Parameters<typeof referenceLookFont>[0]) {
  const font = referenceLookFont(config);
  return `CONFIGURED CONSTANT — FONT FAMILY
Reference look font: ${font}.
Use this configured font family for all on-screen text whenever text is chosen. It is a user-controlled constant, not a suggestion. Preserve it across every identity option, director proposal, final specification and implementation. This configuration takes precedence over conflicting font-family suggestions in reference styles, pasted identity guides or selected directions. The director may choose whether to use text and its wording, size, weight, color, placement and animation, but must not choose a different font family. This constant does not require text to appear. If the font resource is unavailable, identify the missing dependency instead of silently substituting another family; do not download external fonts.${font.toLowerCase() === "outfit" ? " FrameScript supplies Outfit locally for preview, export and standalone HTML, with variable weights 100–900. Use font-family: Outfit; no font import or network download is needed." : ""}`;
}
