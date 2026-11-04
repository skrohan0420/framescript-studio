import type { Scene } from "./project";

// Timeline positions are measured in scene seconds. Playback speed changes
// elapsed playback time, not the position sent to renderFrame.
export function structuredClipTiming(
  clip: Pick<Scene, "structuredEdit" | "sourceOffset" | "duration">,
) {
  const scene = clip.structuredEdit;
  if (!scene) return;
  const sourceOffset = clip.sourceOffset ?? 0;
  const sourceEnd = sourceOffset + clip.duration;
  const sourceTime = scene.star.keyframe.frame / scene.fps;
  const epsilon = 1e-9;
  if (
    sourceEnd > scene.durationFrames / scene.fps + epsilon ||
    sourceTime < sourceOffset - epsilon ||
    sourceTime >= sourceEnd - epsilon
  )
    return;
  return {
    sourceOffset,
    duration: clip.duration,
    sourceTime,
    clipTime: Math.max(0, sourceTime - sourceOffset),
  };
}
