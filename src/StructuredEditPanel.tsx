import { useState } from "react";
import type { Project, Scene } from "../shared/project";
import type { RpcResults } from "../shared/rpc";
import { structuredStarCode } from "../shared/structured-star";
import { bridge, download } from "./bridge";
import { Modal } from "./components";

function matchesSource(scene: Scene | undefined) {
  if (!scene?.structuredEdit) return false;
  const code = structuredStarCode(scene.structuredEdit);
  return (
    scene.html === code.html && scene.css === code.css && scene.js === code.js
  );
}

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
  const [value, setValue] = useState("0.8");
  const [useApplied, setUseApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
  const duration = scene ? scene.durationFrames / scene.fps : 0;
  const supported =
    !!scene &&
    !!clip &&
    !clip.locked &&
    !clip.sourceOffset &&
    clip.duration === duration &&
    project.settings.speed === 1 &&
    project.settings.width === scene.width &&
    project.settings.height === scene.height &&
    project.settings.fps === scene.fps &&
    project.settings.timing === "seek" &&
    matchesSource(source);
  const snapshot = JSON.stringify({
    scene,
    clip,
    settings: project.settings,
    value,
    useApplied,
  });
  const ready = supported && (!pending || useApplied);
  const validValue =
    value.trim() !== "" && Number(value) >= 0 && Number(value) <= 1;
  const canCopy = ready && exported?.snapshot === snapshot;
  const resetExport = () => {
    setExported(undefined);
    setError("");
    setNotice("");
  };
  const exportZip = async () => {
    if (!scene || !ready || !validValue || busy) return;
    resetExport();
    setBusy(true);
    try {
      const result = await bridge.call(
        "structuredEditPackage",
        scene,
        Number(value),
        clipId,
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
  return (
    <Modal title="Edit / Update" open onClose={onClose}>
      <p>{clip?.title ?? "The selected clip is no longer available."}</p>
      {scene && (
        <>
          <p>Source revision {scene.revision} · This clip only</p>
          <label>
            Glow at {(scene.star.keyframe.frame / scene.fps).toFixed(3)}s
            <input
              type="number"
              min="0"
              max="1"
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
            <li>Scene source and Canvas module</li>
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
          Use the untrimmed structured Edit fixture at its original dimensions,
          frame rate and normal speed. Modified source and legacy clips are
          outside this milestone.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button onClick={onClose}>Close</button>
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
