import { useMemo, useState } from "react";
import { newProject, type Project, type Scene } from "../shared/project";
import type { RpcResults } from "../shared/rpc";
import {
  parseEditResult,
  prepareEditCandidate,
} from "../shared/structured-edit";
import {
  structuredStarCode,
  type StructuredEditScene,
} from "../shared/structured-star";
import { bridge } from "./bridge";
import { Modal } from "./components";
import { SceneReview } from "./SceneReview";
import { useStudio } from "./store";

type SavedTask = NonNullable<RpcResults["structuredEditRequest"]>;
type Review = {
  task: SavedTask;
  candidate: StructuredEditScene;
  before: Project;
  after: Project;
  session: number;
};
const resultSizeLimit = 64 * 1024;

export function supportsStructuredClip(
  project: Project,
  clip?: Scene,
  source = clip,
) {
  const scene = source?.structuredEdit;
  if (!scene || !clip || clip.locked || clip.sourceOffset) return false;
  const { width, height, fps, speed, timing } = project.settings;
  const code = structuredStarCode(scene);
  return (
    clip.duration === scene.durationFrames / scene.fps &&
    width === scene.width &&
    height === scene.height &&
    fps === scene.fps &&
    speed === 1 &&
    timing === "seek" &&
    source.html === code.html &&
    source.css === code.css &&
    source.js === code.js &&
    (project.workflow?.selectedId !== clip.id ||
      source !== clip ||
      (project.html === code.html &&
        project.css === code.css &&
        project.js === code.js))
  );
}

function projectForPreview(scene: StructuredEditScene): Project {
  const base = newProject();
  return {
    ...base,
    ...structuredStarCode(scene),
    settings: {
      ...base.settings,
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      duration: scene.durationFrames / scene.fps,
    },
  };
}

function taskConflict(project: Project, clipId: string, task: SavedTask) {
  const clip = project.workflow?.scenes.find((item) => item.id === clipId);
  if (
    task.scope !== "clip" ||
    task.clipId !== clipId ||
    clip?.structuredEdit?.sceneId !== task.scene.sceneId
  )
    return "This result targets a different clip or scene.";
  if (JSON.stringify(clip.structuredEdit) !== JSON.stringify(task.scene))
    return "The source changed after this task was exported.";
  if (!supportsStructuredClip(project, clip))
    return "The clip source, lock or playback settings changed after export.";
  return "";
}

