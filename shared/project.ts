import { z } from "zod";
import { transcriptWordSchema } from "./transcript";
import { editSceneSchema } from "./structured-edit";
export const settingsSchema = z.object({
  width: z.number().int().min(64).max(7680),
  height: z.number().int().min(64).max(4320),
  duration: z.number().min(0.1).max(600),
  fps: z.number().int().min(1).max(120),
  speed: z.number().min(0.1).max(8),
  background: z.string().max(100),
  loop: z.boolean(),
  network: z.boolean().default(false),
  timing: z.enum(["seek", "replay"]).default("seek"),
});
export const assetSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  data: z.string().startsWith("data:image/").max(30_000_000),
  kind: z.enum(["image", "reference", "variant"]).optional(),
  mascot: z.string().optional(),
});
export const sceneSchema = z.object({
  structuredEdit: editSceneSchema.optional(),
  sourceOffset: z.number().min(0).max(600).optional(),
  id: z.string(),
  title: z.string().min(1).max(200),
  narration: z.string().max(30000),
  visual: z.string().max(10000),
  duration: z.number().min(0.1).max(600),
  locked: z.boolean().default(false),
  template: z.string().default("custom"),
  html: z.string().max(2_000_000),
  css: z.string().max(2_000_000),
  js: z.string().max(2_000_000),
});
export type Scene = z.infer<typeof sceneSchema>;
export const workflowSchema = z
  .object({
    script: z.string().max(50000),
    style: z.string().max(5000),
    selectedId: z.string(),
    scenes: z.array(sceneSchema).min(1).max(30),
    mascot: z.object({
      name: z.string().max(200),
      rules: z.string().max(5000),
      references: z.array(z.string()).max(10),
    }),
  })
  .superRefine((w, c) => {
    if (
      new Set(w.scenes.map((s) => s.id)).size !== w.scenes.length ||
      !w.scenes.some((s) => s.id === w.selectedId)
    )
      c.addIssue({
        code: "custom",
        message: "Invalid scene selection or duplicate scene IDs",
      });
    if (w.scenes.reduce((n, s) => n + s.duration, 0) > 600)
      c.addIssue({
        code: "custom",
        message: "Composition exceeds ten minutes",
      });
  });
export const audioSchema = z
  .object({
    id: z.string(),
    name: z.string().max(200),
    data: z.string().startsWith("data:audio/").max(50_000_000),
    duration: z.number().positive().max(3600),
    lane: z.enum(["voice", "sfx", "music"]),
    sceneId: z.string().optional(),
    start: z.number().min(0).max(600),
    trimIn: z.number().min(0),
    length: z.number().positive().max(600),
    volume: z.number().min(0).max(2),
    fadeIn: z.number().min(0).max(60),
    fadeOut: z.number().min(0).max(60),
    loop: z.boolean(),
    muted: z.boolean(),
    peaks: z.array(z.number().min(0).max(1)).max(4096).optional(),
    license: z.string().max(1000).default("User supplied; verify usage rights"),
    transcript: z.string().max(50000).optional(),
    transcriptWords: z.array(transcriptWordSchema).max(10000).optional(),
    generatedSource: z.string().max(300).optional(),
    sourceId: z.string().max(100).optional(),
  })
  .refine((a) => a.trimIn < a.duration, {
    message: "Audio trim must start before the end of the recording",
    path: ["trimIn"],
  });
