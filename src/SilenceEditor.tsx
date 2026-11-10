import { useEffect, useMemo, useRef, useState } from "react";
import {
  Scissors,
  Sparkles,
  Undo2,
  Redo2,
  Play,
  Pause,
  X,
  CircleHelp,
  ZoomIn,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { AudioClip } from "../shared/project";
import {
  detectSilence,
  mapAudioTime,
  normalizeCuts,
  type CutRange,
} from "../shared/silence";
import { cutRecording, decodeRecording } from "./silence-audio";
import { saveAudioEdit, type AudioEditMode } from "./save-audio-edit";
import { useStudio } from "./store";
import { useStatusActivity, useStatusNotice } from "./editor-status";
import { Modal } from "./components";
import { AudioWaveform } from "./AudioWaveform";

export function SilenceEditor({
  clip,
  onError,
}: {
  clip: AudioClip;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const notify = useStatusNotice();
  useStatusActivity(busy ? "Preparing audio…" : "");
  const [editing, setEditing] = useState<{
    clip: AudioClip;
    buffer: AudioBuffer;
  }>();
  const decoded = useRef<{ data: string; buffer: AudioBuffer } | undefined>(
    undefined,
  );
  const canUndo = useStudio(
    (s) => s.past.at(-1)?.label === "Edit narration audio",
  );
  const canRedo = useStudio(
    (s) => s.future[0]?.label === "Edit narration audio",
  );
  const load = async () => {
    if (decoded.current?.data === clip.data) return decoded.current.buffer;
    const buffer = await decodeRecording(clip.data);
    decoded.current = { data: clip.data, buffer };
    return buffer;
  };
  const auto = async () => {
    setBusy(true);

    try {
      const audio = await load();
      const cuts = detectSilence(
        Array.from({ length: audio.numberOfChannels }, (_, i) =>
          audio.getChannelData(i),
        ),
        audio.sampleRate,
        -40,
        0.35,
        0.08,
        clip.transcriptWords,
      );
      if (!cuts.length) {
        notify("No silence to remove.");
        return;
      }
      const result = cutRecording(audio, cuts);
      saveAudioEdit(clip, result, "original");
      notify(
        `${(audio.duration - result.duration).toFixed(2)}s removed. Timing updated.`,
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const edit = async () => {
    setBusy(true);
    try {
      useStudio.getState().setPlaying(false);
      const buffer = await load();
      setEditing({ clip, buffer });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="audio-cleanup" aria-busy={busy}>
      <div className="audio-cleanup-actions">
        <button
          disabled={busy}
          aria-label="Auto remove silence"
          title="Auto remove silence"
          onClick={() => void auto()}
        >
          <Sparkles size={14} />
        </button>
        <button
          disabled={busy}
          aria-label="Edit audio"
          title="Edit audio"
          onClick={() => void edit()}
        >
          <Scissors size={13} />
        </button>
        {(canUndo || canRedo) && (
          <>
            <button
              aria-label="Undo audio edit"
              title="Undo audio edit"
              disabled={!canUndo}
              onClick={() => {
                useStudio.getState().undo();
                notify("Edit undone.");
              }}
            >
              <Undo2 size={14} />
            </button>
            <button
              aria-label="Redo audio edit"
              title="Redo audio edit"
              disabled={!canRedo}
              onClick={() => {
                useStudio.getState().redo();
                notify("Edit restored.");
              }}
            >
              <Redo2 size={14} />
            </button>
          </>
        )}
      </div>
      {editing && (
        <AudioCutModal
          {...editing}
          onClose={() => setEditing(undefined)}
          onSave={(result, mode) => {
            saveAudioEdit(editing.clip, result, mode);
            notify(
              mode === "original"
                ? "Original recording updated."
                : "Edited copy saved to the audio library.",
            );
            setEditing(undefined);
          }}
        />
      )}
    </div>
  );
}

function AudioCutModal({
  clip,
  buffer,
  onClose,
  onSave,
}: {
  clip: AudioClip;
  buffer: AudioBuffer;
  onClose: () => void;
  onSave: (
    result: ReturnType<typeof cutRecording>,
    mode: AudioEditMode,
  ) => void;
}) {
  const [history, setHistory] = useState<CutRange[][]>([[]]),
    [index, setIndex] = useState(0);
  const cuts = history[index];
  const [selection, setSelection] = useState<CutRange>({ start: 0, end: 0 });
  const [saveMode, setSaveMode] = useState<AudioEditMode>("original"),
    [error, setError] = useState("");
  const [playhead, setPlayhead] = useState(0),
    [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const [discard, setDiscard] = useState(false);
  const resumeAt = useRef(0);
  const stopAt = useRef<number | undefined>(undefined);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(stopTimer.current), []);
  const player = useRef<HTMLAudioElement>(null),
    anchor = useRef<number | undefined>(undefined);
  const result = useMemo(() => {
    try {
      return {
        audio: cuts.length ? cutRecording(buffer, cuts) : undefined,
        error: "",
      };
    } catch (e) {
      return { audio: undefined, error: (e as Error).message };
    }
  }, [buffer, cuts]);
  const duration = buffer.duration,
    removed = cuts.reduce((n, c) => n + c.end - c.start, 0);
  const previewDuration = result.audio?.duration ?? duration;
  const previewTime = Math.min(previewDuration, mapAudioTime(playhead, cuts));
  const togglePlayback = () => {
    const audio = player.current;
    if (!audio) return;
    stopAt.current = undefined;
    clearTimeout(stopTimer.current);
    if (audio.paused)
      void audio.play().catch((failure) => {
        if (failure.name !== "AbortError")
          setError("Could not play this recording.");
      });
    else audio.pause();
  };
  const rememberPosition = () => {
    resumeAt.current = originalTime(player.current?.currentTime ?? 0);
    player.current?.pause();
    stopAt.current = undefined;
  };
  const change = (next: CutRange[]) => {
    const normalized = normalizeCuts(next, duration);
    if (JSON.stringify(normalized) === JSON.stringify(cuts)) return false;
    if (duration - normalized.reduce((n, c) => n + c.end - c.start, 0) < 0.05) {
      setError("Keep a little audio in the recording.");
      return false;
    }
    rememberPosition();
    setHistory((all) => [...all.slice(0, index + 1), normalized]);
    setIndex(index + 1);
    setError("");
    return true;
  };
  const undo = () => {
    rememberPosition();
    setIndex((i) => Math.max(0, i - 1));
  };
  const redo = () => {
    rememberPosition();
    setIndex((i) => Math.min(history.length - 1, i + 1));
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input,textarea,select"))
        return;
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selection.end - selection.start >= 0.01
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        cutSelection();
        return;
      }
      if (
        event.code === "Space" &&
        !(event.target as HTMLElement).closest("button,select,audio")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        togglePlayback();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        event.stopImmediatePropagation();
        redo();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [history, index, selection]);
  const hasSelection = selection.end - selection.start >= 0.01;
  const cutSelection = () => {
    if (!hasSelection) return;
    if (change([...cuts, selection]))
      setSelection({ start: selection.start, end: selection.start });
  };
  const requestClose = () => {
    if (cuts.length || hasSelection) setDiscard(true);
    else onClose();
  };
  const playSelection = () => {
    if (!player.current) return;
    player.current.currentTime = mapAudioTime(selection.start, cuts);
    stopAt.current = mapAudioTime(selection.end, cuts);
    void player.current.play().catch((error) => {
      if (error.name !== "AbortError")
        setError("Could not play this selection.");
    });
  };
  const scheduleSelectionEnd = () => {
    clearTimeout(stopTimer.current);
    const audio = player.current;
    if (!audio || audio.paused || stopAt.current === undefined) return;
    const end = stopAt.current;
    stopTimer.current = setTimeout(
      () => {
        audio.pause();
        audio.currentTime = end;
        stopAt.current = undefined;
      },
      Math.max(0, ((end - audio.currentTime) / audio.playbackRate) * 1000),
    );
  };
  const at = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.max(
      0,
      Math.min(duration, ((event.clientX - box.left) / box.width) * duration),
    );
  };
  const originalTime = (time: number) => {
    let source = time;
    for (const c of cuts) {
      if (source < c.start) break;
      source += c.end - c.start;
    }
    return Math.min(duration, source);
  };
  return (
    <Modal title="Edit audio" open onClose={requestClose} wide>
      <div className="audio-cut-modal">
        <div className="audio-cut-top">
          <div className="audio-cut-meta">
            <strong title={clip.name}>{clip.name}</strong>
            <span>
              {removed ? `${duration.toFixed(2)}s → ` : ""}
              {previewDuration.toFixed(2)}s
            </span>
          </div>
          <div className="audio-cut-tools">
            <button
              disabled={index === 0}
              aria-label="Undo cut"
              title="Undo cut (Ctrl+Z)"
              onClick={undo}
            >
              <Undo2 size={15} />
            </button>
            <button
              disabled={index === history.length - 1}
              aria-label="Redo cut"
              title="Redo cut (Ctrl+Shift+Z)"
              onClick={redo}
            >
              <Redo2 size={15} />
            </button>
            <button
              aria-label="Auto remove silence"
              title="Detect and cut silence"
              onClick={() =>
                change([
                  ...cuts,
                  ...detectSilence(
                    Array.from({ length: buffer.numberOfChannels }, (_, i) =>
                      buffer.getChannelData(i),
                    ),
                    buffer.sampleRate,
                    -40,
                    0.35,
                    0.08,
                    clip.transcriptWords,
                  ),
                ])
              }
            >
              <Sparkles size={14} />
            </button>
            <label title="Waveform zoom">
              <ZoomIn size={15} aria-hidden="true" />
              <select
                aria-label="Audio timeline zoom"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              >
                {[1, 2, 4, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}×
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Editing shortcuts"
              title="Editing shortcuts"
              aria-expanded={showHelp}
              onClick={() => setShowHelp(!showHelp)}
            >
              <CircleHelp size={15} />
            </button>
          </div>
        </div>
        {showHelp && (
          <p className="audio-cut-hint">
            Click to seek. Drag to select. Delete cuts the selection, Space
            plays or pauses, and clicking a cut restores it.
          </p>
        )}
        <div className="audio-cut-scroll">
          <div className="audio-cut-track" style={{ width: `${zoom * 100}%` }}>
            <div className="audio-cut-ruler">
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i}>{((duration * i) / 10).toFixed(1)}s</span>
              ))}
            </div>
            <div
              className="audio-cut-wave"
              role="group"
              aria-label="Audio selection timeline"
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.focus();
                player.current?.pause();
                anchor.current = at(e);
                setSelection({ start: anchor.current, end: anchor.current });
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (anchor.current === undefined) return;
                const t = at(e);
                setSelection({
                  start: Math.min(anchor.current, t),
                  end: Math.max(anchor.current, t),
                });
              }}
              onPointerUp={(e) => {
                if (anchor.current !== undefined) {
                  const end = at(e);
                  if (Math.abs(end - anchor.current) >= 0.01)
                    setSelection({
                      start: Math.min(anchor.current, end),
                      end: Math.max(anchor.current, end),
                    });
                }
                if (
                  anchor.current !== undefined &&
                  Math.abs(at(e) - anchor.current) < 0.01 &&
                  player.current
                ) {
                  player.current.currentTime = mapAudioTime(at(e), cuts);
                  setPlayhead(at(e));
                }
                anchor.current = undefined;
              }}
              onLostPointerCapture={() => {
                anchor.current = undefined;
              }}
            >
              <AudioWaveform clip={clip} thumbnail />
              {cuts.map((c, i) => (
                <button
                  type="button"
                  key={i}
                  className="audio-cut-deleted"
                  aria-label={`Restore cut ${i + 1}`}
                  title="Click to restore this cut"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    change(cuts.filter((_, n) => n !== i));
                  }}
                  style={{
                    left: `${(c.start / duration) * 100}%`,
                    width: `${((c.end - c.start) / duration) * 100}%`,
                  }}
                >
                  <Undo2 size={16} />
                </button>
              ))}
              {hasSelection && (
                <div
                  className="audio-cut-selection"
                  style={{
                    left: `${(selection.start / duration) * 100}%`,
                    width: `${((selection.end - selection.start) / duration) * 100}%`,
                  }}
                />
              )}
              <div
                className="audio-cut-playhead"
                style={{ left: `${(playhead / duration) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="audio-cut-selection-tools">
          <label>
            From
            <input
              aria-label="Selection start"
              type="number"
              min={0}
              max={duration}
              step={0.01}
              value={Number(selection.start.toFixed(3))}
              onChange={(e) =>
                setSelection((s) => ({
                  ...s,
                  start: Math.max(
                    0,
                    Math.min(duration, Number(e.target.value)),
                  ),
                }))
              }
            />
          </label>
          <label>
            To
            <input
              aria-label="Selection end"
              type="number"
              min={0}
              max={duration}
              step={0.01}
              value={Number(selection.end.toFixed(3))}
              onChange={(e) =>
                setSelection((s) => ({
                  ...s,
                  end: Math.max(0, Math.min(duration, Number(e.target.value))),
                }))
              }
            />
          </label>
          <button
            disabled={!hasSelection}
            onClick={cutSelection}
            aria-label="Cut selection"
            title="Cut selection (Delete)"
          >
            <Scissors size={15} />
          </button>
          <button
            disabled={!hasSelection || !!result.error}
            onClick={playSelection}
            aria-label="Hear selection"
            title="Hear selection"
          >
            <Play size={14} />
          </button>
          <span>
            {hasSelection
              ? `${(selection.end - selection.start).toFixed(2)}s selected`
              : removed > 0
                ? `${removed.toFixed(2)}s removed`
                : "Drag to select"}
          </span>
        </div>
        <audio
          ref={player}
          hidden
          src={result.audio?.data ?? clip.data}
          aria-label="Audio edit preview"
          onPlay={() => {
            setPlaying(true);
            scheduleSelectionEnd();
          }}
          onSeeked={scheduleSelectionEnd}
          onRateChange={scheduleSelectionEnd}
          onPause={() => {
            setPlaying(false);
            clearTimeout(stopTimer.current);
          }}
          onEnded={() => setPlaying(false)}
          onVolumeChange={(event) => {
            setMuted(event.currentTarget.muted);
            setVolume(event.currentTarget.volume);
          }}
          onLoadedMetadata={(event) => {
            event.currentTarget.currentTime = Math.min(
              event.currentTarget.duration,
              mapAudioTime(resumeAt.current, cuts),
            );
            setPlayhead(resumeAt.current);
          }}
          onTimeUpdate={(e) => {
            if (
              stopAt.current !== undefined &&
              e.currentTarget.currentTime >= stopAt.current
            ) {
              e.currentTarget.pause();
              stopAt.current = undefined;
            }
            setPlayhead(originalTime(e.currentTarget.currentTime));
          }}
        />
        <div
          className="audio-cut-transport"
          role="group"
          aria-label="Audio preview controls"
        >
          <button
            onClick={togglePlayback}
            aria-label={playing ? "Pause preview" : "Play preview"}
            title={playing ? "Pause preview (Space)" : "Play preview (Space)"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <input
            type="range"
            aria-label="Preview position"
            aria-valuetext={`${previewTime.toFixed(2)} of ${previewDuration.toFixed(2)} seconds`}
            min={0}
            max={previewDuration}
            step={0.001}
            value={previewTime}
            onChange={(event) => {
              if (!player.current) return;
              const time = Number(event.target.value);
              stopAt.current = undefined;
              clearTimeout(stopTimer.current);
              player.current.currentTime = time;
              setPlayhead(originalTime(time));
            }}
          />
          <span className="audio-cut-time">
            {previewTime.toFixed(2)} / {previewDuration.toFixed(2)}s
          </span>
          <div className="audio-cut-sound">
            <button
              aria-label={muted ? "Unmute preview" : "Mute preview"}
              title={muted ? "Unmute preview" : "Mute preview"}
              onClick={() => {
                if (player.current)
                  player.current.muted = !player.current.muted;
              }}
            >
              {muted || !volume ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              aria-label="Preview volume"
              onChange={(event) => {
                if (player.current)
                  player.current.volume = Number(event.target.value);
              }}
            />
            <select
              aria-label="Preview speed"
              title="Preview speed"
              defaultValue={1}
              onChange={(event) => {
                if (!player.current) return;
                const rate = Number(event.target.value);
                player.current.defaultPlaybackRate = rate;
                player.current.playbackRate = rate;
              }}
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <option key={rate} value={rate}>
                  {rate}×
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="audio-cut-footer">
          <label>
            <select
              aria-label="Save changes to"
              title={
                saveMode === "original"
                  ? "Update the recording and its linked timeline clips"
                  : "Add a separate recording to the library"
              }
              value={saveMode}
              onChange={(event) => {
                setSaveMode(event.target.value as AudioEditMode);
                setError("");
              }}
            >
              <option value="original">Update original</option>
              <option value="copy">Save as copy</option>
            </select>
          </label>
          <button onClick={requestClose}>Cancel</button>
          <button
            className="primary"
            disabled={!!result.error && !hasSelection}
            onClick={() => {
              try {
                const edit = hasSelection
                  ? cutRecording(
                      buffer,
                      normalizeCuts([...cuts, selection], duration),
                    )
                  : result.audio;
                if (edit) onSave(edit, saveMode);
                else onClose();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {hasSelection ? "Cut & save" : cuts.length ? "Save audio" : "Done"}
          </button>
        </div>
        {(error || result.error) && <p role="alert">{error || result.error}</p>}
        {discard && (
          <div className="audio-discard-confirm" role="alert">
            <span>Discard unsaved cuts?</span>
            <button onClick={() => setDiscard(false)}>Keep editing</button>
            <button onClick={onClose}>
              <X size={13} />
              Discard changes
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
