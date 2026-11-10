import { z } from "zod";
import {
  assetSchema,
  settingsSchema,
  visualCodeSchema,
  visualContextSchema,
  type AudioClip,
  type Project,
  type Scene,
} from "./project";
import {
  describeReferences,
  promptReferencesSchema,
  referenceGuide,
} from "./prompt-references";
import { sceneOffset, totalDuration } from "./workflow";
import { transcriptSrt, voiceoverWordsForScene } from "./transcript";

export const codeContinuationInputSchema = z
  .strictObject({
    source: visualCodeSchema,
    title: z.string().min(1).max(200),
    settings: settingsSchema,
    assets: z.array(assetSchema).max(100),
    sourceOffset: z.number().min(0).max(600),
    handoff: z.number().min(0.1).max(600),
    timelineHandoff: z.number().min(0.1).max(600),
    lastFrameTime: z.number().min(0).max(600),
    duration: z.number().min(0.1).max(600),
    inheritedContext: visualContextSchema.optional(),
    direction: z.string().max(12000),
    pacing: z.string().max(4000),
    camera: z.string().max(4000),
    narration: z.string().max(100000),
    references: promptReferencesSchema.optional(),
  })
  .refine(
    ({ lastFrameTime, handoff }) => lastFrameTime < handoff,
    "The capture must be before the handoff.",
  );
export type CodeContinuationInput = z.infer<typeof codeContinuationInputSchema>;

export function continuationAudio(
  project: Project,
  sceneId: string,
  handoff: number,
) {
  const sceneStart = sceneOffset(project, sceneId);
  return (project.audio ?? [])
    .flatMap((clip) => {
      if (
        clip.lane !== "voice" ||
        clip.muted ||
        clip.loop ||
        (clip.sceneId && clip.sceneId !== sceneId)
      )
        return [];
      const start = clip.start - (clip.sceneId ? 0 : sceneStart) - handoff;
      const end = start + Math.min(clip.length, clip.duration - clip.trimIn);
      return end > 0 ? [{ clip, start, end }] : [];
    })
    .sort((a, b) => a.start - b.start);
}

export function continuationNarration(
  clip: AudioClip,
  start: number,
  duration: number,
) {
  return transcriptSrt(
    voiceoverWordsForScene(
      { ...clip, start, sceneId: "continuation" },
      duration,
    ),
  );
}

export function continuationSource(
  project: Project,
  sceneId: string,
  segmentId?: string,
) {
  const scene = project.workflow?.scenes.find((item) => item.id === sceneId);
  if (
    !scene ||
    scene.locked ||
    scene.structuredEdit ||
    project.settings.timing !== "seek"
  )
    return;
  const segments = scene.visualContinuations ?? [];
  if (segments.length >= 29) return;
  const last = segments.at(-1);
  if (last?.id !== segmentId) return;
  const duration =
    last?.duration ??
    Math.min(scene.duration, scene.visualDuration ?? scene.duration);
  if (duration < 0.1) return;
  const handoff = (last?.start ?? 0) + duration;
  const fps = project.settings.fps;
  const frame = Math.max(0, Math.ceil(duration * fps - 1e-9) - 1);
  const { html, css, js } = last ?? scene;
  return {
    scene,
    code: { html, css, js },
    duration,
    handoff,
    lastFrameTime: frame / fps,
    sourceOffset: last ? 0 : (scene.sourceOffset ?? 0),
    context: last?.context ?? scene.visualContext,
    timelineHandoff: sceneOffset(project, sceneId) + handoff,
    maxDuration: Math.max(
      0,
      scene.duration + 600 - totalDuration(project) - handoff,
    ),
  };
}

export function buildCodeContinuationPrompt(input: CodeContinuationInput) {
  const { width, height, fps } = input.settings;
  return `Continue the existing FrameScript animation in “${input.title}”. Generate only the new segment as one complete HTML document, with inline CSS and classic JavaScript.\n\nRead the attached ZIP. Inspect source/previous.html, source/previous.css, source/previous.js, and references/handoff.png. Match the composition, colors, object positions, typography and motion at the handoff. If available, use context/inherited.json as read-only continuity guidance. The previous segment already exists and must not be recreated.\n${referenceGuide(describeReferences(input.references))}\nNEW SEGMENT\nCanvas: ${width} × ${height} pixels at ${fps} fps. Duration: ${input.duration} seconds. The handoff is at ${input.timelineHandoff.toFixed(3)} seconds in the existing timeline. Your segment starts at local time 0.\nVisual direction: ${input.direction || "Continue the story from the handoff."}\nPacing: ${input.pacing || "Follow the narration cues and existing pace."}\nCamera: ${input.camera || "Continue from the existing framing."}\n\nTIMED NARRATION — SEGMENT-LOCAL SECONDS\n${input.narration || "No timed narration provided."}\nThe supplied narration is already on the timeline. Use cue times to stage the animation and preserve pauses. Add on-screen text only when requested.\n\nExpose window.renderFrame(timeInSeconds). At time zero, match the handoff frame. Draw the complete frame from absolute local time so scrubbing, replay and export are deterministic. Keep the document self-contained using inline styles and classic script. Use local procedural assets, inline SVG or Canvas; do not reference ZIP files at runtime. Do not use autoplay, timers, independent playback loops, external dependencies or invented narration. Return exactly one complete HTML document in an html code block.\n`;
}

export function appendCodeContinuation(
  project: Project,
  scene: Scene,
  input: CodeContinuationInput,
  code: z.infer<typeof visualCodeSchema>,
  id: string,
): Partial<Project> {
  if (!project.workflow) throw Error("The timeline is unavailable.");
  const duration = Math.max(scene.duration, input.handoff + input.duration);
  if (totalDuration(project) - scene.duration + duration > 600)
    throw Error("This extension would exceed ten minutes.");
  const inherited = input.inheritedContext
    ? JSON.parse(input.inheritedContext)
    : {};
  const segment = {
    ...visualCodeSchema.parse(code),
    id,
    start: input.handoff,
    duration: input.duration,
    context: visualContextSchema.parse(
      JSON.stringify(
        {
          ...inherited,
          continuation: {
            direction: input.direction,
            pacing: input.pacing,
            camera: input.camera,
            duration: input.duration,
            format: "document",
          },
        },
        null,
        2,
      ),
    ),
  };
  return {
    workflow: {
      ...project.workflow,
      scenes: project.workflow.scenes.map((item) =>
        item.id === scene.id
          ? {
              ...item,
              duration,
              visualDuration: item.visualDuration ?? item.duration,
              visualContinuations: [
                ...(item.visualContinuations ?? []),
                segment,
              ],
            }
          : item,
      ),
    },
    ...(project.workflow.selectedId === scene.id
      ? { settings: { ...project.settings, duration } }
      : {}),
  };
}
