import { useEffect, useRef, useMemo } from "react";
import type { Project, AudioClip } from "../shared/project";
import { sceneOffset } from "../shared/workflow";
import { useStudio } from "./store";
import { speechRanges, musicDuckGain } from "../shared/audio-ducking";
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
  const sources = useRef(new Map<string, string>());
  const audioContext = useRef<AudioContext | null>(null);
  const gains = useRef(
    new Map<string, { source: MediaElementAudioSourceNode; gain: GainNode }>(),
  );
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
        sources.current.delete(id);
        gains.current.get(id)?.source.disconnect();
        gains.current.get(id)?.gain.disconnect();
        gains.current.delete(id);
        blocked.current.delete(id);
      }
    return undefined;
  }, [project.audio]);
  const voiceActivity = useMemo(() => speechRanges(
      project,
      (project.audio ?? []).filter(
        (a) =>
          master || !a.sceneId || a.sceneId === project.workflow?.selectedId,
      ),
    ), [project.audio, project.workflow, master]);
  useEffect(() => {
    if (!playing) blocked.current.clear();
    for (const clip of project.audio ?? []) {
      let node = nodes.current.get(clip.id);
      if (!node) {
        node = new Audio(clip.data);
        node.preload = "auto";
        nodes.current.set(clip.id, node);
        sources.current.set(clip.id, clip.data);
      } else if (sources.current.get(clip.id) !== clip.data) {
        node.pause();
        node.src = clip.data;
        sources.current.set(clip.id, clip.data);
        blocked.current.delete(clip.id);
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
      const volume =
        clip.volume *
        envelope *
        (clip.lane === "music" ? musicDuckGain(voiceActivity, globalTime) : 1);
      if (clip.volume > 1 && !gains.current.has(clip.id)) {
        try {
          const context = (audioContext.current ??= new AudioContext());
          const source = context.createMediaElementSource(node);
          const gain = context.createGain();
          source.connect(gain);
          gain.connect(context.destination);
          gains.current.set(clip.id, { source, gain });
        } catch {
          onError("Audio amplification is unavailable in this browser.");
        }
      }
      const graph = gains.current.get(clip.id);
      node.volume = graph ? 1 : Math.min(1, volume);
      if (graph) graph.gain.gain.value = volume;
      if (playing && audioContext.current?.state === "suspended")
        void audioContext.current.resume().catch(() => {});
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
      sources.current.clear();
      for (const { source, gain } of gains.current.values()) {
        source.disconnect();
        gain.disconnect();
      }
      gains.current.clear();
      void audioContext.current?.close().catch(() => {});
      audioContext.current = null;
    },
    [],
  );
  return null;
}
