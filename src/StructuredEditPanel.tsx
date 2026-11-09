import { useState } from "react";
import type { Project } from "../shared/project";
import type { RpcResults } from "../shared/rpc";
import { bridge, download } from "./bridge";
import { Modal } from "./components";
import { structuredClipTiming } from "../shared/structured-edit-timing";
import { sceneEditTargets } from "../shared/structured-edit";
import {
  StructuredEditResult,
  supportsStructuredClip,
} from "./StructuredEditResult";

export function StructuredEditPanel({
  project,
  appliedProject,
  clipId,
  onClose,
}: {
  project: Project;
  appliedProject: Project;
  clipId: string;
  onClose: () => void;
}) {
  const clip = project.workflow?.scenes.find((scene) => scene.id === clipId);
  const applied = appliedProject.workflow?.scenes.find(
    (scene) => scene.id === clipId,
  );
  const [enteredValue, setValue] = useState<string>();
  const [targetIndex, setTargetIndex] = useState(0);
  const [scope, setScope] = useState<"clip" | "shared">("clip");
  const [useApplied, setUseApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [intake, setIntake] = useState(false);
  const [exported, setExported] = useState<{
    snapshot: string;
    result: RpcResults["structuredEditPackage"];
  }>();
  const pending =
    !!clip &&
    !!applied &&
    (clip.html !== applied.html ||
      clip.css !== applied.css ||
      clip.js !== applied.js);
  const source = pending && useApplied ? applied : clip;
  const scene = source?.structuredEdit;
  const targets = scene ? sceneEditTargets(scene) : [];
  const target = targets[targetIndex] ?? targets[0];
  const value =
    enteredValue ??
    (target?.property === "glowIntensity" ? "0.8" : String(target?.value ?? ""));
  const timing = clip && target && structuredClipTiming(clip, target);
  const supported =
    !!target && supportsStructuredClip(project, clip, source, target);
  const snapshot = JSON.stringify({
    scene,
    clip,
    settings: project.settings,
    value,
    useApplied,
    scope,
    target,
  });
  const ready = supported && (!pending || useApplied);
  const validValue =
    !!target &&
    value.trim() !== "" &&
    Number(value) >= target.min &&
    Number(value) <= target.max;
  const canCopy = ready && exported?.snapshot === snapshot;
  const resetExport = () => {
    setExported(undefined);
    setError("");
    setNotice("");
  };
  const exportZip = async () => {
    if (!scene || !timing || !ready || !validValue || busy) return;
    resetExport();
    setBusy(true);
    try {
      const result = await bridge.call(
        "structuredEditPackage",
        scene,
        Number(value),
        clipId,
        { sourceOffset: timing.sourceOffset, duration: timing.duration },
        scope,
        target && {
          nodeId: target.nodeId,
          property: target.property,
          keyframeId: target.keyframeId,
        },
      );
      setExported({ snapshot, result });
      download(result);
      setNotice("ZIP ready. Copy the prompt and send it with the ZIP.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  if (intake)
    return (
      <StructuredEditResult
        project={project}
        clipId={clipId}
        onBack={() => setIntake(false)}
        onApplied={onClose}
      />
    );
  return (
    <Modal title="Edit / Update" open onClose={onClose}>
      <p>{clip?.title ?? "The selected clip is no longer available."}</p>
      {scene && target && (
        <>
          <p>
            Source revision {scene.revision} ·{" "}
            {scope === "clip" ? "This clip only" : "All clips using this scene"}
          </p>
          <label className="field">
            <span>Edit scope</span>
            <select
              value={scope}
              disabled={busy}
              onChange={(event) => {
                setScope(event.target.value === "shared" ? "shared" : "clip");
                resetExport();
              }}
            >
              <option value="clip">This clip only</option>
              <option value="shared">All clips using this scene</option>
            </select>
          </label>
          {targets.length > 1 && (
            <label className="field">
              <span>Editable property</span>
              <select
                value={targetIndex}
                disabled={busy}
                onChange={(event) => {
                  const index = Number(event.target.value);
                  setTargetIndex(index);
                  setValue(String(targets[index].value));
                  resetExport();
                }}
              >
                {targets.map((item, index) => (
                  <option key={index} value={index}>
                    {item.nodeId}.{item.property}
                  </option>
                ))}
              </select>
            </label>
          )}
          {timing && timing.sourceOffset > 0 && (
            <p>
              Source keyframe at {timing.sourceTime.toFixed(3)}s ·{" "}
              {timing.clipTime.toFixed(3)}s into this clip
            </p>
          )}
          <label>
            {target?.property === "glowIntensity"
              ? "Glow"
              : target?.nodeId + "." + target?.property}{" "}
            at {((target?.frame ?? 0) / scene.fps).toFixed(3)}s
            <input
              type="number"
              min={target?.min}
              max={target?.max}
              step="any"
              value={value}
              disabled={busy}
              onChange={(event) => {
                setValue(event.target.value);
                resetExport();
              }}
            />
          </label>
          <p>Package contents</p>
          <ul>
            <li>Task, manifest and Edit result schema</li>
            <li>
              {scene.star ? "Scene source and Canvas module" : "Scene source"}
            </li>
            <li>
              Required PNG of the keyframe at source revision {scene.revision}
            </li>
          </ul>
        </>
      )}
      {pending && (
        <label>
          <input
            type="checkbox"
            checked={useApplied}
            disabled={busy}
            onChange={(event) => {
              setUseApplied(event.target.checked);
              resetExport();
            }}
          />
          Use last applied source. Close this panel to apply pending edits
          first.
        </label>
      )}
      {!supported && !(pending && !useApplied) && (
        <p role="alert">
          {scene && !target
            ? "This scene has no editable keyframes."
            : "Edit requires an unlocked structured clip containing the source keyframe, with its original dimensions and frame rate in seek mode."}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button onClick={onClose}>Close</button>
        <button onClick={() => setIntake(true)}>Import AI result</button>
        <button
          disabled={!ready || !validValue || busy}
          onClick={() => void exportZip()}
        >
          {busy ? "Preparing ZIP…" : "Download ZIP"}
        </button>
        <button
          disabled={!canCopy || busy}
          onClick={async () => {
            if (!canCopy || !exported) return;
            try {
              await navigator.clipboard.writeText(exported.result.prompt);
              setNotice("Prompt copied.");
            } catch {
              setError(
                "Clipboard access failed. Select and copy the prompt below.",
              );
            }
          }}
        >
          Copy prompt
        </button>
      </div>
      {canCopy && (
        <textarea
          readOnly
          aria-label="Exported prompt"
          value={exported?.result.prompt}
        />
      )}
    </Modal>
  );
}
