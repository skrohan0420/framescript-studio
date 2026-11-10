import { useStatusNotice } from "./editor-status";
import { memo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useProjectState, useStudio } from "./store";
import { sceneOffset } from "../shared/workflow";
import {
  editAudioClip,
  audioTimelineRows,
  snapAudioEdit,
  type AudioEdit,
} from "../shared/audio-edit";
import type { AudioClip } from "../shared/project";
import { AudioWaveform } from "./AudioWaveform";
import { Volume2, VolumeX } from "lucide-react";
import { ClipVolume } from "./ClipVolume";

export const AudioTimeline = memo(function AudioTimeline({
  master,
  duration,
  onSelect,
  selected,
  snapping = false,
  onSnap,
}: {
  master: boolean;
  duration: number;
  onSelect?: (id: string) => void;
  selected?: string;
  snapping?: boolean;
  onSnap?: (time: number | null) => void;
}) {
  const { project: p, change } = useProjectState();
  const [draft, setDraft] = useState<AudioClip | null>(null);
  const draftRef = useRef<AudioClip | null>(null);
  const activeGesture = useRef(false);
  const notify = useStatusNotice();
  const offset =
    !master && p.workflow ? sceneOffset(p, p.workflow.selectedId) : 0;
  const visible = (p.audio ?? []).filter(
    (clip) =>
      master || !clip.sceneId || clip.sceneId === p.workflow?.selectedId,
  );
  if (!visible.length) return null;
  const scope = (clip: AudioClip) =>
    clip.sceneId
      ? (p.workflow?.scenes.find((scene) => scene.id === clip.sceneId)
          ?.duration ?? duration)
      : (p.workflow?.scenes.reduce((n, s) => n + s.duration, 0) ?? duration);
  const commit = (clip: AudioClip, revision: number) => {
    const current = useStudio.getState();
    if (current.revision !== revision) {
      notify("Project changed during audio edit. Try again.");
      return;
    }
    change(
      {
        audio: current.project.audio?.map((a) => (a.id === clip.id ? clip : a)),
      },
      "Move / trim audio",
    );
    notify(
      `${clip.name}: starts at ${clip.start.toFixed(2)}s, length ${clip.length.toFixed(2)}s`,
    );
  };
  const drag = (
    event: PointerEvent<HTMLButtonElement>,
    clip: AudioClip,
    mode: AudioEdit,
  ) => {
    if (event.button !== 0 || activeGesture.current) return;
    onSelect?.(clip.id);
    event.preventDefault();
    const target = event.currentTarget,
      track = target.closest(".audio-edit-track")!;
    const width = track.getBoundingClientRect().width,
      startX = event.clientX;
    const revision = useStudio.getState().revision;
    const base = (clip.sceneId ? sceneOffset(p, clip.sceneId) : 0) - offset;
    const targets = [0, duration, useStudio.getState().time, ...p.markers];
    let boundary = -offset;
    for (const scene of p.workflow?.scenes ?? []) {
      targets.push(boundary);
      boundary += scene.duration;
      targets.push(boundary);
    }
    for (const other of visible) {
      if (other.id === clip.id) continue;
      const start =
        other.start +
        (other.sceneId ? sceneOffset(p, other.sceneId) : 0) -
        offset;
      targets.push(start, start + other.length);
    }
    activeGesture.current = true;
    useStudio.getState().setPlaying(false);
    target.setPointerCapture(event.pointerId);
    const move = (e: globalThis.PointerEvent) => {
      const delta = ((e.clientX - startX) / width) * duration;
      const result =
        snapping && !e.altKey
          ? snapAudioEdit(
              clip,
              delta,
              mode,
              scope(clip),
              targets
                .filter((time) => time >= 0 && time <= duration)
                .map((time) => time - base),
              (duration * 8) / width,
            )
          : {
              clip: editAudioClip(clip, delta, mode, scope(clip)),
              target: undefined,
            };
      const next = result.clip;
      onSnap?.(result.target === undefined ? null : result.target + base);
      draftRef.current = next;
      setDraft(next);
    };
    const end = (e: globalThis.PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      target.removeEventListener("lostpointercapture", end);
      activeGesture.current = false;
      if (e.type === "pointerup" && draftRef.current)
        commit(draftRef.current, revision);
      draftRef.current = null;
      setDraft(null);
      onSnap?.(null);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
    target.addEventListener("lostpointercapture", end);
  };
  return (
    <section className="audio-timeline" aria-label="Audio timeline">
      <p className="audio-timeline-help">
        Drag audio to move · drag edges to trim · focus a control and use arrow
        keys
      </p>
      {audioTimelineRows(
        visible.filter((clip) => {
          const start =
            clip.start +
            (clip.sceneId ? sceneOffset(p, clip.sceneId) : 0) -
            offset;
          return start < duration && start + clip.length > 0;
        }),
        (clip) =>
          clip.start +
          (clip.sceneId ? sceneOffset(p, clip.sceneId) : 0) -
          offset,
      ).map((row, rowIndex) => (
        <div
          className="audio-edit-row"
          data-audio-lane={row.lane}
          key={`${row.lane}-${rowIndex}`}
        >
          <span className="audio-lane-label audio-row-label">
            <span>
              {row.lane === "voice"
                ? "Voice"
                : row.lane === "music"
                  ? "BGM"
                  : "SFX"}
            </span>
            <button
              className={
                "audio-row-mute " +
                (row.clips.every((clip) => clip.muted) ? "accent" : "")
              }
              aria-label={`${row.clips.every((clip) => clip.muted) ? "Unmute" : "Mute"} ${row.lane} row ${rowIndex + 1}`}
              aria-pressed={row.clips.every((clip) => clip.muted)}
              title={
                row.clips.every((clip) => clip.muted)
                  ? "Unmute row"
                  : "Mute row"
              }
              disabled={row.clips.every(
                (clip) =>
                  p.workflow?.scenes.find((scene) => scene.id === clip.sceneId)
                    ?.locked,
              )}
              onClick={() => {
                const muted = !row.clips.every((clip) => clip.muted);
                const ids = new Set(
                  row.clips
                    .filter(
                      (clip) =>
                        !p.workflow?.scenes.find(
                          (scene) => scene.id === clip.sceneId,
                        )?.locked,
                    )
                    .map((clip) => clip.id),
                );
                change(
                  {
                    audio: p.audio?.map((clip) =>
                      ids.has(clip.id) ? { ...clip, muted } : clip,
                    ),
                  },
                  muted ? "Mute audio row" : "Unmute audio row",
                );
              }}
            >
              {row.clips.every((clip) => clip.muted) ? (
                <VolumeX size={13} />
              ) : (
                <Volume2 size={13} />
              )}
            </button>
            <div className="audio-row-volume">
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                aria-label={`${row.lane} row ${rowIndex + 1} volume`}
                title="Adjust volume for clips in this row"
                value={row.clips[0].volume}
                disabled={row.clips.every(
                  (clip) =>
                    p.workflow?.scenes.find(
                      (scene) => scene.id === clip.sceneId,
                    )?.locked,
                )}
                onChange={(event) => {
                  const volume = Number(event.target.value);
                  const ids = new Set(
                    row.clips
                      .filter(
                        (clip) =>
                          !p.workflow?.scenes.find(
                            (scene) => scene.id === clip.sceneId,
                          )?.locked,
                      )
                      .map((clip) => clip.id),
                  );
                  change(
                    {
                      audio: p.audio?.map((clip) =>
                        ids.has(clip.id) ? { ...clip, volume } : clip,
                      ),
                    },
                    "Adjust timeline audio volume",
                  );
                }}
              />
              <small>{Math.round(row.clips[0].volume * 100)}%</small>
            </div>
          </span>
          <div className="audio-edit-track">
            {row.clips.map((original) => {
              const clip = draft?.id === original.id ? draft : original;
              const start =
                clip.start +
                (clip.sceneId ? sceneOffset(p, clip.sceneId) : 0) -
                offset;
              if (start >= duration || start + clip.length <= 0) return null;
              const locked = !!p.workflow?.scenes.find(
                (s) => s.id === clip.sceneId,
              )?.locked;
              const controls = (mode: AudioEdit) => ({
                onClick: () => onSelect?.(original.id),
                disabled: locked,
                onPointerDown: (e: PointerEvent<HTMLButtonElement>) =>
                  drag(e, original, mode),
                onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const delta =
                    (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 0.1);
                  commit(
                    editAudioClip(original, delta, mode, scope(original)),
                    useStudio.getState().revision,
                  );
                },
              });
              return (
                <div
                  key={clip.id}
                  data-timeline-kind="audio"
                  data-timeline-id={clip.id}
                  className={`audio-edit-clip ${clip.lane} ${clip.muted ? "muted" : ""} ${selected === clip.id ? "selected" : ""}`}
                  style={{
                    left: (start / duration) * 100 + "%",
                    width: (clip.length / duration) * 100 + "%",
                  }}
                >
                  <button
                    className="audio-trim"
                    aria-label={`Trim start of ${clip.name}`}
                    {...controls("trim-start")}
                  />
                  <button
                    className="audio-move"
                    aria-label={`Move ${clip.name}`}
                    title={`${clip.name} · ${clip.length.toFixed(2)}s${locked ? " · locked" : ""}`}
                    {...controls("move")}
                  >
                    <AudioWaveform clip={clip} />
                    <span className="audio-clip-name">{clip.name}</span>
                  </button>
                  <button
                    className="audio-trim"
                    aria-label={`Trim end of ${clip.name}`}
                    {...controls("trim-end")}
                  />
                  <button
                    className="audio-clip-mute"
                    disabled={locked}
                    aria-label={`${clip.muted ? "Unmute" : "Mute"} audio ${clip.name}`}
                    aria-pressed={clip.muted}
                    title={clip.muted ? "Unmute clip" : "Mute clip"}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      change(
                        {
                          audio: p.audio?.map((item) =>
                            item.id === clip.id
                              ? { ...item, muted: !item.muted }
                              : item,
                          ),
                        },
                        clip.muted ? "Unmute audio clip" : "Mute audio clip",
                      );
                    }}
                  >
                    {clip.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                  <ClipVolume clip={clip} locked={locked} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
});
