import type { Project, Scene } from "./project";
import { sceneOffset, totalDuration } from "./workflow";
import { structuredStarCode } from "./structured-star";
import { sceneEditTargets, type editTargetSchema } from "./structured-edit";
import type { z } from "zod";

export function structuredExtensionTiming(project: Project, clipId: string) {
  const clips = project.workflow?.scenes ?? [];
  const index = clips.findIndex((clip) => clip.id === clipId);
  const clip = clips[index];
  const source = clip?.structuredEdit;
  if (!clip || !source || clip.locked) return;
  const code = structuredStarCode(source);
  if (clip.html !== code.html || clip.css !== code.css || clip.js !== code.js)
    return;
  const visualDuration = Math.min(clip.duration, clip.visualDuration ?? clip.duration);
  if (!visualDuration) return;
  const handoff = (clip.sourceOffset ?? 0) + visualDuration;
  const sourceEnd = source.durationFrames / source.fps;
  if (handoff > sourceEnd + 1e-9) return;
  return {
    clip,
    visualDuration,
    handoff,
    lastVisibleFrame: Math.max(0, Math.ceil(handoff * source.fps - 1e-9) - 1),
    projectEnd: sceneOffset(project, clipId) + visualDuration,
    available: Math.max(
      0,
      Math.min(sourceEnd - handoff, 600 - totalDuration(project) + clip.duration - visualDuration),
    ),
    following: clips.slice(index + 1),
  };
}

// Timeline positions are measured in scene seconds. Playback speed changes
// elapsed playback time, not the position sent to renderFrame.
export function structuredClipTiming(
  clip: Pick<Scene, "structuredEdit" | "sourceOffset" | "duration" | "visualDuration">,
  target?: z.infer<typeof editTargetSchema>,
) {
  const scene = clip.structuredEdit;
  if (!scene) return;
  const sourceOffset = clip.sourceOffset ?? 0;
  const duration = Math.min(clip.duration, clip.visualDuration ?? clip.duration);
  const sourceEnd = sourceOffset + duration;
  const selected = sceneEditTargets(scene).find(
    (item) =>
      !target ||
      (item.nodeId === target.nodeId &&
        item.property === target.property &&
        item.keyframeId === target.keyframeId),
  );
  if (!selected) return;
  const sourceTime = selected.frame / scene.fps;
  const epsilon = 1e-9;
  if (
    sourceEnd > scene.durationFrames / scene.fps + epsilon ||
    sourceTime < sourceOffset - epsilon ||
    sourceTime >= sourceEnd - epsilon
  )
    return;
  return {
    sourceOffset,
    duration,
    sourceTime,
    clipTime: Math.max(0, sourceTime - sourceOffset),
  };
}
