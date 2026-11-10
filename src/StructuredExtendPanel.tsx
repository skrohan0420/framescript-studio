import { useState } from "react";
import type { Project } from "../shared/project";
import { structuredExtensionTiming } from "../shared/structured-edit-timing";
import { resizeVisual } from "../shared/timeline-edit";
import { Modal } from "./components";
import { useStudio } from "./store";
import { StructuredContinuationPanel } from "./StructuredContinuationPanel";

export function StructuredExtendPanel({
  project,
  clipId,
  onClose,
}: {
  project: Project;
  clipId: string;
  onClose: () => void;
}) {
  const timing = structuredExtensionTiming(project, clipId);
  const [seconds, setSeconds] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [error, setError] = useState("");
  const [continuation, setContinuation] = useState(false);
  const added = Number(seconds);
  const valid = !!timing && added > 0 && added <= timing.available + 1e-9;
  const growth = timing ? Math.max(0, timing.visualDuration + added - timing.clip.duration) : 0;
  const following = growth > 0 ? timing?.following ?? [] : [];
  const impact = JSON.stringify([
    added,
    timing?.projectEnd,
    timing?.handoff,
    timing?.clip.structuredEdit?.sceneId,
    timing?.clip.structuredEdit?.revision,
    following.map(({ id, title, duration }) => [id, title, duration]),
  ]);
  const apply = () => {
    if (!valid || !timing || (following.length && confirmed !== impact)) return;
    const state = useStudio.getState();
    if (state.project !== project) {
      setError(
        "The timeline changed. Review the current handoff and try again.",
      );
      return;
    }
    const { workflow, settings } = resizeVisual(
      project,
      clipId,
      timing.visualDuration + Math.min(added, timing.available),
    );
    state.change({ workflow, settings }, "Reveal more scene source");
    if (useStudio.getState().revision === state.revision) {
      setError(useStudio.getState().error || "The clip could not be extended.");
      return;
    }
    onClose();
  };
  if (continuation)
    return (
      <StructuredContinuationPanel
        project={project}
        clipId={clipId}
        onBack={() => setContinuation(false)}
        onApplied={onClose}
      />
    );
  return (
    <Modal title="Extend clip" open onClose={onClose}>
      {timing ? (
        <>
          <p>{timing.clip.title}</p>
          <p>
            Handoff at source {timing.handoff.toFixed(3)}s · combined timeline{" "}
            {timing.projectEnd.toFixed(3)}s.
          </p>
          <p>
            Last source frame before handoff: {timing.lastVisibleFrame}{" "}
            (zero-based).
          </p>
          <h3>Reveal more of the source</h3>
          <p>
            Available to reveal: {timing.available.toFixed(3)}s within the
            source and project limit.
          </p>
          {timing.available > 1e-9 && (
            <label className="field">
              <span>Source seconds to reveal</span>
              <input
                type="number"
                min="0"
                max={timing.available}
                step="any"
                value={seconds}
                onChange={(event) => {
                  setSeconds(event.target.value);
                  setConfirmed("");
                  setError("");
                }}
              />
            </label>
          )}
          {valid && following.length > 0 && (
            <label>
              <input
                type="checkbox"
                checked={confirmed === impact}
                onChange={(event) =>
                  setConfirmed(event.target.checked ? impact : "")
                }
              />
              Move following clips later by {growth.toFixed(3)}s:{" "}
              {following.map((clip) => clip.title).join(", ")}.
            </label>
          )}
          <h3>Generate new animation</h3>
          {timing.clip.structuredEdit?.star ? (
            <button onClick={() => setContinuation(true)}>
              Generate continuation
            </button>
          ) : (
            <p>Generated continuation is available for star glow.</p>
          )}
        </>
      ) : (
        <p role="alert">
          Select an unlocked structured clip with a valid source range.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button
          className="primary"
          disabled={!valid || (following.length > 0 && confirmed !== impact)}
          onClick={apply}
        >
          Reveal source time
        </button>
      </div>
    </Modal>
  );
}
