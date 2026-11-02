import {
  projectSchema,
  type AudioClip,
  type Project,
  type Scene,
} from "./project";

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
export function narrationLength(clip: AudioClip) {
  if (clip.muted || clip.lane !== "voice" || clip.loop)
    throw Error("Choose an active, non-looping narration take.");
  return Math.min(clip.length, clip.duration - clip.trimIn);
}
/** Duration matching is proportional to text, not word-level forced alignment. */
export function timeScenesToNarration(
  scenes: Scene[],
  clip: AudioClip,
  script: string,
): Scene[] {
  if (clip.sceneId) throw Error("Choose a full-script narration take.");
  if (
    clip.transcript !== undefined &&
    normalize(clip.transcript) !== normalize(script)
  )
    throw Error(
      "The script changed after this narration was recorded. Generate or import a new take before composing scenes.",
    );
  if (
    normalize(scenes.map((scene) => scene.narration).join(" ")) !==
    normalize(script)
  )
    throw Error("Scene narration must preserve the complete script in order.");
  const duration = narrationLength(clip);
  if (
    !scenes.length ||
    duration + 1e-9 < scenes.length * 0.1 ||
    duration + clip.start > 600
  )
    throw Error(
      "Narration timing must fit between 0.1 seconds per scene and ten minutes total.",
    );
  const weights = scenes.map((scene) =>
    Math.max(1, scene.narration.trim().split(/\s+/).length),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const flexible = Math.max(0, duration - scenes.length * 0.1);
  let used = 0;
  return scenes.map((scene, index) => {
    const length =
      index === scenes.length - 1
        ? Math.max(0.1, duration - used)
        : 0.1 + (flexible * weights[index]) / total;
    used += length;
    const next = length + (index === 0 ? clip.start : 0);
    if (scene.locked && Math.abs(next - scene.duration) > 1e-8)
      throw Error("Unlock scenes before fitting the storyboard to narration.");
    return { ...scene, duration: next };
  });
}

/** Add a take and its timing atomically, so validation never leaves half an edit. */
export function withAudioClip(project: Project, clip: AudioClip): Project {
  const scene = project.workflow?.scenes.find(
    (scene) => scene.id === clip.sceneId,
  );
  if (clip.sceneId && !scene)
    throw Error("The target scene changed. Select a scene and try again.");
  if (scene?.locked) throw Error("Unlock the scene before adding audio.");
  if (
    clip.lane === "voice" &&
    clip.sceneId &&
    project.audio?.some(
      (item) => item.lane === "voice" && !item.sceneId && !item.muted,
    )
  )
    throw Error(
      "Mute the full-script narration before adding separate scene narration, so two voice tracks do not overlap.",
    );
  let next: Project = {
    ...project,
    audio: [
      ...(project.audio ?? []).map((previous) =>
        clip.lane === "voice" &&
        previous.lane === "voice" &&
        (!clip.sceneId || previous.sceneId === clip.sceneId)
          ? { ...previous, muted: true }
          : previous,
      ),
      clip,
    ],
  };
  if (clip.lane === "voice") {
    if (clip.duration > 600)
      throw Error("Narration exceeds the ten-minute composition limit.");
    const duration = Math.max(0.1, clip.start + narrationLength(clip));
    if (scene && next.workflow) {
      next = {
        ...next,
        workflow: {
          ...next.workflow,
          scenes: next.workflow.scenes.map((item) =>
            item.id === scene.id ? { ...item, duration } : item,
          ),
        },
        settings:
          next.workflow.selectedId === scene.id
            ? { ...next.settings, duration }
            : next.settings,
      };
    } else if (
      next.workflow?.scenes.length === 1 &&
      !next.workflow.scenes[0].narration &&
      !next.workflow.scenes[0].locked
    ) {
      next = {
        ...next,
        workflow: {
          ...next.workflow,
          scenes: [{ ...next.workflow.scenes[0], duration }],
        },
        settings: { ...next.settings, duration },
      };
    }
  }
  return projectSchema.parse(next);
}
