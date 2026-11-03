import { z } from "zod";

export const textKinds = [
  "Title",
  "Subtitle / captions",
  "Subject label",
  "Callout / annotation",
  "Number counter",
  "Statistic / percentage",
  "Lower third",
  "Quote",
  "Bullet list",
  "Chart / axis label",
  "Timer / countdown",
  "Date / time",
  "Watermark",
  "Credits",
  "Custom text",
] as const;
export const promptTextSchema = z.object({
  id: z.string().max(100),
  kind: z.enum(textKinds),
  enabled: z.boolean().default(true),
  text: z.string().max(10000).default(""),
  subject: z.string().max(500).default(""),
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
  start: z.number().min(0).max(600).default(0),
  end: z.number().min(0).max(600).default(10),
  font: z.string().max(200).default("Segoe UI"),
  size: z.number().min(8).max(600).default(64),
  weight: z.number().min(100).max(900).default(600),
  color: z
    .string()
    .regex(/^#[a-f0-9]{6}$/i)
    .default("#F5F5F5"),
  accent: z
    .string()
    .regex(/^#[a-f0-9]{6}$/i)
    .default("#36D3DF"),
  backing: z
    .string()
    .regex(/^#[a-f0-9]{6}$/i)
    .default("#111827"),
  treatment: z
    .enum([
      "None",
      "Soft shadow",
      "Outline",
      "Solid backing",
      "Translucent pill",
    ])
    .default("Soft shadow"),
  align: z.enum(["left", "center", "right"]).default("center"),
  lineHeight: z.number().min(0.8).max(3).default(1.2),
  tracking: z.number().min(-5).max(30).default(0),
  maxWidth: z.number().min(5).max(100).default(80),
  animation: z
    .enum([
      "None",
      "Fade",
      "Slide up",
      "Word reveal",
      "Typewriter",
      "Scale in",
      "Mask reveal",
    ])
    .default("Fade"),
  entrance: z.number().min(0).max(5).default(0.4),
  exit: z.number().min(0).max(5).default(0.3),
  from: z.number().min(-1e12).max(1e12).default(0),
  to: z.number().min(-1e12).max(1e12).default(100),
  decimals: z.number().int().min(0).max(6).default(0),
  prefix: z.string().max(100).default(""),
  suffix: z.string().max(100).default(""),
  easing: z
    .enum(["linear", "ease-in", "ease-out", "ease-in-out"])
    .default("ease-out"),
  notes: z.string().max(2000).default(""),
});
export type PromptText = z.infer<typeof promptTextSchema>;
export const promptTextListSchema = z.array(promptTextSchema).max(30);

export function textLayerPrompt(items: PromptText[], duration: number) {
  return items
    .filter((item) => item.enabled)
    .map((item, index) => {
      if (
        item.end <= item.start ||
        item.end > duration ||
        item.start >= duration
      )
        throw Error(
          `Text item ${index + 1}: choose a start/end range within the ${duration}s scene.`,
        );
      if (
        !item.text.trim() &&
        ![
          "Number counter",
          "Timer / countdown",
          "Subtitle / captions",
        ].includes(item.kind)
      )
        throw Error(`Text item ${index + 1}: enter the exact text to display.`);
      if (item.kind === "Subject label" && !item.subject.trim())
        throw Error(
          `Text item ${index + 1}: describe the subject the label follows.`,
        );
      return `TEXT ITEM ${index + 1} — ${item.kind}\n${JSON.stringify(item, null, 2)}\nVisible only from ${item.start}s to ${item.end}s, in scene-local seconds. Position x/y is the text block's anchor as a percentage of the output frame; align controls the horizontal anchor. Font size and tracking are output pixels. Constrain to maxWidth percent of the frame and keep the entire block inside the frame. Entrance/exit must fit within this interval. ${item.subject ? "Attach to the described subject and follow its motion; keep labels readable and avoid overlap. Use a leader line for callouts when appropriate." : "Use the specified frame placement."} ${["Number counter", "Timer / countdown"].includes(item.kind) ? "Interpolate from → to across this interval using the selected easing, with exact decimals, prefix and suffix. Derive the displayed value directly from renderFrame(time); clamp endpoints. Never use real clocks or accumulating intervals." : item.kind === "Subtitle / captions" ? (item.text.trim() ? "Use the exact supplied caption text. Preserve words and punctuation; prefer supplied matching narration cues, otherwise estimate phrase timing without claiming exact speech synchronization." : "Use only supplied narration within this interval, never invent copy. If no narration is supplied, omit this caption item. Prefer actual timed cues; otherwise estimate phrase timing and do not claim word-level synchronization.") : "Display text verbatim, preserving punctuation and case. Do not invent additional words or values."}`;
    })
    .join("\n\n");
}
