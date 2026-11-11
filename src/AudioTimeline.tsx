import { useStatusNotice } from "./editor-status";
import { memo, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { createPortal } from "react-dom";
import { startTimelineDrag } from "./timeline-drag";
import { useProjectState, useStudio } from "./store";
import { sceneOffset, totalDuration } from "../shared/workflow";
import {
  editAudioClip,
  audioTimelineRows,
  snapAudioEdit,
  updateAudioClip,
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
  const cleanup = useRef<(() => void) | null>(null);
  const section = useRef<HTMLElement>(null);
  const [dragPreview, setDragPreview] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    dropTop: number;
  } | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const notify = useStatusNotice();
  const offset =
    !master && p.workflow ? sceneOffset(p, p.workflow.selectedId) : 0;
  const visible = (p.audio ?? []).filter(
    (clip) =>
      master || !clip.sceneId || clip.sceneId === p.workflow?.selectedId,
  );
  if (!visible.length) return null;
  const startOf = (clip: AudioClip) =>
    clip.start + (clip.sceneId ? sceneOffset(p, clip.sceneId) : 0) - offset;
  const shown = visible.filter(
    (clip) => startOf(clip) < duration && startOf(clip) + clip.length > 0,
  );
  const rows = audioTimelineRows(shown, startOf);
  const scope = (clip: AudioClip, mode: AudioEdit) => {
    const scene = p.workflow?.scenes.find((scene) => scene.id === clip.sceneId);
    if (mode === "move") {
      if (clip.sceneId && scene) return 600 - totalDuration(p) + scene.duration;
      return p.workflow?.scenes.at(-1)?.locked ? totalDuration(p) : 600;
    }
    return clip.sceneId
      ? (p.workflow?.scenes.find((scene) => scene.id === clip.sceneId)
          ?.duration ?? duration)
      : (p.workflow?.scenes.reduce((n, s) => n + s.duration, 0) ?? duration);
  };
  const commit = (clip: AudioClip, revision: number) => {
    const current = useStudio.getState();
    if (current.revision !== revision) {
      notify("Project changed during audio edit. Try again.");
      return;
    }
    try {
      change(updateAudioClip(current.project, clip), "Move / trim audio");
    } catch (error) {
      notify((error as Error).message);
      return;
    }
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
    event.stopPropagation();
    const target = event.currentTarget,
      track = target.closest<HTMLElement>(".audio-edit-track")!;
    const width = track.getBoundingClientRect().width;
    const startY = event.clientY;
    const originTop = track.getBoundingClientRect().top;
    const revision = useStudio.getState().revision;
    const session = useStudio.getState().session;
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
    let heldSnap: { delta: number; clip: AudioClip; target: number } | null =
      null;
    cleanup.current = startTimelineDrag(event, {
      extraScroll:
        mode === "move"
          ? (Math.max(0, scope(clip, mode) - duration) * width) / duration
          : 0,
      onMove: (movement) => {
        const delta = (movement.deltaX / width) * duration;
        if (
          !snapping ||
          movement.altKey ||
          (heldSnap &&
            Math.abs(delta - heldSnap.delta) > (duration * 12) / width)
        )
          heldSnap = null;
        const result =
          heldSnap ??
          (snapping && !movement.altKey
            ? snapAudioEdit(
                clip,
                delta,
                mode,
                scope(clip, mode),
                targets
                  .filter((time) => time >= 0 && time <= duration)
                  .map((time) => time - base),
                (duration * 8) / width,
              )
            : {
                clip: editAudioClip(clip, delta, mode, scope(clip, mode)),
                target: undefined,
              });
        const next = result.clip;
        if (result.target !== undefined && !heldSnap) {
          const snappedDelta =
            mode === "trim-end"
              ? next.length - clip.length
              : next.start - clip.start;
          heldSnap = { delta: snappedDelta, clip: next, target: result.target };
        }
        onSnap?.(result.target === undefined ? null : result.target + base);
        draftRef.current = next;
        setDraft(next);
        if (mode === "move") {
          const tracks = [
            ...section.current!.querySelectorAll<HTMLElement>(
              ".audio-edit-track",
            ),
          ];
          const projected = audioTimelineRows(
            shown.map((item) => (item.id === clip.id ? next : item)),
            startOf,
          );
          const rowIndex = projected.findIndex((row) =>
            row.clips.some((item) => item.id === clip.id),
          );
          const bounds = track.getBoundingClientRect();
          const rowStyle = getComputedStyle(track.parentElement!);
          const rowHeight =
            track.parentElement!.getBoundingClientRect().height +
            parseFloat(rowStyle.marginTop) +
            parseFloat(rowStyle.marginBottom);
          const dropTop =
            tracks[rowIndex]?.getBoundingClientRect().top ??
            (tracks.at(-1)?.getBoundingClientRect().top ?? bounds.top) +
              rowHeight;
          setDragPreview({
            left: bounds.left + (startOf(next) / duration) * width,
            top: originTop + movement.clientY - startY,
            width: (next.length / duration) * width,
            height: bounds.height,
            dropTop,
          });
        }
      },
      onEnd: (apply) => {
        activeGesture.current = false;
        if (apply && useStudio.getState().session !== session)
          notify("Project changed during audio edit. Try again.");
        else if (apply && draftRef.current) commit(draftRef.current, revision);
        draftRef.current = null;
        setDraft(null);
        setDragPreview(null);
        onSnap?.(null);
        cleanup.current = null;
      },
    });
  };
  return (
    <section
      ref={section}
      className="audio-timeline"
      aria-label="Audio timeline"
    >
      <p className="audio-timeline-help">
        Drag audio to move · drag edges to trim · focus a control and use arrow
        keys
      </p>
      {rows.map((row, rowIndex) => (
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
              const clip =
                !dragPreview && draft?.id === original.id ? draft : original;
              const start =
                clip.start +
                (clip.sceneId ? sceneOffset(p, clip.sceneId) : 0) -
                offset;
              if (!draft && (start >= duration || start + clip.length <= 0))
                return null;
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
                    editAudioClip(original, delta, mode, scope(original, mode)),
                    useStudio.getState().revision,
                  );
                },
              });
              return (
                <div
                  key={clip.id}
                  data-timeline-kind="audio"
                  data-timeline-id={clip.id}
                  className={`audio-edit-clip ${clip.lane} ${clip.muted ? "muted" : ""} ${selected === clip.id ? "selected" : ""} ${dragPreview && draft?.id === clip.id ? "audio-drag-source" : ""}`}
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
      {dragPreview &&
        draft &&
        createPortal(
          <>
            <div
              className="audio-drop-preview"
            aria-hidden="true"
              style={{
                left: dragPreview.left,
                top: dragPreview.dropTop,
                width: dragPreview.width,
                height: dragPreview.height,
              }}
            />
            <div
              className={`audio-drag-preview ${draft.lane}`}
            aria-hidden="true"
              style={{
                left: dragPreview.left,
                top: dragPreview.top,
                width: dragPreview.width,
                height: dragPreview.height,
              }}
            >
              <AudioWaveform clip={draft} />
              <span className="audio-clip-name">{draft.name}</span>
              <small>{draft.start.toFixed(2)}s</small>
            </div>
          </>,
          document.body,
        )}
    </section>
  );
});