export type AudioClip = z.infer<typeof audioSchema>;
export const projectSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(200),
  html: z.string().max(2_000_000),
  css: z.string().max(2_000_000),
  js: z.string().max(2_000_000),
  settings: settingsSchema,
  assets: z.array(assetSchema).max(100),
  markers: z.array(z.number()).default([]),
  workflow: workflowSchema.optional(),
  audio: z.array(audioSchema).max(60).optional(),
  audioLibrary: z.array(audioSchema).max(100).optional(),
  brand: z
    .object({
      name: z.string().max(200),
      font: z.string().min(1).max(200),
      primary: z.string().regex(/^#[0-9a-f]{6}$/i),
      secondary: z.string().regex(/^#[0-9a-f]{6}$/i),
      background: z.string().regex(/^#[0-9a-f]{6}$/i),
    })
    .optional(),
});
export type Project = z.infer<typeof projectSchema>;
export type Settings = Project["settings"];
export const defaults: Settings = {
  width: 1920,
  height: 1080,
  duration: 10,
  fps: 30,
  speed: 1,
  background: "#101321",
  loop: true,
  network: false,
  timing: "seek",
};
export function newProject(): Project {
  return {
    version: 1,
    name: "Untitled animation",
    html: '<div id="ball"></div>',
    css: "body { display:grid; place-items:center; }\n#ball { width:140px; height:140px; border-radius:50%; background:linear-gradient(135deg,#b5a5ff,#6850e8); box-shadow:0 20px 100px #8b6cff66; animation:bounce 2s ease-in-out infinite alternate; }\n@keyframes bounce { from { transform:translateY(-220px) scale(.9); } to { transform:translateY(220px) scale(1.1,.9); } }",
    js: "// For deterministic Canvas or JS animations, define:\n// window.renderFrame = (timeInSeconds) => { ... };",
    settings: { ...defaults },
    assets: [],
    markers: [],
  };
}
export function combined(p: Project) {
  return `<!doctype html>\n<html>\n<head>\n<meta charset="UTF-8">\n<style>${p.css}</style>\n</head>\n<body>\n${p.html}\n<script>${p.js}</script>\n</body>\n</html>`;
}
export function parseCombined(
  source: string,
): Pick<Project, "html" | "css" | "js"> {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const styles = [...doc.querySelectorAll("style")],
    scripts = [...doc.querySelectorAll("script")];
  if (
    scripts.some((s) => s.src || s.type === "module") ||
    doc.querySelector("link,base,iframe,object,embed")
  )
    throw Error(
      "Combined editing supports inline styles and classic scripts only. Your separate editors are unchanged.",
    );
  if (doc.head.querySelector(":not(meta):not(title):not(style):not(script)"))
    throw Error("Unsupported head content. Separate editors are unchanged.");
  const css = styles.map((s) => s.textContent ?? "").join("\n");
  const audioScripts = scripts.filter(
    (script) =>
      script.id === "framescript-audio" && script.type === "application/json",
  );
  if (audioScripts.length > 1)
    throw Error("Use only one framescript-audio manifest.");
  const js = scripts
    .filter((script) => !audioScripts.includes(script))
    .map((s) => s.textContent ?? "")
    .join("\n");
  styles.forEach((s) => s.remove());
  scripts
    .filter((script) => !audioScripts.includes(script))
    .forEach((s) => s.remove());
  audioScripts.forEach((script) => doc.body.append(script));
  return { html: doc.body.innerHTML.trim(), css, js };
}
export const aiSchema = z
  .object({
    action: z.enum(["create", "update"]),
    html: z.string().optional(),
    css: z.string().optional(),
    js: z.string().optional(),
    settings: settingsSchema.partial().optional(),
    explanation: z.string(),
    assets: z.array(z.string()).optional(),
  })
  .strict();
export function applyAI(p: Project, value: unknown): Project {
  const a = aiSchema.parse(value);
  if (a.assets?.some((id) => !p.assets.some((x) => x.id === id)))
    throw Error("AI referenced an unknown asset");
  return projectSchema.parse({
    ...p,
    ...(a.html !== undefined ? { html: a.html } : {}),
    ...(a.css !== undefined ? { css: a.css } : {}),
    ...(a.js !== undefined ? { js: a.js } : {}),
    settings: {
      ...p.settings,
      ...a.settings,
      ...(p.audio?.some(
        (clip) =>
          clip.lane === "voice" &&
          !clip.muted &&
          (!clip.sceneId || clip.sceneId === p.workflow?.selectedId),
      )
        ? { duration: p.settings.duration }
        : {}),
    },
  });
}
export const exportSchema = z
  .object({
    reuseFrames: z.boolean().optional(),
    graphics: z.enum(["auto", "hardware", "browser"]).optional(),
    acceleration: z.enum(["auto", "software"]).optional(),
    captureMode: z.enum(["fast", "lossless"]).optional(),
    fileName: z.string().trim().min(1).max(150).optional(),
    format: z.enum(["mp4", "mkv", "webm", "gif", "sequence", "png"]),
    width: z.number().int().min(64).max(7680),
    height: z.number().int().min(64).max(4320),
    fps: z.number().int().min(1).max(120),
    duration: z.number().min(0.1).max(600),
    speed: z.number().min(0.1).max(8),
    quality: z.number().int().min(0).max(51),
    fit: z.enum(["fit", "fill", "stretch"]),
    transparent: z.boolean(),
    time: z.number().min(0).default(0),
  })
  .superRefine((s, c) => {
    if (["mp4", "mkv"].includes(s.format) && (s.width % 2 || s.height % 2))
      c.addIssue({ code: "custom", message: "H.264 requires even dimensions" });
    if (s.transparent && !["png", "sequence", "webm"].includes(s.format))
      c.addIssue({
        code: "custom",
        message: "This format cannot preserve transparency",
      });
    if (Math.ceil((s.duration / s.speed) * s.fps) > 100000)
      c.addIssue({ code: "custom", message: "Export exceeds 100,000 frames" });
  });
export type ExportOptions = z.infer<typeof exportSchema>;
export function frameTimes(
  o: Pick<ExportOptions, "duration" | "fps" | "speed">,
) {
  return Array.from(
    { length: Math.ceil((o.duration / o.speed) * o.fps) },
    (_, i) => (i / o.fps) * o.speed,
  );
}
