import type { Project, AudioClip } from "./project";
import { activateScene, initialWorkflow } from "./workflow";
import { readTextLayers } from "./typography";

export function splitVisual(
  project: Project,
  id: string,
  time: number,
): Partial<Project> {
  const workflow = project.workflow ?? initialWorkflow(project);
  const index = workflow.scenes.findIndex((scene) => scene.id === id);
  const scene = workflow.scenes[index];
  if (!scene || scene.locked) throw Error("Select an unlocked visual clip.");
  if (scene.visualContinuations?.length)
    throw Error(
      "Remove the visual continuations before splitting this timeline.",
    );
  if (workflow.scenes.length >= 30)
    throw Error("A project supports up to 30 visual clips.");
  if (time < 0.1 || scene.duration - time < 0.1)
    throw Error(
      "Place the playhead inside the clip, at least 0.1s from its edges.",
    );
  const right = {
    ...scene,
    id: crypto.randomUUID(),
    title: `${scene.title} (split)`,
    duration: scene.duration - time,
    sourceOffset: (scene.sourceOffset ?? 0) + time,
    visualDuration:
      scene.visualDuration === undefined
        ? undefined
        : Math.min(
            scene.duration - time,
            Math.max(0, scene.visualDuration - time),
          ),
  };
  const scenes = [
    ...workflow.scenes.slice(0, index),
    {
      ...scene,
      duration: time,
      visualDuration:
        scene.visualDuration === undefined
          ? undefined
          : Math.min(time, scene.visualDuration),
    },
    right,
    ...workflow.scenes.slice(index + 1),
  ];
  const audio: AudioClip[] = [];
  for (const clip of project.audio ?? []) {
    if (clip.sceneId !== id || clip.start + clip.length <= time) {
      audio.push(clip);
      continue;
    }
    if (clip.start >= time) {
      audio.push({ ...clip, sceneId: right.id, start: clip.start - time });
      continue;
    }
    const consumed = time - clip.start;
    audio.push({ ...clip, length: consumed });
    audio.push({
      ...clip,
      id: crypto.randomUUID(),
      sceneId: right.id,
      start: 0,
      trimIn: clip.loop
        ? (clip.trimIn + consumed) % clip.duration
        : clip.trimIn + consumed,
      length: clip.length - consumed,
    });
  }
  const next = { ...workflow, scenes, selectedId: scene.id };
  return { ...activateScene({ ...project, workflow: next }, scene.id), audio };
}

export function resizeVisual(
  project: Project,
  id: string,
  duration: number,
  segmentId?: string,
): Partial<Project> {
  const workflow = project.workflow ?? initialWorkflow(project);
  const scene = workflow.scenes.find((scene) => scene.id === id);
  if (!scene || scene.locked) throw Error("Select an unlocked visual clip.");
  const remaining =
    600 -
    workflow.scenes.reduce(
      (sum, item) => sum + (item.id === id ? 0 : item.duration),
      0,
    );
  const segments = scene.visualContinuations ?? [];
  const index = segmentId
    ? segments.findIndex((segment) => segment.id === segmentId)
    : -1;
  if (segmentId && index === -1)
    throw Error("The continuation is unavailable.");
  const originalDuration =
    scene.visualDuration ?? segments[0]?.start ?? scene.duration;
  const previousDuration = segmentId
    ? segments[index].duration
    : originalDuration;
  const previousEnd = segments.length
    ? segments.at(-1)!.start + segments.at(-1)!.duration
    : originalDuration;
  const length = Math.max(
    0.1,
    Math.min(remaining - previousEnd + previousDuration, duration),
  );
  const delta = length - previousDuration;
  const continuations = segments.map((segment, position) => {
    if (position < index) return segment;
    if (position === index) return { ...segment, duration: length };
    return { ...segment, start: segment.start + delta };
  });
  const origin = scene.sourceOffset ?? 0;
  const textEnd = (
    scene.html.includes("data-fs-text") ? readTextLayers(scene.html) : []
  ).reduce(
    (end, layer) =>
      layer.start < origin + scene.duration
        ? Math.max(end, layer.end - origin)
        : end,
    0,
  );
  const audioEnd = (project.audio ?? []).reduce((end, clip) => {
    const clipEnd = clip.start + clip.length;
    if (clip.sceneId === id) return Math.max(end, clipEnd);
    if (!clip.sceneId) return Math.max(end, clipEnd - (600 - remaining));
    return end;
  }, 0);
  const visualDuration = segmentId ? originalDuration : length;
  const continuationEnd = Math.max(
    0,
    ...continuations.map((segment) => segment.start + segment.duration),
  );
  const sceneLength = Math.max(
    visualDuration,
    continuationEnd,
    Math.min(scene.duration, Math.max(audioEnd, textEnd)),
  );
  const next = {
    ...workflow,
    scenes: workflow.scenes.map((item) =>
      item.id === id
        ? {
            ...item,
            duration: sceneLength,
            visualDuration,
            ...(item.visualContinuations
              ? { visualContinuations: continuations }
              : {}),
          }
        : item,
    ),
  };
  return {
    workflow: next,
    ...(workflow.selectedId === id
      ? { settings: { ...project.settings, duration: sceneLength } }
      : {}),
  };
}
