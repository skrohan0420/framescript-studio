import { z } from "zod";
import { newProject, type Project, type Scene } from "./project";
export const templateIds = [
  "visual",
  "headline",
  "quote",
  "bullets",
  "stat",
  "mascot",
] as const;
export const storyboardSchema = z.object({
  scenes: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        narration: z.string().max(30000),
        visual: z.string().max(10000),
        duration: z.number().min(1).max(120),
        template: z.enum(templateIds),
      }),
    )
    .min(1)
    .max(30),
});
export const plannerInstruction =
  'You are a storyboard editor. Return ONLY JSON {"scenes":[{"title":"...","narration":"exact excerpt","visual":"visual direction","duration":8,"template":"headline"}]}. Split the supplied script into meaningful sequential scenes. Preserve ALL script text in narration verbatim and in order; concatenating narrations with spaces must equal the original ignoring whitespace. Do not invent dialogue. Estimate durations in seconds. Default to visual-only scenes with no titles, captions, labels or on-screen typography. Narration is voice-over context only. Choose visual by default; use typography only when explicitly requested. Templates: visual, headline, quote, bullets, stat, mascot. Do not return HTML or code. Maximum 30 scenes, total duration at most 600 seconds. Follow the project visual style and mascot rules.';
export function initialWorkflow(p: Project): NonNullable<Project["workflow"]> {
  return {
    script: "",
    style:
      "Visual-only cinematic motion graphics. No on-screen text unless explicitly requested. Consistent colors, composition and spacing.",
    selectedId: "scene-1",
    scenes: [
      {
        id: "scene-1",
        title: p.name,
        narration: "",
        visual: "Existing animation",
        duration: p.settings.duration,
        locked: false,
        template: "custom",
        html: p.html,
        css: p.css,
        js: p.js,
      },
    ],
    mascot: {
      name: "My mascot",
      rules:
        "Preserve the reference character’s face, proportions, colors, clothing, and illustration style. Change only the requested pose, expression, or action.",
      references: [],
    },
  };
}
export function localStoryboard(script: string) {
  if (!script.trim()) throw Error("Paste a script first.");
  const sentences = script.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [script];
  const groups: string[] = [];
  let group = "";
  for (const sentence of sentences) {
    group += sentence;
    if (group.trim().split(/\s+/).length >= 28) {
      groups.push(group.trim());
      group = "";
    }
  }
  if (group.trim()) groups.push(group.trim());
  if (groups.length > 30)
    throw Error("Use a shorter script or combine paragraphs.");
  return {
    scenes: groups.map((text, i) => ({
      title: `Scene ${i + 1}`,
      narration: text,
      visual:
        i === 0
          ? "Opening visual introducing the subject; no on-screen text"
          : "Support the voice-over with animation and imagery; no on-screen text",
      duration: Math.max(3, Math.round(text.split(/\s+/).length / 2.5)),
      template: "visual" as const,
    })),
  };
}
export function verifyPlan(script: string, plan: unknown) {
  const parsed = storyboardSchema.parse(plan);
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  if (norm(parsed.scenes.map((s) => s.narration).join(" ")) !== norm(script))
    throw Error(
      "The plan omitted or rewrote narration. Your existing scenes are unchanged. Try planning again or split locally.",
    );
  if (parsed.scenes.reduce((n, s) => n + s.duration, 0) > 600)
    throw Error("The plan exceeds ten minutes.");
  return parsed;
}
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function templateCode(
  template: string,
  text: string,
  color = "#67b4ff",
  font = "Segoe UI",
  imageId?: string,
  background = "#101321",
) {
  if (template === "visual")
    return {
      html: '<div id="scene-visual" aria-hidden="true"></div>',
      css: `body{background:${background};display:grid;place-items:center}#scene-visual{width:45vmin;height:45vmin;border-radius:50%;background:radial-gradient(circle,${color}22,transparent 70%);animation:breathe 4s ease-in-out infinite alternate}@keyframes breathe{from{transform:scale(.8);opacity:.4}to{transform:scale(1.2);opacity:1}}`,
      js: "",
    };
  const safe = escape(text),
    words = safe.split(/\s+/),
    base = `body{display:flex;align-items:center;justify-content:center;background:${background};color:#edf3fa;font-family:${JSON.stringify(font)}}.content{max-width:80%;text-align:center}h1,p,blockquote{margin:0;line-height:1.2}h1{font-size:96px;font-weight:750}p,blockquote{font-size:64px} .accent{color:${color}}@keyframes enter{from{opacity:0;transform:translateY(45px)}to{opacity:1;transform:translateY(0)}}.content{animation:enter .8s ease-out both}`;
  if (template === "bullets")
    return {
      html: `<div id="scene-content" class="content"><ul>${text
        .split(/\n+/)
        .filter(Boolean)
        .map(
          (line, i) =>
            `<li style="animation-delay:${i * 0.3}s">${escape(line)}</li>`,
        )
        .join("")}</ul></div>`,
      css:
        base +
        `ul{text-align:left;list-style:none;padding:0;font-size:58px}li{margin:24px 0;animation:enter .65s ease-out both}li:before{content:'•';color:${color};margin-right:24px}`,
      js: "",
    };
  if (template === "stat")
    return {
      html: `<div id="scene-content" class="content"><h1 class="accent" style="font-size:180px">${words[0] ?? "100%"}</h1><p>${words.slice(1).join(" ") || "Your statistic"}</p></div>`,
      css: base,
      js: "",
    };
  if (template === "mascot")
    return {
      html: `<div id="scene-content" class="content">${imageId ? `<img id="scene-mascot" src="asset://${escape(imageId)}" style="height:480px;object-fit:contain">` : '<h1 class="accent">Add your mascot asset</h1>'}<p>${safe}</p></div>`,
      css: base,
      js: "",
    };
  if (template === "quote")
    return {
      html: `<div id="scene-content" class="content"><blockquote><span class="accent">“</span>${safe}<span class="accent">”</span></blockquote></div>`,
      css: base,
      js: "",
    };
  return {
    html: `<div id="scene-content" class="content"><h1>${safe || "Your headline"}</h1><div style="height:6px;background:${color};width:100px;margin:32px auto"></div></div>`,
    css: base,
    js: "",
  };
}
export function scenesFromPlan(
  script: string,
  plan: unknown,
  p: Project,
): Scene[] {
  return verifyPlan(script, plan).scenes.map((scene) => ({
    ...scene,
    template: "visual",
    id: crypto.randomUUID(),
    locked: false,
    ...templateCode(
      "visual",
      scene.title,
      p.brand?.primary ?? "#67b4ff",
      p.brand?.font ?? "Segoe UI",
      p.workflow?.mascot.references[0],
      p.brand?.background,
    ),
  }));
}
export function sceneOffset(p: Project, id: string) {
  let start = 0;
  for (const s of p.workflow?.scenes ?? []) {
    if (s.id === id) return start;
    start += s.duration;
  }
  return 0;
}
export function totalDuration(p: Project) {
  return (
    p.workflow?.scenes.reduce((n, s) => n + s.duration, 0) ??
    p.settings.duration
  );
}
export function selectedScene(p: Project) {
  return p.workflow?.scenes.find((s) => s.id === p.workflow?.selectedId);
}
export function activateScene(p: Project, id: string): Partial<Project> {
  const s = p.workflow?.scenes.find((s) => s.id === id);
  if (!s || !p.workflow) throw Error("Scene not found");
  return {
    workflow: { ...p.workflow, selectedId: id },
    html: s.html,
    css: s.css,
    js: s.js,
    settings: { ...p.settings, duration: s.duration },
    markers: [],
  };
}
export function synchronizeScene(p: Project) {
  if (!p.workflow) return p;
  return {
    ...p,
    workflow: {
      ...p.workflow,
      scenes: p.workflow.scenes.map((s) =>
        s.id === p.workflow!.selectedId
          ? {
              ...s,
              html: p.html,
              css: p.css,
              js: p.js,
              duration: p.settings.duration,
            }
          : s,
      ),
    },
  };
}
export function mascotPrompt(p: Project, direction: string) {
  const m = p.workflow?.mascot;
  return `Create a variant of ${m?.name || "the attached mascot"}.\nIdentity constraints: ${m?.rules || "Preserve the reference identity and art style."}\nVariation: ${direction}\nUse the provided reference images. Keep the full character visible. Use a plain background suitable for compositing. Do not add text, logos or other characters.\nProject style: ${p.workflow?.style ?? ""}`;
}
