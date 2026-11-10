import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { structuredResultModuleInstructions } from "../shared/structured-result";
import {
  contextFrameRange,
  type PromptContext,
} from "../shared/prompt-references";
import {
  editPatchSchema,
  editRequestSchema,
  sceneEditTargets,
  type editTargetSchema,
} from "../shared/structured-edit";
import {
  starModuleSource,
  type StructuredEditScene,
} from "../shared/structured-star";
import { archiveSequence } from "./archive";
import {
  additionalCapturePath,
  assertStructuredPackageBudget,
  describePackageFiles,
  packageReferences,
  referenceGuide,
  renderPackageCapture,
} from "./structured-package-context";
import { atomicWrite } from "./storage";
import { structuredClipTiming } from "../shared/structured-edit-timing";

export async function writeStructuredEditPackage(
  scene: StructuredEditScene,
  requestId: string,
  requestedValue: number,
  destination: string,
  requestFile: string,
  clipId: string,
  projectId: string | null = null,
  placement?: { sourceOffset: number; duration: number },
  scope: "clip" | "shared" = "clip",
  target?: z.infer<typeof editTargetSchema>,
  context?: PromptContext,
) {
  const selected = sceneEditTargets(scene).find(
    (item) =>
      !target ||
      (item.nodeId === target.nodeId &&
        item.property === target.property &&
        item.keyframeId === target.keyframeId),
  );
  if (
    !selected ||
    requestedValue < selected.min ||
    requestedValue > selected.max
  )
    throw Error("Choose a declared target and a value in its supported range.");
  const range = placement ?? {
    sourceOffset: 0,
    duration: scene.durationFrames / scene.fps,
  };
  const timing = structuredClipTiming(
    { ...range, structuredEdit: scene },
    selected,
  );
  if (!timing)
    throw Error("The source keyframe must be inside the selected clip.");
  const request = editRequestSchema.parse({
    contractVersion: "1",
    mode: "edit",
    requestId,
    sceneId: scene.sceneId,
    baseRevision: scene.revision,
    allowedTarget: {
      nodeId: selected.nodeId,
      property: selected.property,
      keyframeId: selected.keyframeId,
    },
    requestedValue,
  });
  const frame = selected.frame;
  const seconds = timing.sourceTime.toFixed(3);
  const rangeEnd = range.sourceOffset + range.duration;
  const sourcePath = "source/scene.json";
  const contextPath = "context/edit-range.json";
  const framePath = `references/preview-frames/keyframe-${seconds}s.png`;
  const references = packageReferences(context?.references);
  const extraFrame = context?.captureFrame;
  const extraPath = additionalCapturePath(scene, extraFrame, range);
  const guide = referenceGuide(
    extraPath ? [...references, { path: extraPath }] : references,
  );
  const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
  const brief = `Edit ${scene.title}, revision ${scene.revision}. Set ${selected.nodeId}.${selected.property} from ${selected.value} to ${requestedValue} at source frame ${frame} (${seconds}s). Preserve the keyframe time, label and unrelated content.\nSelected clip source range: [${range.sourceOffset.toFixed(3)}s, ${rangeEnd.toFixed(3)}s). Edit scope: ${scope === "shared" ? "all matching linked clips" : "this clip only"}.`;
  const prompt = `${brief}\n\nOpen the attached ZIP and read TASK.md first. Use ${contextPath} for the exact range and target. Inspect ${framePath} and return one JavaScript module following OUTPUT_CONTRACT.md.${guide || " "}If you cannot access a required file, name it before proceeding.\n`;
  const frameRange = contextFrameRange(scene, range);
  const baseFiles = [
    {
      path: "TASK.md",
      role: "task",
      content: `${prompt}\nThe full canonical scene and its tracks are in ${sourcePath}. The selected clip range locates the target and captures. The existing interpolation of the edited track may change before or after the selected range.\n`,
    },
    {
      path: "OUTPUT_CONTRACT.md",
      role: "contract",
      content: `${structuredResultModuleInstructions}\n\nThe exported object must conform to \`schemas/edit-result.schema.json\`. Echo request ID \`${request.requestId}\`, scene ID \`${scene.sceneId}\` and base revision ${scene.revision}. The only allowed operation is \`set-keyframe-value\` on \`${selected.nodeId}.${selected.property}\`, keyframe \`${selected.keyframeId}\`, with value ${requestedValue}.\n`,
    },
    {
      path: contextPath,
      role: "edit-range",
      content: json({
        sourcePath,
        sceneId: scene.sceneId,
        baseRevision: scene.revision,
        fps: scene.fps,
        sourceDurationFrames: scene.durationFrames,
        selectedClip: {
          id: clipId,
          sourceStartSeconds: range.sourceOffset,
          sourceEndSecondsExclusive: rangeEnd,
          firstSourceFrame: frameRange.first,
          lastSourceFrame: frameRange.last,
        },
        scope,
        target: {
          ...request.allowedTarget,
          sourceFrame: frame,
          sourceSeconds: timing.sourceTime,
          clipSeconds: timing.clipTime,
          currentValue: selected.value,
          requestedValue,
        },
        evidence: framePath,
        ...(extraPath ? { optionalCapture: extraPath } : {}),
      }),
    },
    { path: sourcePath, role: "scene-source", content: json(scene) },
    ...(scene.star
      ? [
          {
            path: scene.star.modulePath,
            role: "runtime-module",
            content: starModuleSource,
          },
        ]
      : []),
    {
      path: "schemas/edit-result.schema.json",
      role: "schema",
      content: json(z.toJSONSchema(editPatchSchema)),
    },
  ];
  assertStructuredPackageBudget("Edit", [...baseFiles, ...references]);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = await fs.mkdtemp(
    path.join(path.dirname(destination), "edit-package-"),
  );
  const root = path.join(temporary, "package");
  const signal = AbortSignal.timeout(60_000);
  try {
    const evidence = await renderPackageCapture(
      scene,
      frame,
      root,
      framePath,
      "required-evidence",
      signal,
    );
    const extra =
      extraPath && extraFrame !== undefined
        ? [
            await renderPackageCapture(
              scene,
              extraFrame,
              root,
              extraPath,
              "context-frame",
              signal,
            ),
          ]
        : [];
    const files = [...baseFiles, evidence, ...extra, ...references];
    const manifest = {
      packageType: "framescript-task",
      packageVersion: "1",
      ...request,
      placement,
      scope,
      sourcePath,
      contextPath,
      files: describePackageFiles(files),
    };
    const entries = [
      ...files,
      { path: "manifest.json", content: json(manifest) },
    ];
    assertStructuredPackageBudget("Edit", entries);
    for (const file of entries) {
      const targetPath = path.join(root, file.path);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, file.content);
    }
    await archiveSequence(root, destination, signal);
    try {
      await atomicWrite(
        requestFile,
        json({
          request,
          scene,
          manifest,
          prompt,
          clipId,
          scope,
          projectId,
          placement,
        }),
      );
    } catch (error) {
      await fs.rm(destination, { force: true });
      throw error;
    }
    return { requestId, prompt };
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
