import { useStatusNotice } from "./editor-status";
import {
  memo,
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  useImperativeHandle,
  type Ref,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightFromLine,
  Code2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Magnet,
  Minus,
  Scissors,
} from "lucide-react";
import { useStudio, useProjectState } from "./store";
import {
  activateScene,
  selectedScene,
  sceneOffset,
  initialWorkflow,
  totalDuration,
} from "../shared/workflow";
import { AudioTimeline } from "./AudioTimeline";
import { TimelineRulerMarks } from "./TimelineRulerMarks";
import { startTimelineDrag } from "./timeline-drag";
import { TextTimeline } from "./TextTimeline";
import { audioDragType } from "../shared/audio-library";
import { clipFromAudio } from "./audio";
import {
  readTextLayers,
  writeTextLayer,
  splitTextLayer,
  textLayerSchema,
  typographyDragType,
} from "../shared/typography";
import { resizeVisual, splitVisual } from "../shared/timeline-edit";
import { continuationSource } from "../shared/code-continuation";
export type TimelineActions = {
  split: () => void;
  deleteText: () => void;
  toggleSnapping: () => void;
};

export type TimelineSelection =
  | { kind: "audio" | "scene"; id: string; segmentId?: never }
  | { kind: "continuation"; id: string; segmentId: string }
  | null;

const timelineZoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];

