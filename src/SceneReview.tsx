import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { Modal } from "./components";

function ReviewFrame({
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
}: {
  before: Project;
  after: Project;
  explanation: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [time, setTime] = useState(0);
  return (
    <Modal title="Review AI changes" wide open onClose={onDiscard}>
      <p>{explanation}</p>
      <div className="scene-review-grid">
        <ReviewFrame project={before} time={time} title="Current scene" />
        <ReviewFrame project={after} time={time} title="Proposed scene" />
      </div>
      <label className="field">
        <span>Compare at {time.toFixed(2)} seconds</span>
        <input
          aria-label="Comparison time"
          type="range"
          min={0}
          max={Math.min(before.settings.duration, after.settings.duration)}
          step={0.05}
          value={time}
          onChange={(e) => setTime(Number(e.target.value))}
        />
      </label>
      <div className="modal-actions">
        <button onClick={onDiscard}>Discard changes</button>
        <button className="primary" onClick={onApply}>
          Apply changes
        </button>
      </div>
    </Modal>
  );
}