export function StructuredEditResult({
  project,
  clipId,
  onBack,
  onApplied,
}: {
  project: Project;
  clipId: string;
  onBack: () => void;
  onApplied: () => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [repair, setRepair] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review>();
  const conflict = useMemo(
    () => (review ? taskConflict(project, clipId, review.task) : ""),
    [project, clipId, review],
  );
  const currentRevision = project.workflow?.scenes.find(
    (clip) => clip.id === clipId,
  )?.structuredEdit?.revision;
  const clearFeedback = () => {
    setError("");
    setRepair("");
    setCopied(false);
  };

  const validate = async () => {
    if (busy) return;
    const session = useStudio.getState().session;
    let task: SavedTask | null = null;
    let canRepair = true;
    clearFeedback();
    setBusy(true);
    try {
      if (
        text.length > resultSizeLimit ||
        (file && file.size > resultSizeLimit)
      )
        throw Error("This Edit result exceeds the 64 KB patch limit.");
      if (file && !file.name.toLowerCase().endsWith(".json"))
        throw Error(
          "Upload the .json patch for this Edit task. This contract uses a self-contained JSON result.",
        );
      const pasted = text.trim() ? parseEditResult(text) : undefined;
      const uploaded = file ? parseEditResult(await file.text()) : undefined;
      if (
        pasted &&
        uploaded &&
        JSON.stringify(pasted) !== JSON.stringify(uploaded)
      )
        throw Error(
          "The pasted and uploaded patches differ. Keep one result or provide matching copies.",
        );
      const patch = pasted ?? uploaded;
      if (!patch) throw Error("Paste the AI result or upload its JSON file.");
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          patch.requestId,
        )
      )
        throw Error(
          "The request ID must match the UUID in your exported task.",
        );
      task = await bridge.call("structuredEditRequest", patch.requestId);
      if (!task) {
        canRepair = false;
        throw Error(
          "No matching request was saved here. Open the original project or export a fresh task.",
        );
      }
      const state = useStudio.getState();
      if (
        state.session !== session ||
        task.clipId !== clipId ||
        state.project.workflow?.scenes.find((clip) => clip.id === clipId)
          ?.structuredEdit?.sceneId !== task.scene.sceneId
      ) {
        canRepair = false;
        throw Error(
          "This result targets a different clip or scene. Open its original clip or export a fresh task.",
        );
      }
      const candidate = prepareEditCandidate(task.scene, task.request, patch);
      setReview({
        task,
        candidate,
        session,
        before: projectForPreview(task.scene),
        after: projectForPreview(candidate),
      });
    } catch (failure) {
      const message =
        failure instanceof Error ? failure.message : String(failure);
      setError(message);
      if (
        canRepair &&
        !/different project|predates project matching/.test(message)
      )
        setRepair(
          `Revise your previous response using the original FrameScript task ZIP. Return only the complete JSON patch specified in OUTPUT_CONTRACT.md. Preserve the request ID, target, base revision and allowed scope. FrameScript reported: ${message}`,
        );
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!review) return;
    const state = useStudio.getState();
    const workflow = state.project.workflow;
    const problem = taskConflict(state.project, clipId, review.task);
    if (state.session !== review.session || !workflow || problem) {
      setError(
        problem || "The project changed during review. Export a fresh task.",
      );
      return;
    }
    const structuredEdit = {
      ...review.candidate,
      revision: review.task.scene.revision + 1,
    };
    const code = structuredStarCode(structuredEdit);
    state.change(
      {
        ...(workflow.selectedId === clipId ? code : {}),
        workflow: {
          ...workflow,
          scenes: workflow.scenes.map((clip) =>
            clip.id === clipId ? { ...clip, ...code, structuredEdit } : clip,
          ),
        },
      },
      "Apply structured AI Edit",
    );
    if (useStudio.getState().revision === state.revision) {
      setError(
        useStudio.getState().error || "The reviewed edit could not be applied.",
      );
      return;
    }
    onApplied();
  };

  if (review) {
    const { scene } = review.task;
    const time = scene.star.keyframe.frame / scene.fps;
    const lastTime = (scene.durationFrames - 1) / scene.fps;
    return (
      <SceneReview
        before={review.before}
        after={review.after}
        initialTime={time}
        applyDisabled={!!conflict}
        explanation={
          <>
            <p>
              {scene.title} · This clip only · AI base revision {scene.revision}{" "}
              · Current revision {currentRevision ?? "unavailable"}
            </p>
            <p>
              Glow at {time.toFixed(3)}s: {scene.star.keyframe.value} →{" "}
              {review.candidate.star.keyframe.value}
            </p>
            <p>
              Glow interpolates up to the keyframe and holds afterward. Rendered
              frames may change through {lastTime.toFixed(3)}s.
            </p>
            {(conflict || error) && <p role="alert">{conflict || error}</p>}
          </>
        }
        actions={
          conflict && <button onClick={onBack}>Export fresh task</button>
        }
        onApply={apply}
        onDiscard={onBack}
      />
    );
  }

  return (
    <Modal title="Import AI result" open onClose={onBack}>
      <p>
        Paste the AI patch, upload its JSON file, or provide matching copies.
      </p>
      <label className="field">
        <span>Paste AI result</span>
        <textarea
          value={text}
          disabled={busy}
          onChange={(event) => {
            setText(event.target.value);
            clearFeedback();
          }}
        />
      </label>
      <label className="field">
        <span>Upload result file</span>
        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            clearFeedback();
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {copied && <p role="status">Repair prompt copied.</p>}
      {repair && (
        <textarea readOnly aria-label="Repair prompt" value={repair} />
      )}
      <div className="modal-actions">
        <button onClick={onBack}>Back to Edit / Update</button>
        {repair && (
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(repair);
                setCopied(true);
              } catch {
                setError(
                  "Clipboard access failed. Select and copy the repair prompt above.",
                );
              }
            }}
          >
            Copy repair prompt
          </button>
        )}
        <button
          className="primary"
          disabled={busy || (!text.trim() && !file)}
          onClick={() => void validate()}
        >
          {busy ? "Validating…" : "Review result"}
        </button>
      </div>
    </Modal>
  );
}
