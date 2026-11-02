import { z } from "zod";

const frameSchema = z.object({
  offset: z.number().min(0).max(1).optional(),
  opacity: z.union([z.number(), z.string()]).optional(),
  transform: z.string().max(500).optional(),
  filter: z.string().max(500).optional(),
  letterSpacing: z.string().max(100).optional(),
  clipPath: z.string().max(500).optional(),
  color: z.string().max(100).optional(),
  textShadow: z.string().max(500).optional(),
  easing: z.string().max(100).optional(),
});
export const textTemplateSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(100),
  category: z.enum(["Titles", "Captions", "Motion", "Saved"]),
  font: z.string().max(200).default("Arial, sans-serif"),
  weight: z.string().max(20).default("700"),
  color: z.string().max(100).default("#ffffff"),
  frames: z.array(frameSchema).min(1).max(30),
  easing: z.string().max(100).default("cubic-bezier(.2,.8,.2,1)"),
  sample: z.string().max(500).optional(),
  appearance: z
    .object({
      fontStyle: z.string().max(100).optional(),
      textTransform: z.string().max(100).optional(),
      textShadow: z.string().max(500).optional(),
      letterSpacing: z.string().max(100).optional(),
      WebkitTextStroke: z.string().max(100).optional(),
    })
    .optional(),
});
export type TextTemplate = z.infer<typeof textTemplateSchema>;
const presets: [string, TextTemplate["category"], Keyframe[]][] = [
  ["Fade in", "Titles", [{ opacity: 0 }, { opacity: 1 }]],
  [
    "Rise up",
    "Titles",
    [
      { opacity: 0, transform: "translateY(45px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
  ],
  [
    "Slide left",
    "Motion",
    [
      { opacity: 0, transform: "translateX(100px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
  ],
  [
    "Slide right",
    "Motion",
    [
      { opacity: 0, transform: "translateX(-100px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
  ],
  [
    "Drop in",
    "Motion",
    [
      { opacity: 0, transform: "translateY(-70px)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
  ],
  [
    "Soft zoom",
    "Titles",
    [
      { opacity: 0, transform: "scale(.65)" },
      { opacity: 1, transform: "scale(1)" },
    ],
  ],
  [
    "Zoom out",
    "Titles",
    [
      { opacity: 0, transform: "scale(1.6)" },
      { opacity: 1, transform: "scale(1)" },
    ],
  ],
  [
    "Pop",
    "Titles",
    [
      { opacity: 0, transform: "scale(.3)" },
      { opacity: 1, transform: "scale(1.12)", offset: 0.7 },
      { transform: "scale(1)" },
    ],
  ],
  [
    "Blur reveal",
    "Titles",
    [
      { opacity: 0, filter: "blur(18px)" },
      { opacity: 1, filter: "blur(0px)" },
    ],
  ],
  [
    "Tracking",
    "Titles",
    [
      { opacity: 0, letterSpacing: "18px" },
      { opacity: 1, letterSpacing: "0px" },
    ],
  ],
  [
    "Wipe right",
    "Captions",
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }],
  ],
  [
    "Wipe up",
    "Captions",
    [{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)" }],
  ],
  [
    "Flip X",
    "Motion",
    [
      { opacity: 0, transform: "perspective(800px) rotateX(90deg)" },
      { opacity: 1, transform: "perspective(800px) rotateX(0deg)" },
    ],
  ],
  [
    "Flip Y",
    "Motion",
    [
      { opacity: 0, transform: "perspective(800px) rotateY(90deg)" },
      { opacity: 1, transform: "perspective(800px) rotateY(0deg)" },
    ],
  ],
  [
    "Tilt in",
    "Motion",
    [
      { opacity: 0, transform: "rotate(-12deg) translateY(30px)" },
      { opacity: 1, transform: "rotate(0deg) translateY(0)" },
    ],
  ],
  [
    "Stretch",
    "Motion",
    [
      { opacity: 0, transform: "scaleX(1.8) scaleY(.3)" },
      { opacity: 1, transform: "scale(1)" },
    ],
  ],
  [
    "Bounce",
    "Motion",
    [
      { opacity: 0, transform: "translateY(-60px)" },
      { opacity: 1, transform: "translateY(12px)", offset: 0.6 },
      { transform: "translateY(-6px)", offset: 0.8 },
      { transform: "translateY(0)" },
    ],
  ],
  [
    "Lower third",
    "Captions",
    [
      { opacity: 0, transform: "translateX(-40px)" },
      { opacity: 1, transform: "translateX(0)" },
    ],
  ],
  ["Subtitle", "Captions", [{ opacity: 0 }, { opacity: 1 }]],
  [
    "Focus",
    "Captions",
    [
      { opacity: 0, filter: "blur(8px)", transform: "scale(1.08)" },
      { opacity: 1, filter: "blur(0px)", transform: "scale(1)" },
    ],
  ],
  [
    "Float in",
    "Motion",
    [
      { opacity: 0, transform: "translate(35px,35px)" },
      { opacity: 1, transform: "translate(0,0)" },
    ],
  ],
  [
    "Rotate in",
    "Motion",
    [
      { opacity: 0, transform: "rotate(-180deg) scale(.2)" },
      { opacity: 1, transform: "rotate(0deg) scale(1)" },
    ],
  ],
  [
    "Expand",
    "Titles",
    [
      { opacity: 0, transform: "scaleX(.1)" },
      { opacity: 1, transform: "scaleX(1)" },
    ],
  ],
  [
    "Sharp reveal",
    "Captions",
    [
      { opacity: 0, clipPath: "inset(0 50% 0 50%)" },
      { opacity: 1, clipPath: "inset(0 0 0 0)" },
    ],
  ],
];
export const textTemplates: TextTemplate[] = presets.map(
  ([name, category, frames], index) =>
    textTemplateSchema.parse({ id: `type-${index}`, name, category, frames }),
);
const extraMotion: [string, Keyframe[], string?][] = [
  [
    "Typewriter",
    [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }],
    "steps(20,end)",
  ],
  [
    "Reverse wipe",
    [{ clipPath: "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }],
  ],
  [
    "Curtain down",
    [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }],
  ],
  [
    "Skew slide",
    [
      { opacity: 0, transform: "translateX(-80px) skewX(-20deg)" },
      { opacity: 1, transform: "translateX(0) skewX(0deg)" },
    ],
  ],
  [
    "Swing",
    [
      { opacity: 0, transform: "rotate(15deg)" },
      { opacity: 1, transform: "rotate(-5deg)", offset: 0.6 },
      { transform: "rotate(0deg)" },
    ],
  ],
  [
    "Rubber pop",
    [
      { opacity: 0, transform: "scale(.2,1.5)" },
      { opacity: 1, transform: "scale(1.15,.9)", offset: 0.65 },
      { transform: "scale(1)" },
    ],
  ],
  [
    "Perspective zoom",
    [
      { opacity: 0, transform: "perspective(600px) translateZ(-400px)" },
      { opacity: 1, transform: "perspective(600px) translateZ(0px)" },
    ],
  ],
  [
    "Glide diagonal",
    [
      { opacity: 0, transform: "translate(-80px,-40px)" },
      { opacity: 1, transform: "translate(0,0)" },
    ],
  ],
  [
    "Squeeze reveal",
    [
      { opacity: 0, transform: "scaleY(.05)" },
      { opacity: 1, transform: "scaleY(1)" },
    ],
  ],
  [
    "Spin pop",
    [
      { opacity: 0, transform: "rotate(90deg) scale(.4)" },
      { opacity: 1, transform: "rotate(0deg) scale(1)" },
    ],
  ],
  ["Step fade", [{ opacity: 0 }, { opacity: 1 }], "steps(4,end)"],
  [
    "Soft landing",
    [
      {
        opacity: 0,
        transform: "translateY(-30px) scale(1.2)",
        filter: "blur(8px)",
      },
      { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
    ],
  ],
];
extraMotion.forEach(([name, frames, easing], index) =>
  textTemplates.push(
    textTemplateSchema.parse({
      id: `motion-extra-${index}`,
      name,
      category: "Motion",
      frames,
      easing,
    }),
  ),
);
const treatments = [
  {
    name: "Neon cyan",
    color: "#5af3ff",
    appearance: { textShadow: "0 0 10px #00d9ff,0 0 28px #00aaff" },
  },
  {
    name: "Neon pink",
    color: "#ff9de4",
    appearance: { textShadow: "0 0 10px #ff00aa,0 0 28px #b700ff" },
  },
  {
    name: "Outline",
    color: "transparent",
    appearance: { WebkitTextStroke: "2px white" },
  },
  { name: "Editorial serif", font: "Georgia, serif", weight: "400" },
  {
    name: "Elegant italic",
    font: "Georgia, serif",
    weight: "400",
    appearance: { fontStyle: "italic" },
  },
  {
    name: "Terminal",
    font: "Consolas, monospace",
    color: "#74ff9c",
    weight: "400",
  },
  {
    name: "Bold headline",
    font: "Impact, Arial Black, sans-serif",
    appearance: { textTransform: "uppercase", letterSpacing: "2px" },
  },
  {
    name: "Spaced capitals",
    weight: "400",
    appearance: { textTransform: "uppercase", letterSpacing: "12px" },
  },
  { name: "Soft shadow", appearance: { textShadow: "0 6px 15px #00000099" } },
  {
    name: "Golden title",
    color: "#ffd77a",
    font: "Georgia, serif",
    appearance: { textShadow: "0 2px 8px #b8742244" },
  },
  {
    name: "Caption bold",
    appearance: {
      textShadow:
        "2px 2px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000",
    },
  },
  {
    name: "Minimal label",
    weight: "400",
    appearance: { letterSpacing: "3px" },
  },
];
treatments.forEach((treatment, index) =>
  textTemplates.push(
    textTemplateSchema.parse({
      id: `treatment-${index}`,
      category: "Titles",
      frames: presets[1][2],
      ...treatment,
    }),
  ),
);
export const typographyDragType = "application/x-framescript-typography";
export const textLayerSchema = z.object({
  id: z.string().max(100),
  text: z.string().max(5000),
  template: textTemplateSchema,
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(5).max(100),
  size: z.number().min(8).max(400),
  color: z.string().max(100),
  font: z.string().max(200),
  align: z.enum(["left", "center", "right"]),
  start: z.number().min(0).max(600),
  end: z.number().positive().max(1200),
  entrance: z.number().min(0.05).max(30),
  motionStart: z.number().min(0).max(1200).optional(),
});
export type TextLayer = z.infer<typeof textLayerSchema>;
export function splitTextLayer(html: string, id: string, time: number) {
  const layer = readTextLayers(html).find((item) => item.id === id);
  if (!layer || time - layer.start < 0.01 || layer.end - time < 0.01)
    throw Error("Place the playhead inside the selected text clip.");
  const right = {
    ...layer,
    id: "text-" + crypto.randomUUID(),
    start: time,
    motionStart: layer.motionStart ?? layer.start,
  };
  return writeTextLayer(writeTextLayer(html, { ...layer, end: time }), right);
}

export function readTextLayers(html: string): TextLayer[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("[data-fs-text]")].flatMap((node) => {
    try {
      const result = textLayerSchema.safeParse(
        JSON.parse(node.getAttribute("data-fs-text")!),
      );
      return result.success ? [result.data] : [];
    } catch {
      return [];
    }
  });
}
export function writeTextLayer(html: string, layer: TextLayer, remove = false) {
  const valid = textLayerSchema.parse(layer);
  const doc = new DOMParser().parseFromString(html, "text/html");
  let existing: Element | undefined;
  for (const node of doc.querySelectorAll("[data-fs-text]")) {
    try {
      if (JSON.parse(node.getAttribute("data-fs-text")!).id === valid.id)
        existing = node;
    } catch {
      /* Ignore unrelated malformed metadata. */
    }
  }
  existing?.remove();
  if (!remove) {
    const node = doc.createElement("div");
    node.id = valid.id;
    node.setAttribute("data-fs-text", JSON.stringify(valid));
    const text = doc.createElement("span");
    text.textContent = valid.text;
    node.append(text);
    doc.body.append(node);
  }
  return doc.body.innerHTML;
}
