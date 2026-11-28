import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Project } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { Modal } from "./components";
import {
  ArrowRight,
  Check,
  Columns2,
  Crosshair,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  StepBack,
  StepForward,
  Undo2,
} from "lucide-react";

export function ReviewFrame({
  project,
  time,
  title,
  label = title,
  detail,
}: {
  project: Project;
  time: number;
  title: string;
  label?: string;
  detail?: string;
}) {
  const document = useMemo(() => documentFor(project), [project]);
  const frame = useRef<HTMLIFrameElement>(null),
    box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  const seek = () =>
    frame.current?.contentWindow?.postMessage(
      { framescript: true, type: "seek", value: time },
      "*",
    );
  useEffect(seek, [time, document]);
  return (
    <div className="scene-review-card">
      <div className="scene-review-card-head">
        <h3>{label}</h3>
        {detail && <span>{detail}</span>}
      </div>
      <div
        ref={box}
        className="scene-review-frame"
        role="group"
        aria-label={`${title} preview`}
        tabIndex={0}
        onPointerDown={(event) => event.currentTarget.focus()}
        style={{
          aspectRatio: `${project.settings.width} / ${project.settings.height}`,
          maxWidth: `max(160px, calc((100dvh - 340px) * ${project.settings.width / project.settings.height}))`,
        }}
      >
        <iframe
          ref={frame}
          title={title}
          srcDoc={document}
          sandbox="allow-scripts"
          tabIndex={-1}
          onLoad={seek}
          style={{
            width: project.settings.width,
            height: project.settings.height,
            transform: `scale(${width / project.settings.width})`,
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}
export function SceneReview({
  before,
  after,
  explanation,
  onApply,
  onDiscard,
  initialTime = 0,
  applyDisabled = false,
  actions,
  comparisonDuration,
  beforeTime,
  playFrom,
  title = "Review AI changes",
  joinTime,
}: {
  before?: Project;
  after: Project;
  explanation: ReactNode;
  onApply: () => void;
  onDiscard: () => void;
  initialTime?: number;
  applyDisabled?: boolean;
  actions?: ReactNode;
  comparisonDuration?: number;
  beforeTime?: number;
  playFrom?: number;
  title?: string;
  joinTime?: number;
}) {
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const [playbackRun, setPlaybackRun] = useState(0);
  const [layout, setLayout] = useState<"compare" | "preview">("compare");
  const playbackStart = useRef(initialTime);
  const end =
    comparisonDuration ??
    Math.min(
      before?.settings.duration ?? after.settings.duration,
      after.settings.duration,
    );
  const fps = after.settings.fps;
  const seek = (value: number) => {
    setPlaying(false);
    setTime(Math.max(0, Math.min(end, value)));
  };
  const play = (from: number) => {
    playbackStart.current = from >= end ? 0 : from;
    setTime(playbackStart.current);
    setPlaybackRun((run) => run + 1);
    setPlaying(true);
  };
  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(
        end,
        playbackStart.current + (now - started) / 1000,
      );
      setTime(next);
      if (next < end) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, end, playbackRun]);
  return (
    <Modal
      title={title}
      className="scene-review-modal"
      wide
      open
      onClose={onDiscard}
      onKeyDownCapture={(event) => {
        if (
          event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          event.nativeEvent.isComposing
        )
          return;
        const target = event.target as HTMLElement;
        if (
          target.closest(
            'textarea, select, input:not([type="range"]), [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]',
          )
        )
          return;
        const key = event.key.toLowerCase();
        if (
          ![" ", "arrowleft", "arrowright", "home", "end", "j"].includes(key) ||
          (key === "j" && joinTime === undefined)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (key === " ") {
          if (!event.repeat) playing ? setPlaying(false) : play(time);
        } else if (key === "arrowleft" || key === "arrowright") {
          seek(
            time +
              ((key === "arrowleft" ? -1 : 1) * (event.shiftKey ? 10 : 1)) /
                fps,
          );
        } else if (key === "home") seek(0);
        else if (key === "end") seek(end);
        else if (key === "j" && joinTime !== undefined) seek(joinTime);
      }}
    >
      <div className="scene-review-workspace">
        <div className="scene-review-summary">
          <div className="scene-review-description">{explanation}</div>
          <span className="scene-review-format">
            {after.settings.width} × {after.settings.height}
            <span>·</span>
            {fps} fps
          </span>
        </div>
        <div className="scene-review-viewbar">
          <div className="scene-review-view-label">
            <span className="scene-review-status-dot" />
            {joinTime !== undefined
              ? "Check the handoff, then watch what comes next"
              : "Preview your changes before applying"}
          </div>
          {before && (
            <div
              className="scene-review-view-toggle"
              role="group"
              aria-label="Preview layout"
            >
              <button
                aria-pressed={layout === "compare"}
                onClick={() => setLayout("compare")}
              >
                <Columns2 size={14} /> Compare
              </button>
              <button
                aria-pressed={layout === "preview"}
                onClick={() => setLayout("preview")}
              >
                <Maximize2 size={14} /> Preview
              </button>
            </div>
          )}
        </div>
        <div
          className={before ? "scene-review-grid" : "scene-review-single"}
          data-layout={layout}
        >
          {before && (
            <ReviewFrame
              project={before}
              time={beforeTime ?? time}
              title="Current scene"
              label={
                joinTime !== undefined ? "Original handoff" : "Current scene"
              }
              detail={
                beforeTime !== undefined
                  ? `Held at ${beforeTime.toFixed(3)}s`
                  : "Before changes"
              }
            />
          )}
          <ReviewFrame
            project={after}
            time={time}
            title="Proposed scene"
            label={
              joinTime !== undefined ? "With continuation" : "Proposed scene"
            }
            detail={
              joinTime !== undefined
                ? time < joinTime
                  ? "Before join"
                  : "Continuation"
                : "After changes"
            }
          />
        </div>
        <div className="scene-review-transport">
          <div className="scene-review-playback-row">
            <div className="scene-review-playback-buttons">
              <button
                aria-label="Back to start"
                title="Back to start (Home)"
                onClick={() => seek(0)}
              >
                <SkipBack size={16} />
              </button>
              <button
                aria-label="Previous frame"
                title="Previous frame (←) · Shift for 10 frames"
                onClick={() => seek(time - 1 / fps)}
              >
                <StepBack size={16} />
              </button>
              <button
                className="scene-review-play"
                aria-label={playing ? "Pause preview" : "Play preview"}
                title={
                  playing ? "Pause preview (Space)" : "Play preview (Space)"
                }
                aria-keyshortcuts="Space"
                onClick={() => (playing ? setPlaying(false) : play(time))}
              >
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <button
                aria-label="Next frame"
                title="Next frame (→) · Shift for 10 frames"
                onClick={() => seek(time + 1 / fps)}
              >
                <StepForward size={16} />
              </button>
            </div>
            <div className="scene-review-time">
              <span>
                {time.toFixed(3)}
                <small>s</small>
              </span>
              <span className="scene-review-time-total">
                / {end.toFixed(3)}s
              </span>
            </div>
            {joinTime !== undefined && (
              <button
                className="scene-review-jump"
                title="Jump to join (J)"
                aria-keyshortcuts="J"
                onClick={() => seek(joinTime)}
              >
                <Crosshair size={14} /> Jump to join{" "}
                <span>{joinTime.toFixed(3)}s</span>
              </button>
            )}
            {playFrom !== undefined && (
              <button
                className="scene-review-across"
                onClick={() => play(playFrom)}
              >
                <Play size={13} /> Play across join
              </button>
            )}
          </div>
          <div className="scene-review-scrubber">
            {joinTime !== undefined && (
              <span
                className="scene-review-join-marker"
                style={{ left: `${end ? (joinTime / end) * 100 : 0}%` }}
                aria-hidden="true"
              />
            )}
            <input
              aria-label="Comparison time"
              aria-valuetext={`${time.toFixed(3)} seconds${joinTime !== undefined ? (time < joinTime ? ", before join" : ", continuation") : ""}`}
              type="range"
              min={0}
              max={end}
              step={1 / fps}
              value={time}
              onChange={(e) => seek(Number(e.target.value))}
            />
          </div>
          <div className="scene-review-ruler">
            <span>0:00</span>
            <span>
              {joinTime !== undefined
                ? `Join at ${joinTime.toFixed(3)}s · Drag to scrub`
                : "Drag to scrub · Step through individual frames"}
            </span>
            <span>{end.toFixed(2)}s</span>
          </div>
          <div
            className="scene-review-keyboard"
            role="group"
            aria-label="Review keyboard shortcuts"
          >
            <span>
              <kbd>Space</kbd> Play / pause
            </span>
            <span>
              <kbd>←</kbd>
              <kbd>→</kbd> Frame
            </span>
            <span>
              <kbd>Shift</kbd> + arrows · 10 frames
            </span>
            <span>
              <kbd>Home</kbd>
              <kbd>End</kbd> Start / end
            </span>
            {joinTime !== undefined && (
              <span>
                <kbd>J</kbd> Join
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="modal-actions scene-review-actions">
        <span className="scene-review-undo">
          <Undo2 size={14} /> You can undo after applying
        </span>
        <div className="scene-review-action-buttons">
          {actions}
          <button onClick={onDiscard}>Discard changes</button>
          <button
            className="primary"
            onClick={onApply}
            disabled={applyDisabled}
          >
            <Check size={15} /> Apply changes <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
