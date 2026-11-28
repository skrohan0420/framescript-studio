import { z } from "zod";
import type { Project } from "./project";

export const packageContextSchema = z.object({
  projectName: z.string().max(200),
  sceneTitle: z.string().max(200),
  sceneNumber: z.number().int().min(1).max(30),
  continuationNumber: z.number().int().min(1).max(30).optional(),
  renderingMode: z.enum(["auto", "2d", "2.5d", "3d"]).optional(),
  timeZone: z.string().max(100).optional(),
});
export type PackageContext = z.infer<typeof packageContextSchema>;
export type PackagePurpose = "director" | "code" | "continuation-director" | "continuation-code" | "native-scene" | "native-extend" | "native-edit";

export function projectPackageContext(project: Project, sceneId = project.workflow?.selectedId): PackageContext {
  const index = project.workflow?.scenes.findIndex((scene) => scene.id === sceneId) ?? -1;
  const scene = index >= 0 ? project.workflow?.scenes[index] : undefined;
  const mode = project.promptDraft?.renderingMode;
  return {
    projectName: project.name,
    sceneTitle: scene?.title ?? project.name,
    sceneNumber: Math.max(1, index + 1),
    renderingMode: mode === "3d" || mode === "2.5d" || mode === "2d" || mode === "auto" ? mode : undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function safePart(value: string, fallback: string, limit: number) {
  const clean = value.normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ").trim();
  return [...clean].slice(0, limit).join("").replace(/[. ]+$/g, "") || fallback;
}

export function packageFilename(context: PackageContext, purpose: PackagePurpose, now = new Date()) {
  const categories: Record<PackagePurpose, string> = {
    director: "01 Director", code: "02 Scene Code",
    "continuation-director": "01 Director", "continuation-code": "02 Scene Code",
    "native-scene": "03 Editable Scene", "native-extend": "04 Editable Extension", "native-edit": "05 Editable Edit",
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: context.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  } catch {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  }
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  const timestamp = `${parts.year}-${parts.month}-${parts.day}_${parts.hour}${parts.minute}${parts.second}-${String(now.getUTCMilliseconds()).padStart(3, "0")}`;
  const continuation = purpose.startsWith("continuation-")
    ? `Continuation ${String(context.continuationNumber ?? 1).padStart(2, "0")}` : undefined;
  const mode = context.renderingMode && context.renderingMode !== "auto" && !purpose.startsWith("native-")
    ? context.renderingMode.toUpperCase() : undefined;
  return [categories[purpose], safePart(context.projectName, "Untitled project", 45),
    `Scene ${String(context.sceneNumber).padStart(2, "0")} ${safePart(context.sceneTitle, "Untitled scene", 45)}`,
    continuation, mode, timestamp].filter(Boolean).join(" - ") + ".zip";
}
