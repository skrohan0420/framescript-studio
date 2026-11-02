import type { Project, AudioClip } from "./project";
import { activateScene, initialWorkflow } from "./workflow";

export function splitVisual(
  project: Project,
  id: string,
  time: number,
): Partial<Project> {
  const workflow = project.workflow ?? initialWorkflow(project);
  const index = workflow.scenes.findIndex((scene) => scene.id === id);
  const scene = workflow.scenes[index];
  if (!scene || scene.locked) throw Error("Select an unlocked visual clip.");
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
  };
  const scenes = [
    ...workflow.scenes.slice(0, index),
    { ...scene, duration: time },
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
  const length = Math.max(0.1, Math.min(remaining, duration));
  const next = {
    ...workflow,
    scenes: workflow.scenes.map((item) =>
      item.id === id ? { ...item, duration: length } : item,
    ),
  };
  const audio = project.audio
    ?.filter((clip) => clip.sceneId !== id || clip.start < length)
    .map((clip) =>
      clip.sceneId === id
        ? { ...clip, length: Math.min(clip.length, length - clip.start) }
        : clip,
    );
  return {
    workflow: next,
    ...(workflow.selectedId === id
      ? { settings: { ...project.settings, duration: length } }
      : {}),
    audio,
  };
}
