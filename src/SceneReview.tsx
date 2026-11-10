import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Project } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { Modal } from "./components";

export function ReviewFrame({
  project,
  time,
  title,
}: {
  project: Project;
  time: number;
  title: string;
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
    <div>
      <h3>{title}</h3>
      <div
        ref={box}
        className="scene-review-frame"
        style={{
          aspectRatio: `${project.settings.width} / ${project.settings.height}`,
        }}
      >
        <iframe
          ref={frame}
          title={title}
          srcDoc={document}
          sandbox="allow-scripts"
          onLoad={seek}
          style={{
            width: project.settings.width,
            height: project.settings.height,
            transform: `scale(${width / project.settings.width})`,
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
}) {
  const [time, setTime] = useState(initialTime);
  const [playing, setPlaying] = useState(false);
  const end = comparisonDuration ?? Math.min(
    before?.settings.duration ?? after.settings.duration,
    after.settings.duration,
  );
  useEffect(() => {
    if (!playing || playFrom === undefined) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const next = Math.min(end, playFrom + (now - started) / 1000);
      setTime(next);
      if (next < end) frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, playFrom, end]);
  return (
    <Modal title="Review AI changes" wide open onClose={onDiscard}>
      <div>{explanation}</div>
      <div className={before ? "scene-review-grid" : undefined}>
        {before && (
          <ReviewFrame project={before} time={beforeTime ?? time} title="Current scene" />
        )}
        <ReviewFrame project={after} time={time} title="Proposed scene" />
      </div>
      <label className="field">
        <span>Compare at {time.toFixed(2)} seconds</span>
        <input
          aria-label="Comparison time"
          type="range"
          min={0}
          max={end}
          step={0.05}
          value={time}
          onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }}
        />
      </label>
      <div className="modal-actions">
        {actions}
        {playFrom !== undefined && <button onClick={() => setPlaying(!playing)}>{playing ? "Stop preview" : "Play across join"}</button>}
        <button onClick={onDiscard}>Discard changes</button>
        <button className="primary" onClick={onApply} disabled={applyDisabled}>
          Apply changes
        </button>
      </div>
    </Modal>
  );
}
