import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import {
  contextFrameRange,
  describeReferences,
  structuredContextLimitMiB,
  type PromptReferences,
} from "../shared/prompt-references";
export { referenceGuide } from "../shared/prompt-references";
import { newProject } from "../shared/project";
import {
  structuredStarCode,
  type StructuredEditScene,
} from "../shared/structured-star";
import { renderExport } from "./export";

type PackageFile = { path: string; content: string | Buffer };

function fileBytes(content: PackageFile["content"]) {
  return typeof content === "string"
    ? Buffer.byteLength(content)
    : content.length;
}

export function describePackageFiles<T extends PackageFile>(files: T[]) {
  return files.map(({ content, ...entry }) => ({
    ...entry,
    bytes: fileBytes(content),
    sha256: createHash("sha256").update(content).digest("hex"),
  }));
}

export function assertStructuredPackageBudget(
  mode: "Edit" | "Extend",
  files: PackageFile[],
) {
  const sizes = files.map(({ path, content }) => ({
    path,
    bytes: fileBytes(content),
  }));
  if (
    sizes.reduce((total, file) => total + file.bytes, 0) <=
    structuredContextLimitMiB * 1024 ** 2
  )
    return;
  const largest = sizes
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 3)
    .map(({ path, bytes }) => `${path} (${(bytes / 1024 ** 2).toFixed(2)} MiB)`)
    .join(", ");
  throw Error(
    `${mode} context exceeds ${structuredContextLimitMiB} MiB before ZIP compression. Largest files: ${largest}. Remove optional references or the optional frame. If required files exceed the limit, reduce the source size or resolution before exporting.`,
  );
}

export function packageReferences(references: PromptReferences = []) {
  return describeReferences(references).map((file, index) => {
    const content = Buffer.from(references[index].data, "base64");
    if (!content.length || content.length > 2 * 1024 * 1024)
      throw Error("Each reference must contain between 1 byte and 2 MB.");
    return { ...file, content };
  });
}

export function additionalCapturePath(
  scene: StructuredEditScene,
  frame: number | undefined,
  placement?: { sourceOffset: number; duration: number },
) {
  if (frame === undefined) return undefined;
  const { first, last } = contextFrameRange(scene, placement);
  if (!Number.isInteger(frame) || frame < first || frame > last)
    throw Error(
      "The additional source frame must be within the selected clip.",
    );
  return `references/preview-frames/context-frame-${frame}.png`;
}

export async function renderPackageCapture(
  scene: StructuredEditScene,
  frame: number,
  root: string,
  file: string,
  role: "required-evidence" | "context-frame",
  signal: AbortSignal,
) {
  const destination = path.join(root, file);
  const base = newProject();
  const { width, height, fps } = scene;
  const duration = scene.durationFrames / fps;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await renderExport(
    {
      ...base,
      ...structuredStarCode(scene),
      settings: { ...base.settings, width, height, fps, duration, speed: 1 },
    },
    {
      format: "png",
      width,
      height,
      fps,
      duration,
      time: frame / fps,
      speed: 1,
      quality: 0,
      fit: "fit",
      transparent: false,
    },
    destination,
    ffmpeg ?? "",
    signal,
    () => {},
  );
  return {
    path: file,
    role,
    frame,
    sceneRevision: scene.revision,
    content: await fs.readFile(destination),
  };
}
