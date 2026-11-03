import {
  ArrowLeft,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Square,
  Minimize2,
  Gauge,
} from "lucide-react";
import { useStudio } from "./store";
import { totalDuration } from "../shared/workflow";
import type { ReactNode } from "react";
export function PlayerTransport({
  masterMode,
  fullscreen = false,
  previewControls,
}: {
  masterMode: boolean;
  fullscreen?: boolean;
  previewControls?: ReactNode;
}) {
  const s = useStudio(),
    p = s.project;
  const playbackDuration = masterMode ? totalDuration(p) : p.settings.duration;
  const settings = (patch: Partial<typeof p.settings>) =>
    s.change({ settings: { ...p.settings, ...patch } }, "Project settings");
  return (
    <>
      {fullscreen && (
        <input
          className="fullscreen-seek"
          aria-label="Fullscreen playback position"
          type="range"
          min={0}
          max={playbackDuration}
          step={1 / p.settings.fps}
          value={Math.min(s.time, playbackDuration)}
          onChange={(event) => {
            s.setPlaying(false);
            s.setTime(Number(event.target.value));
          }}
        />
      )}
      <div className="transport">
        <button title="Restart" onClick={() => s.setTime(0)}>
          <RotateCcw size={15} />
        </button>
        <button
          title="Previous frame"
          onClick={() => {
            s.setPlaying(false);
            s.setTime(Math.max(0, s.time - 1 / p.settings.fps));
          }}
        >
          <ArrowLeft size={15} />
        </button>
        <button
          title={s.playing ? "Pause" : "Play"}
          className="play-button"
          onClick={() => s.setPlaying(!s.playing)}
        >
          {s.playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          title="Next frame"
          onClick={() => {
            s.setPlaying(false);
            s.setTime(Math.min(playbackDuration, s.time + 1 / p.settings.fps));
          }}
        >
          <ArrowRight size={15} />
        </button>
        <button
          title="Stop"
          onClick={() => {
            s.setPlaying(false);
            s.setTime(0);
          }}
        >
          <Square size={13} />
        </button>
        <code>
          {s.time.toFixed(2)} <span>/ {playbackDuration.toFixed(2)} s</span>
        </code>
        <span className="toolbar-spacer" />
        {previewControls}
        <label className="player-speed">
          <Gauge size={15} aria-hidden="true" />
          <select
            aria-label="Film speed"
            title="Film speed · also used for export"
            value={p.settings.speed}
            onChange={(event) =>
              settings({ speed: Number(event.target.value) })
            }
          >
            {Array.from(
              new Set([
                0.25,
                0.5,
                0.75,
                1,
                1.25,
                1.5,
                2,
                3,
                4,
                p.settings.speed,
              ]),
            )
              .sort((a, b) => a - b)
              .map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
          </select>
        </label>
        <button
          className={p.settings.loop ? "accent" : ""}
          title="Loop playback"
          aria-label="Loop playback"
          aria-pressed={p.settings.loop}
          onClick={() => settings({ loop: !p.settings.loop })}
        >
          <RotateCcw size={16} />
        </button>
        {fullscreen && (
          <button
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
            onClick={() => void document.exitFullscreen()}
          >
            <Minimize2 size={16} />
          </button>
        )}
      </div>
    </>
  );
}