export const Timeline = memo(function Timeline({
  masterMode,
  timelineHidden,
  timelineHeight,
  setTimelineHidden,
  runtime,
  navigation,
  onSelectAudio,
  selectedAudio,
  onSelectScene,
  onSelectText,
  actionsRef,
  splitHint,
  onStructuredEdit,
  onStructuredExtend,
  onCodeExtend,
  selection,
  onSelectionChange: setSelection,
}: {
  masterMode: boolean;
  timelineHidden: boolean;
  timelineHeight: number;
  setTimelineHidden: (hidden: boolean) => void;
  runtime: any;
  navigation?: ReactNode;
  onSelectAudio?: (id: string) => void;
  selectedAudio?: string;
  onSelectScene?: (id: string) => void;
  onSelectText?: (sceneId: string | undefined, textId: string) => void;
  actionsRef?: Ref<TimelineActions>;
  splitHint?: string;
  onStructuredEdit?: (id: string) => void;
  onStructuredExtend?: (id: string) => void;
  onCodeExtend?: (id: string, segmentId?: string) => void;
  selection: TimelineSelection;
  onSelectionChange: (selection: TimelineSelection) => void;
}) {
  const playing = useStudio((state) => state.playing);
  const s = useProjectState(),
    p = s.project;
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [snapping, setSnapping] = useState(true);
  const [snapTime, setSnapTime] = useState<number | null>(null);
  const [visualDraft, setVisualDraft] = useState<Partial<typeof p> | null>(null);
  const timelineProject = visualDraft ? { ...p, ...visualDraft } : p;
  const trimCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => trimCleanup.current?.(), []);
  const notify = useStatusNotice();
  const trimVisual = (
    event: ReactPointerEvent<HTMLElement>,
    id: string,
    segmentId?: string,
  ) => {
    if (event.button !== 0 || trimCleanup.current) return;
    event.preventDefault();
    event.stopPropagation();
    const state = useStudio.getState(),
      project = state.project;
    const workflow = project.workflow ?? initialWorkflow(project);
    const scene = workflow.scenes.find((item) => item.id === id);
    const bounds = rulerRef.current?.getBoundingClientRect();
    if (!scene || scene.locked || !bounds) return;
    const segment = scene.visualContinuations?.find(
      (item) => item.id === segmentId,
    );
    if (segmentId && !segment) return;
    state.setSelectedText(null);
    setSelection(
      segmentId
        ? { kind: "continuation", id, segmentId }
        : { kind: "scene", id },
    );
    const revision = state.revision,
      start =
        (masterMode ? sceneOffset({ ...project, workflow }, id) : 0) +
        (segment?.start ?? 0),
      initialDuration =
        segment?.duration ?? scene.visualDuration ?? scene.duration;
    let duration = initialDuration;
    state.setPlaying(false);
    trimCleanup.current = startTimelineDrag(event, {
      extraScroll:
        (Math.max(0, 600 - totalDuration(project)) * bounds.width) /
        playbackDuration,
      onMove: (movement) => {
        duration = Math.max(
          0.1,
          initialDuration + (movement.deltaX / bounds.width) * playbackDuration,
        );
        let snap: number | null = null;
        if (snapping && !movement.altKey) {
          const targets = [0, playbackDuration, state.time, ...project.markers];
          if (masterMode)
            for (const item of workflow.scenes) {
              const edge = sceneOffset({ ...project, workflow }, item.id);
              if (item.id !== id)
                targets.push(
                  edge,
                  edge + (item.visualDuration ?? item.duration),
                );
            }
          for (const clip of project.audio ?? []) {
            if (!masterMode && clip.sceneId && clip.sceneId !== id) continue;
            const offset =
              masterMode && clip.sceneId
                ? sceneOffset(project, clip.sceneId)
                : 0;
            targets.push(
              clip.start + offset,
              clip.start + offset + clip.length,
            );
          }
          let distance = (8 / bounds.width) * playbackDuration;
          for (const point of targets)
            if (
              point - start >= 0.1 &&
              Math.abs(point - start - duration) <= distance
            ) {
              distance = Math.abs(point - start - duration);
              snap = point;
            }
          if (snap !== null) duration = snap - start;
        }
        const patch = resizeVisual(project, id, duration, segmentId);
        setSnapTime(snap);
        setVisualDraft(patch);
      },
      onEnd: (apply) => {
        trimCleanup.current = null;
        if (apply && duration !== initialDuration) {
          const current = useStudio.getState();
          if (
            current.revision !== revision ||
            current.session !== state.session
          ) {
            notify("Project changed while trimming. Try again.");
          } else {
            state.change(
              resizeVisual(project, id, duration, segmentId),
              "Resize visual clip",
            );
          }
        }
        setVisualDraft(null);
        setSnapTime(null);
      },
    });
  };
  const resizeVisualKey = (
    event: React.KeyboardEvent<HTMLElement>,
    id: string,
    segmentId?: string,
  ) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const state = useStudio.getState();
    const scene = (
      state.project.workflow ?? initialWorkflow(state.project)
    ).scenes.find((item) => item.id === id);
    if (!scene || scene.locked) return;
    const segment = scene.visualContinuations?.find(
      (item) => item.id === segmentId,
    );
    const length = segment?.duration ?? scene.visualDuration ?? scene.duration;
    const delta =
      (event.key === "ArrowLeft" ? -1 : 1) *
      (event.shiftKey ? 1 : 1 / state.project.settings.fps);
    state.setPlaying(false);
    state.change(
      resizeVisual(state.project, id, length + delta, segmentId),
      "Resize visual clip",
    );
  };
  const split = () => {
    const state = useStudio.getState(),
      project = state.project;
    try {
      if (state.selectedText) {
        if (masterMode || selectedScene(project)?.locked)
          throw Error("Select an unlocked timeline to split text.");
        const origin = selectedScene(project)?.sourceOffset ?? 0;
        state.change(
          {
            html: splitTextLayer(
              project.html,
              state.selectedText,
              state.time + origin,
            ),
          },
          "Split text clip",
        );
      } else if (selection?.kind === "audio") {
        const clip = project.audio?.find((item) => item.id === selection.id);
        if (!clip) return;
        if (
          project.workflow?.scenes.find((item) => item.id === clip.sceneId)
            ?.locked
        )
          throw Error("Unlock this timeline before splitting.");
        const offset =
          masterMode && clip.sceneId
            ? sceneOffset(project, clip.sceneId)
            : !masterMode && !clip.sceneId && project.workflow
              ? -sceneOffset(project, project.workflow.selectedId)
              : 0;
        const cut = state.time - offset - clip.start;
        if (cut < 0.01 || clip.length - cut < 0.01)
          throw Error("Place the playhead inside the selected audio clip.");
        const right = {
          ...clip,
          id: crypto.randomUUID(),
          start: clip.start + cut,
          trimIn: clip.loop
            ? (clip.trimIn + cut) % clip.duration
            : clip.trimIn + cut,
          length: clip.length - cut,
        };
        state.change(
          {
            audio: project.audio!.flatMap((item) =>
              item.id === clip.id ? [{ ...clip, length: cut }, right] : [item],
            ),
          },
          "Split audio clip",
        );
      } else {
        const workflow = project.workflow ?? initialWorkflow(project);
        const scene = masterMode
          ? workflow.scenes.find(
              (item) =>
                state.time >= sceneOffset({ ...project, workflow }, item.id) &&
                state.time <
                  sceneOffset({ ...project, workflow }, item.id) +
                    item.duration,
            )
          : workflow.scenes.find((item) => item.id === workflow.selectedId);
        if (!scene) throw Error("Place the playhead inside a visual clip.");
        state.change(
          splitVisual(
            project,
            scene.id,
            state.time -
              (masterMode
                ? sceneOffset({ ...project, workflow }, scene.id)
                : 0),
          ),
          "Split visual clip",
        );
      }

      state.setPlaying(false);
    } catch (error) {
      notify((error as Error).message);
    }
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const [boxSelection, setBoxSelection] = useState<
    { kind: string; id: string; sceneId: string }[]
  >([]);
  const [selectionBox, setSelectionBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const clearBox = () => {
    setBoxSelection([]);
    timelineRef.current
      ?.querySelectorAll("[data-box-selected]")
      .forEach((node) => node.removeAttribute("data-box-selected"));
  };
  const beginBox = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget,
      x = event.clientX,
      y = event.clientY;
    clearBox();
    setSelection(null);
    useStudio.getState().setSelectedText(null);
    useStudio.getState().setPlaying(false);
    target.setPointerCapture(event.pointerId);
    let moved = false;
    const move = (e: PointerEvent) => {
      if (Math.abs(e.clientX - x) + Math.abs(e.clientY - y) < 5) return;
      moved = true;
      const box = {
        left: Math.min(x, e.clientX),
        top: Math.min(y, e.clientY),
        width: Math.abs(e.clientX - x),
        height: Math.abs(e.clientY - y),
      };
      setSelectionBox(box);
      const selected: typeof boxSelection = [];
      for (const node of timelineRef.current?.querySelectorAll<HTMLElement>(
        "[data-timeline-kind]",
      ) ?? []) {
        const bounds = node.getBoundingClientRect();
        const hit =
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.right > box.left &&
          bounds.left < box.left + box.width &&
          bounds.bottom > box.top &&
          bounds.top < box.top + box.height;
        if (hit) {
          node.dataset.boxSelected = "true";
          selected.push({
            kind: node.dataset.timelineKind!,
            id: node.dataset.timelineId!,
            sceneId: node.dataset.timelineScene ?? "",
          });
        } else node.removeAttribute("data-box-selected");
      }
      setBoxSelection(selected);
    };
    const end = (e: PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      target.removeEventListener("lostpointercapture", end);
      setSelectionBox(null);
      if (e.type !== "pointerup") clearBox();
      else if (!moved) {
        const bounds = rulerRef.current?.getBoundingClientRect();
        if (bounds)
          useStudio
            .getState()
            .setTime(
              Math.max(
                0,
                Math.min(
                  playbackDuration,
                  ((e.clientX - bounds.left) / bounds.width) * playbackDuration,
                ),
              ),
            );
      }
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
    target.addEventListener("lostpointercapture", end);
  };
  const deleteBox = () => {
    const state = useStudio.getState(),
      project = state.project;
    const audioIds = new Set(
      boxSelection
        .filter((item) => item.kind === "audio")
        .map((item) => item.id),
    );
    const sceneIds = new Set(
      boxSelection
        .filter((item) => item.kind === "scene")
        .map((item) => item.id),
    );
    const text = boxSelection.filter((item) => item.kind === "text");
    const removeText = (html: string, sceneId: string) => {
      for (const layer of readTextLayers(html))
        if (
          text.some(
            (item) =>
              item.id === layer.id &&
              (!item.sceneId || item.sceneId === sceneId),
          )
        )
          html = writeTextLayer(html, layer, true);
      return html;
    };
    let patch: Partial<typeof project> = {};
    const removedScenes = new Set<string>();
    if (project.workflow) {
      const workflow = project.workflow;
      for (const scene of workflow.scenes)
        if (!scene.locked && sceneIds.has(scene.id))
          removedScenes.add(scene.id);
      let scenes = workflow.scenes
        .filter((scene) => !removedScenes.has(scene.id))
        .map((scene) =>
          scene.locked
            ? scene
            : { ...scene, html: removeText(scene.html, scene.id) },
        );
      if (!scenes.length)
        scenes = [
          {
            ...workflow.scenes[0],
            title: "Empty scene",
            html: "",
            css: "",
            js: "",
            narration: "",
            visual: "",
            template: "custom",
          },
        ];
      const next = {
        ...workflow,
        scenes,
        selectedId: scenes.some((scene) => scene.id === workflow.selectedId)
          ? workflow.selectedId
          : scenes[0].id,
      };
      patch = {
        ...activateScene({ ...project, workflow: next }, next.selectedId),
        workflow: next,
      };
    } else
      patch = sceneIds.size
        ? { html: "", css: "", js: "" }
        : { html: removeText(project.html, "") };
    patch.audio = project.audio?.filter((clip) => {
      const locked = project.workflow?.scenes.find(
        (scene) => scene.id === clip.sceneId,
      )?.locked;
      return (
        locked ||
        (!audioIds.has(clip.id) && !removedScenes.has(clip.sceneId ?? ""))
      );
    });
    state.change(patch, "Delete selected timeline clips");
    state.setPlaying(false);
    clearBox();
  };
  const timelineRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const scrubCleanup = useRef<(() => void) | null>(null);
  const zoomAnchor = useRef<{ fraction: number; x: number } | null>(null);
  const actualDuration = masterMode ? totalDuration(p) : p.settings.duration;
  const playbackDuration = Math.max(
    actualDuration,
    masterMode
      ? totalDuration(timelineProject)
      : timelineProject.settings.duration,
  );
  const pixelsPerSecond =
    (Math.max(240, actualDuration * 40) * timelineZoom) / actualDuration;
  const changeZoom = (value: number | ((zoom: number) => number)) => {
    const viewport = scrollRef.current,
      canvas = canvasRef.current;
    if (viewport && canvas) {
      const fraction = Math.max(
        0,
        Math.min(1, useStudio.getState().time / playbackDuration),
      );
      const x =
        96 +
        (canvas.getBoundingClientRect().width - 96) * fraction -
        viewport.scrollLeft;
      zoomAnchor.current = {
        fraction,
        x: x >= 96 && x <= viewport.clientWidth ? x : viewport.clientWidth / 2,
      };
    }
    setTimelineZoom((zoom) => Math.max(0.25, Math.min(32, typeof value === "function" ? value(zoom) : value)));
  };
  const stepZoom = (direction: number) =>
    changeZoom((zoom) =>
      direction > 0
        ? (timelineZoomLevels.find((level) => level > zoom) ?? 32)
        : ([...timelineZoomLevels]
            .reverse()
            .find((level) => level < zoom) ?? 0.25),
    );
  const deleteText = () => {
    const state = useStudio.getState();
    if (!state.selectedText) return false;
    const layer = readTextLayers(state.project.html).find(
      (item) => item.id === state.selectedText,
    );
    if (!layer) {
      state.setSelectedText(null);
      return false;
    }
    if (masterMode || selectedScene(state.project)?.locked) {
      notify("Select an unlocked timeline to delete text.");
      return true;
    }
    state.setPlaying(false);
    state.change(
      { html: writeTextLayer(state.project.html, layer, true) },
      "Delete text clip",
    );
    state.setSelectedText(null);
    setSelection(null);

    return true;
  };
  const toggleSnapping = () => {
    setSnapping((value) => !value);
    setSnapTime(null);
  };
  useImperativeHandle(actionsRef, () => ({
    split,
    deleteText,
    toggleSnapping,
  }));
  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || timelineHidden) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.deltaY) return;
      stepZoom(event.deltaY < 0 ? 1 : -1);
    };
    timeline.addEventListener("wheel", wheel, { passive: false });
    return () => timeline.removeEventListener("wheel", wheel);
  }, [playbackDuration, timelineHidden, timelineZoom]);
  const beginScrub = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    scrubCleanup.current?.();
    const target = event.currentTarget;
    const seek = (clientX: number, bypass: boolean) => {
      const bounds = rulerRef.current?.getBoundingClientRect();
      if (!bounds?.width) return;
      const state = useStudio.getState(),
        project = state.project;
      let time = Math.max(
        0,
        Math.min(
          playbackDuration,
          ((clientX - bounds.left) / bounds.width) * playbackDuration,
        ),
      );
      let snapped: number | null = null;
      if (snapping && !bypass) {
        const offset =
          !masterMode && project.workflow
            ? sceneOffset(project, project.workflow.selectedId)
            : 0;
        const targets = [0, playbackDuration, ...project.markers];
        if (masterMode) {
          let boundary = 0;
          for (const scene of project.workflow?.scenes ?? []) {
            boundary += scene.duration;
            targets.push(boundary);
          }
        }
        for (const clip of project.audio ?? []) {
          if (
            !masterMode &&
            clip.sceneId &&
            clip.sceneId !== project.workflow?.selectedId
          )
            continue;
          const start =
            clip.start +
            (clip.sceneId ? sceneOffset(project, clip.sceneId) : 0) -
            offset;
          targets.push(start, start + clip.length);
        }
        let distance = (playbackDuration * 8) / bounds.width;
        for (const target of targets) {
          const delta = Math.abs(target - time);
          if (target >= 0 && target <= playbackDuration && delta <= distance) {
            distance = delta;
            snapped = target;
          }
        }
        if (snapped !== null) time = snapped;
      }
      setSnapTime(snapped);
      state.setTime(time);
    };
    useStudio.getState().setPlaying(false);
    target.setPointerCapture(event.pointerId);
    seek(event.clientX, event.altKey);
    const move = (e: PointerEvent) => seek(e.clientX, e.altKey);
    const end = (e: PointerEvent) => {
      if (e.type === "pointerup") seek(e.clientX, e.altKey);
      cleanup();
    };
    const cleanup = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      target.removeEventListener("lostpointercapture", end);
      scrubCleanup.current = null;
      setSnapTime(null);
    };
    scrubCleanup.current = cleanup;
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
    target.addEventListener("lostpointercapture", end);
  };
  useEffect(() => () => scrubCleanup.current?.(), []);
  useLayoutEffect(() => {
    const anchor = zoomAnchor.current,
      viewport = scrollRef.current,
      canvas = canvasRef.current;
    if (anchor && viewport && canvas)
      viewport.scrollLeft =
        96 +
        (canvas.getBoundingClientRect().width - 96) * anchor.fraction -
        anchor.x;
    zoomAnchor.current = null;
  }, [timelineZoom]);
  const settings = (patch: Partial<typeof p.settings>) =>
    s.change({ settings: { ...p.settings, ...patch } }, "Project settings");
  useEffect(() => {
    if (!playing) return;
    let id: number,
      last = performance.now();
    const tick = (now: number) => {
      if (!useStudio.getState().playing) return;
      const state = useStudio.getState(),
        duration = masterMode
          ? totalDuration(state.project)
          : state.project.settings.duration;
      let t = state.time + ((now - last) / 1000) * state.project.settings.speed;
      last = now;
      if (t >= duration) {
        if (state.project.settings.loop) t %= duration;
        else {
          t = duration;
          state.setPlaying(false);
        }
      }
      state.setTime(t);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, masterMode]);
  return (
    <section
      className="timeline"
      ref={timelineRef}
      tabIndex={-1}
      aria-label="Timeline"
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes(typographyDragType) ||
          event.dataTransfer.types.includes(audioDragType)
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        const audioId = event.dataTransfer.getData(audioDragType);
        if (audioId) {
          event.preventDefault();
          event.stopPropagation();
          try {
            const state = useStudio.getState(),
              project = state.project;
            const source = project.audioLibrary?.find(
              (item) => item.id === audioId,
            );
            const bounds = rulerRef.current?.getBoundingClientRect();
            if (!source || !bounds?.width) return;
            if ((project.audio?.length ?? 0) >= 60)
              throw Error("The timeline supports at most 60 audio clips.");
            let time = Math.max(
              0,
              Math.min(
                playbackDuration - 0.01,
                ((event.clientX - bounds.left) / bounds.width) *
                  playbackDuration,
              ),
            );
            if (snapping && !event.altKey)
              for (const point of [0, state.time, ...project.markers])
                if (
                  point < playbackDuration &&
                  Math.abs(time - point) < (playbackDuration * 8) / bounds.width
                )
                  time = point;
            const workflow = project.workflow ?? initialWorkflow(project);
            const scene = masterMode
              ? workflow.scenes.find(
                  (item) =>
                    time >= sceneOffset({ ...project, workflow }, item.id) &&
                    time <
                      sceneOffset({ ...project, workflow }, item.id) +
                        item.duration,
                )
              : workflow.scenes.find((item) => item.id === workflow.selectedId);
            if (!scene || scene.locked)
              throw Error("Select an unlocked timeline to add audio.");
            const start =
              time -
              (masterMode
                ? sceneOffset({ ...project, workflow }, scene.id)
                : 0);
            const targetLane = (event.target as HTMLElement)
              .closest("[data-audio-lane]")
              ?.getAttribute("data-audio-lane");
            const lane =
              targetLane === "voice" ||
              targetLane === "sfx" ||
              targetLane === "music"
                ? targetLane
                : source.lane;
            const clip = {
              ...clipFromAudio(source, lane, scene.id),
              sourceId: source.id,
              generatedSource: undefined,
              license: source.license,
              start,
              length: Math.min(
                scene.duration - start,
                lane === "music" ? scene.duration : source.duration,
              ),
            };
            state.change(
              { workflow, audio: [...(project.audio ?? []), clip] },
              "Drop library audio onto timeline",
            );
            state.setPlaying(false);
            state.setSelectedText(null);
            setSelection({ kind: "audio", id: clip.id });
            onSelectAudio?.(clip.id);
          } catch (error) {
            notify((error as Error).message);
          }
          return;
        }
        const payload = event.dataTransfer.getData(typographyDragType);
        if (!payload) return;
        event.preventDefault();
        event.stopPropagation();
        try {
          const bounds = rulerRef.current?.getBoundingClientRect();
          if (!bounds?.width) return;
          const state = useStudio.getState(),
            project = state.project;
          const time = Math.max(
            0,
            Math.min(
              playbackDuration - 0.01,
              ((event.clientX - bounds.left) / bounds.width) * playbackDuration,
            ),
          );
          const scene =
            masterMode && project.workflow
              ? project.workflow.scenes.find(
                  (scene) =>
                    time >= sceneOffset(project, scene.id) &&
                    time < sceneOffset(project, scene.id) + scene.duration,
                )
              : selectedScene(project);
          if (scene?.locked)
            throw Error("Unlock this timeline before adding text.");
          const sceneStart =
            masterMode && scene ? sceneOffset(project, scene.id) : 0;
          const localStart = time - sceneStart;
          const origin = scene?.sourceOffset ?? 0;
          const layer = textLayerSchema.parse({
            ...JSON.parse(payload),
            id: "text-" + crypto.randomUUID(),
            start: origin + localStart,
            end:
              origin +
              Math.min(
                scene?.duration ?? project.settings.duration,
                localStart + 3,
              ),
            motionStart: origin + localStart,
          });
          const html = writeTextLayer(scene?.html ?? project.html, layer);
          if (scene && project.workflow)
            state.change(
              {
                workflow: {
                  ...project.workflow,
                  scenes: project.workflow.scenes.map((item) =>
                    item.id === scene.id ? { ...item, html } : item,
                  ),
                },
                ...(scene.id === project.workflow.selectedId ? { html } : {}),
              },
              "Drop text onto timeline",
            );
          else state.change({ html }, "Drop text onto timeline");
          state.setPlaying(false);

          onSelectText?.(scene?.id, layer.id);
          state.setTime(
            Math.max(
              0,
              Math.min(layer.end - 0.001, layer.start + layer.entrance) -
                origin,
            ),
          );
        } catch (error) {
          notify((error as Error).message);
        }
      }}
      onPointerDownCapture={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "button,input,select,textarea,[data-timeline-kind]",
          )
        )
          clearBox();
        if (
          !(event.target as HTMLElement).closest(
            "input, select, textarea, [contenteditable=true]",
          )
        )
          event.currentTarget.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).closest(
            "input, select, textarea, [contenteditable=true]",
          )
        )
          return;
        const state = useStudio.getState();
        if (
          boxSelection.length &&
          !event.repeat &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          ["Delete", "Backspace"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          deleteBox();
          return;
        }
        if (
          !event.repeat &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          ["Delete", "Backspace"].includes(event.key) &&
          state.selectedText
        ) {
          event.preventDefault();
          event.stopPropagation();
          deleteText();
          return;
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "z"
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (event.shiftKey) state.redo();
          else state.undo();
          return;
        }
        if (
          !selection ||
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          !["Delete", "Backspace"].includes(event.key)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus({ preventScroll: true });
        const project = state.project;
        if (selection.kind === "audio") {
          if (!project.audio?.some((clip) => clip.id === selection.id)) return;
          state.change(
            { audio: project.audio.filter((clip) => clip.id !== selection.id) },
            "Delete timeline audio",
          );
        } else if (selection.kind === "continuation") {
          const workflow = project.workflow;
          const scene = workflow?.scenes.find(
            (item) => item.id === selection.id,
          );
          if (!workflow || !scene || scene.locked) return;
          state.change(
            {
              workflow: {
                ...workflow,
                scenes: workflow.scenes.map((item) =>
                  item.id === scene.id
                    ? {
                        ...item,
                        visualContinuations: item.visualContinuations?.filter(
                          (segment) => segment.id !== selection.segmentId,
                        ),
                      }
                    : item,
                ),
              },
            },
            "Delete visual continuation",
          );
        } else {
          const workflow = project.workflow;
          const scene = workflow?.scenes.find(
            (scene) => scene.id === selection.id,
          );
          if (!workflow || !scene || scene.locked) return;
          // Keep a valid editable canvas when the final visual is removed.
          const scenes =
            workflow.scenes.length === 1
              ? [
                  {
                    ...scene,
                    title: "Empty scene",
                    narration: "",
                    visual: "",
                    html: "",
                    css: "",
                    js: "",
                    template: "custom",
                  },
                ]
              : workflow.scenes.filter((scene) => scene.id !== selection.id);
          const next = {
            ...workflow,
            scenes,
            selectedId:
              workflow.selectedId === selection.id
                ? scenes[0].id
                : workflow.selectedId,
          };
          state.change(
            {
              ...activateScene({ ...project, workflow: next }, next.selectedId),
              workflow: next,
              audio: project.audio?.filter(
                (clip) => clip.sceneId !== selection.id,
              ),
            },
            "Delete timeline scene",
          );
        }
        state.setPlaying(false);
        state.setTime(
          Math.min(
            state.time,
            masterMode
              ? totalDuration(useStudio.getState().project)
              : useStudio.getState().project.settings.duration,
          ),
        );
        setSelection(null);
      }}
      style={{
        height: timelineHidden ? 44 : timelineHeight,
        overflow: "hidden",
      }}
    >
      {" "}
      <div className="timeline-top">
        <button
          className="section-label"
          title="Collapse or expand timeline"
          onClick={() => setTimelineHidden(!timelineHidden)}
        >
          TIMELINE {timelineHidden ? "▴" : "▾"}
        </button>
        <span className="timing-badge">
          {p.settings.timing === "seek" ? "SEEK MODE" : "REPLAY EXPORT"}
        </span>
        <span className="toolbar-spacer" />
        {selection?.kind === "scene" &&
          onStructuredEdit &&
          p.workflow?.scenes.some(
            (scene) => scene.id === selection.id && scene.structuredEdit,
          ) && (
            <>
              <button onClick={() => onStructuredEdit(selection.id)}>
                Edit / Update
              </button>
              {onStructuredExtend && (
                <button
                  className="timeline-extend"
                  title="Continue the selected visual"
                  onClick={() => onStructuredExtend(selection.id)}
                >
                  <ArrowRightFromLine size={14} aria-hidden="true" />
                  Extend
                </button>
              )}
            </>
          )}
        {selection &&
          selection.kind !== "audio" &&
          onCodeExtend &&
          continuationSource(p, selection.id, selection.segmentId) && (
            <button
              className="timeline-extend"
              title="Continue the selected visual"
              onClick={() => onCodeExtend(selection.id, selection.segmentId)}
            >
              <ArrowRightFromLine size={14} aria-hidden="true" />
              Extend
            </button>
          )}
        <button
          title={splitHint ?? "Split at playhead"}
          aria-label="Split at playhead"
          onClick={split}
        >
          <Scissors size={16} />
        </button>
        <button
          title="Snapping · hold Alt while dragging to bypass"
          aria-label="Timeline snapping"
          aria-pressed={snapping}
          onClick={toggleSnapping}
        >
          <Magnet size={16} />
        </button>
        <div
          className="timeline-zoom"
          role="group"
          aria-label="Timeline zoom controls"
        >
          <button
            type="button"
            aria-label="Zoom out timeline"
            title="Zoom out timeline"
            disabled={timelineZoom <= 0.25}
            onClick={() => stepZoom(-1)}
          >
            <Minus size={14} />
          </button>
          <input
            aria-label="Timeline zoom"
            type="range"
            min="0.25"
            max="32"
            step=".25"
            value={timelineZoom}
            onChange={(e) => changeZoom(Number(e.target.value))}
          />
          <button
            type="button"
            aria-label="Zoom in timeline"
            title="Zoom in timeline"
            disabled={timelineZoom >= 32}
            onClick={() => stepZoom(1)}
          >
            <Plus size={14} />
          </button>
          <output aria-label="Timeline zoom level">{timelineZoom}×</output>
        </div>
        <button
          title="Add timeline marker"
          aria-label="Add timeline marker"
          onClick={() =>
            s.change(
              {
                markers: [...p.markers, useStudio.getState().time].sort(
                  (a, b) => a - b,
                ),
              },
              "Add marker",
            )
          }
        >
          <Plus size={16} />
        </button>
        <select
          aria-label="Playback speed"
          value={p.settings.speed}
          onChange={(e) => settings({ speed: Number(e.target.value) })}
        >
          {[
            0.25,
            0.5,
            0.75,
            1,
            1.25,
            1.5,
            2,
            3,
            4,
            ...(![0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].includes(
              p.settings.speed,
            )
              ? [p.settings.speed]
              : []),
          ].map((x) => (
            <option key={x} value={x}>
              {x}×
            </option>
          ))}
        </select>
        <select
          aria-label="Frame rate"
          value={p.settings.fps}
          onChange={(e) => settings({ fps: Number(e.target.value) })}
        >
          {[
            24,
            25,
            30,
            60,
            ...(![24, 25, 30, 60].includes(p.settings.fps)
              ? [p.settings.fps]
              : []),
          ].map((x) => (
            <option key={x} value={x}>
              {x} fps
            </option>
          ))}
        </select>
      </div>
      {navigation}
      <div
        className="timeline-track-scroll"
        ref={scrollRef}
        onScroll={(event) => {
          const viewport = event.currentTarget;
          viewport.style.setProperty(
            "--timeline-scroll-left",
            `${viewport.scrollLeft}px`,
          );
        }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) beginBox(event);
        }}
      >
        <div
          className="timeline-track-canvas"
          ref={canvasRef}
          style={{
            width:
              96 +
              (Math.max(240, actualDuration * 40) *
                timelineZoom *
                playbackDuration) /
                actualDuration,
          }}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (
              target.closest(
                "button, input, select, textarea, a, .video-track-label, .audio-lane-label",
              ) ||
              event.clientX <
                (rulerRef.current?.getBoundingClientRect().left ?? Infinity)
            )
              return;
            setSelection(null);
            beginBox(event);
          }}
        >
          <div className="ruler" ref={rulerRef} onPointerDown={beginScrub} style={{ clipPath: `inset(0 -${600 * pixelsPerSecond}px 0 var(--timeline-scroll-left, 0px))` }}>
            <TimelineRulerMarks
              duration={playbackDuration}
              pixelsPerSecond={pixelsPerSecond}
              fps={p.settings.fps}
              viewport={scrollRef}
            />
          </div>
          <div className="video-track-row">
            <span className="video-track-label">
              <Code2 size={14} />
              Visuals
            </span>
            <div className="track">
              <div
                data-timeline-kind={masterMode ? undefined : "scene"}
                data-timeline-id={p.workflow?.selectedId ?? "scene-1"}
                className={"track-clip " + (masterMode ? "master-clips" : "")}
                style={
                  !masterMode
                    ? {
                        width: `${((selectedScene(timelineProject)?.visualDuration ?? actualDuration) / playbackDuration) * 100}%`,
                      }
                    : undefined
                }
                onPointerDown={
                  !masterMode
                    ? (event) => {
                        event.stopPropagation();
                        const scene = selectedScene(
                          useStudio.getState().project,
                        );
                        if (scene)
                          setSelection({ kind: "scene", id: scene.id });
                      }
                    : undefined
                }
                onClick={
                  !masterMode
                    ? () => {
                        const scene = selectedScene(
                          useStudio.getState().project,
                        );
                        if (scene) {
                          useStudio.getState().setSelectedText(null);
                          setSelection({ kind: "scene", id: scene.id });
                          onSelectScene?.(scene.id);
                        }
                      }
                    : undefined
                }
              >
                {masterMode && p.workflow ? (
                  timelineProject
                    .workflow!.scenes.filter(
                      (scene) => scene.visualDuration !== 0,
                    )
                    .map((scene) => (
                      <button
                        onClick={() => {
                          useStudio.getState().setSelectedText(null);
                          setSelection({ kind: "scene", id: scene.id });
                          onSelectScene?.(scene.id);
                        }}
                        className={
                          "master-scene-clip " +
                          (scene.id === p.workflow?.selectedId
                            ? "selected"
                            : "")
                        }
                        data-timeline-kind="scene"
                        data-timeline-id={scene.id}
                        key={scene.id}
                        style={{
                          left: `${(sceneOffset(timelineProject, scene.id) / playbackDuration) * 100}%`,
                          width:
                            ((scene.visualDuration ?? scene.duration) /
                              playbackDuration) *
                              100 +
                            "%",
                        }}
                        title={
                          scene.title +
                          " · " +
                          (scene.visualDuration ?? scene.duration) +
                          "s"
                        }
                      >
                        <span className="scene-clip-caption">
                          {scene.title}
                          <small>
                            {(scene.visualDuration ?? scene.duration).toFixed(
                              1,
                            )}
                            s
                          </small>
                        </span>
                        <span className="scene-filmstrip" aria-hidden="true">
                          {(() => {
                            const asset = p.assets.find((asset) =>
                              [scene.html, scene.css, scene.js].some((source) =>
                                source.includes("asset://" + asset.id),
                              ),
                            );
                            return asset ? (
                              Array.from({ length: 8 }, (_, i) => (
                                <img
                                  key={i}
                                  src={asset.data}
                                  alt=""
                                  loading="lazy"
                                />
                              ))
                            ) : (
                              <Code2 size={19} />
                            );
                          })()}
                        </span>
                        {!scene.locked && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Trim end of visual ${scene.title}`}
                            className="visual-trim-end"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) =>
                              trimVisual(event, scene.id)
                            }
                            onKeyDown={(event) =>
                              resizeVisualKey(event, scene.id)
                            }
                          />
                        )}
                      </button>
                    ))
                ) : (
                  <>
                    <span>
                      <Code2 size={13} /> {selectedScene(p)?.title ?? p.name}
                    </span>
                    <div className="keyframe-dots">
                      {runtime?.animations?.map((_: any, i: number) => (
                        <i key={i} />
                      ))}
                    </div>
                    {!selectedScene(p)?.locked && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Trim end of visual clip"
                        className="visual-trim-end"
                        onPointerDown={(event) =>
                          trimVisual(event, p.workflow?.selectedId ?? "scene-1")
                        }
                        onKeyDown={(event) =>
                          resizeVisualKey(
                            event,
                            p.workflow?.selectedId ?? "scene-1",
                          )
                        }
                      />
                    )}
                  </>
                )}
              </div>
              {(masterMode
                ? (timelineProject.workflow?.scenes ?? [])
                : [selectedScene(timelineProject)]
              ).flatMap((scene) =>
                scene
                  ? (scene.visualContinuations ?? []).map((segment, index) => (
                      <button
                        className={`visual-continuation-clip ${selection?.segmentId === segment.id ? "selected" : ""}`}
                        aria-label={`Continuation ${index + 1}`}
                        key={segment.id}
                        style={{
                          left: `${((segment.start + (masterMode ? sceneOffset(timelineProject, scene.id) : 0)) / playbackDuration) * 100}%`,
                          width: `${(segment.duration / playbackDuration) * 100}%`,
                        }}
                        onClick={() => {
                          useStudio.getState().setSelectedText(null);
                          setSelection({
                            kind: "continuation",
                            id: scene.id,
                            segmentId: segment.id,
                          });
                        }}
                      >
                        <Code2 size={13} /> Continuation {index + 1}
                        {!scene.locked && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`Resize visual segment ${index + 1}`}
                            title="Drag to change duration · Arrow keys to adjust"
                            className="visual-trim-end"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) =>
                              trimVisual(event, scene.id, segment.id)
                            }
                            onKeyDown={(event) =>
                              resizeVisualKey(event, scene.id, segment.id)
                            }
                          />
                        )}
                      </button>
                    ))
                  : [],
              )}
              {p.markers.map((m, i) => (
                <button
                  key={i}
                  className="marker"
                  title={`Marker ${m.toFixed(2)}s · click to remove`}
                  style={{ left: (m / playbackDuration) * 100 + "%" }}
                  onClick={() =>
                    s.change(
                      { markers: p.markers.filter((_, j) => i !== j) },
                      "Remove marker",
                    )
                  }
                />
              ))}
              <TimelineScrubber
                duration={playbackDuration}
                fps={p.settings.fps}
              />
            </div>
          </div>
          <TextTimeline
            master={masterMode}
            duration={playbackDuration}
            snapping={snapping}
            onSnap={setSnapTime}
            onSelect={(sceneId, textId) => onSelectText?.(sceneId, textId)}
          />
          <AudioTimeline
            snapping={snapping}
            onSnap={setSnapTime}
            master={masterMode}
            duration={playbackDuration}
            onSelect={(id) => {
              useStudio.getState().setSelectedText(null);
              setSelection({ kind: "audio", id });
              onSelectAudio?.(id);
            }}
            selected={selectedAudio}
          />
          <div className="timeline-guides">
            <TimelineCursor
              duration={playbackDuration}
              onPointerDown={beginScrub}
            />
            {snapTime !== null && (
              <div
                className="timeline-snap-guide"
                aria-label={`Snap at ${snapTime.toFixed(2)} seconds`}
                style={{
                  left: `calc(${(snapTime / playbackDuration) * 100}% + ${96 * (1 - snapTime / playbackDuration)}px)`,
                }}
              />
            )}
          </div>
        </div>
      </div>
      {selectionBox && (
        <div className="timeline-selection-box" style={selectionBox} />
      )}
    </section>
  );
});

const TimelineScrubber = memo(function TimelineScrubber({
  duration,
  fps,
}: {
  duration: number;
  fps: number;
}) {
  const time = useStudio((state) => state.time);
  return (
    <input
      aria-label="Timeline position"
      className="scrubber"
      type="range"
      min={0}
      max={duration}
      step={1 / fps}
      value={time}
      onChange={(e) => {
        useStudio.getState().setPlaying(false);
        useStudio.getState().setTime(Number(e.target.value));
      }}
    />
  );
});
const TimelineCursor = memo(function TimelineCursor({
  duration,
  onPointerDown,
}: {
  duration: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const time = useStudio((state) => state.time);
  const fraction = Math.max(0, Math.min(1, time / duration));
  return (
    <div
      className="timeline-cursor"
      aria-hidden="true"
      onPointerDown={onPointerDown}
      style={{ left: `calc(${fraction * 100}% + ${96 * (1 - fraction)}px)` }}
    />
  );
});
