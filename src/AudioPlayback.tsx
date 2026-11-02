import { useEffect, useRef } from "react";
import type { Project, AudioClip } from "../shared/project";
import { sceneOffset } from "../shared/workflow";
import { useStudio } from "./store";
export function AudioPlayback({
  project,
  master,
  onError,
}: {
  project: Project;
  master: boolean;
  onError: (message: string) => void;
}) {
  const time = useStudio((s) => s.time);
  const playing = useStudio((s) => s.playing);
  const nodes = useRef(new Map<string, HTMLAudioElement>());
  const blocked = useRef(new Set<string>());
  const globalTime =
    time +
    (master
      ? 0
      : project.workflow
        ? sceneOffset(project, project.workflow.selectedId)
        : 0);
  useEffect(() => {
    const ids = new Set(project.audio?.map((a) => a.id));
    for (const [id, node] of nodes.current)
      if (!ids.has(id)) {
        node.pause();
        node.src = "";
        nodes.current.delete(id);
      }
    return undefined;
  }, [project.audio]);
  useEffect(() => {
    if (!playing) blocked.current.clear();
    const voiceActive = project.audio?.some(
      (a) =>
        a.lane === "voice" &&
        !a.muted &&
        globalTime >=
          a.start + (a.sceneId ? sceneOffset(project, a.sceneId) : 0) &&
        globalTime <
          a.start +
            (a.sceneId ? sceneOffset(project, a.sceneId) : 0) +
            a.length,
    );
    for (const clip of project.audio ?? []) {
      let node = nodes.current.get(clip.id);
      if (!node) {
        node = new Audio(clip.data);
        node.preload = "auto";
        nodes.current.set(clip.id, node);
      }
      const start =
          clip.start + (clip.sceneId ? sceneOffset(project, clip.sceneId) : 0),
        local = globalTime - start;
      const relevant =
        master ||
        !clip.sceneId ||
        clip.sceneId === project.workflow?.selectedId;
      const active =
        relevant && !clip.muted && local >= 0 && local < clip.length;
      const target =
        clip.trimIn +
        (clip.loop
          ? local % Math.max(0.01, clip.duration - clip.trimIn)
          : local);
      const playable = active && (clip.loop || target < clip.duration);
      if (!playable) {
        node.pause();
        continue;
      }
      const envelope = Math.max(
        0,
        Math.min(
          1,
          clip.fadeIn ? local / clip.fadeIn : 1,
          clip.fadeOut ? (clip.length - local) / clip.fadeOut : 1,
        ),
      );
      node.volume = Math.min(
        1,
        clip.volume *
          envelope *
          (voiceActive && clip.lane === "music" ? 0.35 : 1),
      );
      node.playbackRate = Math.min(
        16,
        Math.max(0.0625, project.settings.speed),
      );
      node.preservesPitch = true;
      if (Math.abs(node.currentTime - target) > (playing ? 0.15 : 0.02))
        try {
          node.currentTime = Math.max(0, target);
        } catch {}
      if (playing && node.paused && !blocked.current.has(clip.id))
        void node.play().catch(() => {
          blocked.current.add(clip.id);
          onError(
            "Audio playback was blocked. Click Play again to allow browser audio.",
          );
        });
      if (!playing) node.pause();
    }
  }, [project.audio, globalTime, playing, master, project.settings.speed]);
  useEffect(
    () => () => {
      for (const node of nodes.current.values()) {
        node.pause();
        node.src = "";
      }
      nodes.current.clear();
    },
    [],
  );
  return null;
}
