import { useStatusNotice } from "./editor-status";
import { useMemo, useState } from "react";
import { newProject, type Project, type Scene } from "../shared/project";
import type { RpcResults } from "../shared/rpc";
import {
  parseEditResult,
  prepareEditCandidate,
  sceneEditTargets,
  type editTargetSchema,
} from "../shared/structured-edit";
import {
  structuredStarCode,
  type StructuredEditScene,
} from "../shared/structured-star";
import { bridge } from "./bridge";
import { Modal } from "./components";
import { SceneReview } from "./SceneReview";
import { useStudio } from "./store";
import { structuredClipTiming } from "../shared/structured-edit-timing";
import { sceneOffset } from "../shared/workflow";
import type { z } from "zod";

type SavedTask = NonNullable<RpcResults["structuredEditRequest"]>;
type Review = {
  task: SavedTask;
  candidate: StructuredEditScene;
  before: Project;
  after: Project;
  session: number;
  reviewedImpact: string;
};
const resultSizeLimit = 64 * 1024;

export function supportsStructuredClip(
  project: Project,
  clip?: Scene,
  source = clip,
  target?: z.infer<typeof editTargetSchema>,
) {
  const scene = source?.structuredEdit;
  if (!scene || !clip || clip.locked || !structuredClipTiming(clip, target))
    return false;
  const { width, height, fps, timing } = project.settings;
  const code = structuredStarCode(scene);
  return (
    width === scene.width &&
    height === scene.height &&
    fps === scene.fps &&
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
    task.clipId !== clipId ||
    clip?.structuredEdit?.sceneId !== task.scene.sceneId
  )
    return "This result targets a different clip or scene.";
  if (JSON.stringify(clip.structuredEdit) !== JSON.stringify(task.scene))
    return "The source changed after this task was exported.";
  const placement = task.placement ?? {
    sourceOffset: 0,
    duration: task.scene.durationFrames / task.scene.fps,
  };
  if (
    placement.sourceOffset !== (clip.sourceOffset ?? 0) ||
    placement.duration !== clip.duration
  )
    return "The clip trim changed after this task was exported.";
  if (!supportsStructuredClip(project, clip, clip, task.request.allowedTarget))
    return "The clip source, lock or playback settings changed after export.";
  if (task.scope === "shared") {
    const code = structuredStarCode(task.scene);
    for (const item of affectedClips(project, task)) {
      if (
        item.locked ||
        JSON.stringify(item.structuredEdit) !== JSON.stringify(task.scene) ||
        item.html !== code.html ||
        item.css !== code.css ||
        item.js !== code.js ||
        (project.workflow?.selectedId === item.id &&
          (project.html !== code.html ||
            project.css !== code.css ||
            project.js !== code.js))
      )
        return "A shared clip is locked or its source differs. Resolve it before applying a shared edit.";
    }
  }
  return "";
}

function affectedClips(project: Project, task: SavedTask) {
  return (
    project.workflow?.scenes.filter((clip) =>
      task.scope === "shared"
        ? clip.structuredEdit?.sceneId === task.scene.sceneId
        : clip.id === task.clipId,
    ) ?? []
  );
}

function impactSignature(project: Project, task: SavedTask) {
  return JSON.stringify(
    affectedClips(project, task).map((clip) => [
      clip.id,
      clip.title,
      sceneOffset(project, clip.id),
      clip.sourceOffset ?? 0,
      clip.duration,
    ]),
  );
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
  const notify = useStatusNotice();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review>();
  const conflict = useMemo(
    () => (review ? taskConflict(project, clipId, review.task) : ""),
    [project, clipId, review],
  );
  const currentRevision = project.workflow?.scenes.find(
    (clip) => clip.id === clipId,
  )?.structuredEdit?.revision;
  const impactChanged =
    !!review && impactSignature(project, review.task) !== review.reviewedImpact;
  const clearFeedback = () => {
    setError("");
    setRepair("");
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
      if (file && !/\.(mjs|js|json)$/i.test(file.name))
        throw Error(
          "Upload an Edit result as .mjs, .js, or .json.",
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
      if (!patch) throw Error("Paste or upload the AI result.");
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
        reviewedImpact: impactSignature(state.project, task),
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
          `Revise your previous response using the original FrameScript task ZIP. Return only the complete patch in the format specified by OUTPUT_CONTRACT.md. Preserve the request ID, target, base revision and allowed scope. FrameScript reported: ${message}`,
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
    if (impactSignature(state.project, review.task) !== review.reviewedImpact) {
      setError(
        "Clip placements changed. Confirm the updated impact before applying.",
      );
      return;
    }
    const affected = new Set(
      affectedClips(state.project, review.task).map((clip) => clip.id),
    );
    const structuredEdit = {
      ...review.candidate,
      sceneId:
        review.task.scope === "clip" &&
        workflow.scenes.some(
          (clip) =>
            clip.id !== clipId &&
            clip.structuredEdit?.sceneId === review.task.scene.sceneId,
        )
          ? crypto.randomUUID()
          : review.candidate.sceneId,
      revision: review.task.scene.revision + 1,
    };
    const code = structuredStarCode(structuredEdit);
    state.change(
      {
        ...(affected.has(workflow.selectedId) ? code : {}),
        workflow: {
          ...workflow,
          scenes: workflow.scenes.map((clip) =>
            affected.has(clip.id) ? { ...clip, ...code, structuredEdit } : clip,
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
    const selected = sceneEditTargets(scene).find(
      (item) =>
        item.nodeId === review.task.request.allowedTarget.nodeId &&
        item.property === review.task.request.allowedTarget.property &&
        item.keyframeId === review.task.request.allowedTarget.keyframeId,
    )!;
    const changed = sceneEditTargets(review.candidate).find(
      (item) =>
        item.nodeId === selected.nodeId && item.property === selected.property,
    )!;
    const time = selected.frame / scene.fps;
    const lastTime = (scene.durationFrames - 1) / scene.fps;
    const clip = project.workflow?.scenes.find((item) => item.id === clipId);
    const timing = clip && structuredClipTiming(clip, selected);
    const siblings =
      project.workflow?.scenes.filter(
        (item) =>
          item.id !== clipId && item.structuredEdit?.sceneId === scene.sceneId,
      ) ?? [];
    return (
      <SceneReview
        before={review.before}
        after={review.after}
        initialTime={time}
        applyDisabled={!!conflict || impactChanged}
        explanation={
          <>
            <p>
              {scene.title} ·{" "}
              {review.task.scope === "shared"
                ? "All clips using this scene"
                : "This clip only"}{" "}
              · AI base revision {scene.revision} · Current revision{" "}
              {currentRevision ?? "unavailable"}
            </p>
            <p>
              {selected.property === "glowIntensity"
                ? "Glow"
                : selected.nodeId + "." + selected.property}{" "}
              at {time.toFixed(3)}s: {selected.value} → {changed.value}
            </p>
            {timing && (
              <p>
                Keyframe placement: {timing.clipTime.toFixed(3)}s into the clip,{" "}
                {(sceneOffset(project, clipId) + timing.clipTime).toFixed(3)}s
                on the combined timeline.
              </p>
            )}
            {review.task.scope === "shared" ? (
              <>
                <p>Affected clips and their visible source ranges:</p>
                <ul>
                  {affectedClips(project, review.task).map((item) => {
                    const start = item.sourceOffset ?? 0;
                    return (
                      <li key={item.id}>
                        {item.title} · {start.toFixed(3)}s to{" "}
                        {(start + item.duration).toFixed(3)}s
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              siblings.length > 0 && (
                <p>
                  Other clips keep their source:{" "}
                  {siblings.map((item) => item.title).join(", ")}.
                </p>
              )
            )}
            <p>
              The property interpolates up to the keyframe and holds afterward.
              Rendered frames may change through {lastTime.toFixed(3)}s.
            </p>
            {(conflict || impactChanged || error) && (
              <p role="alert">
                {conflict ||
                  (impactChanged
                    ? "Clip placements changed. Confirm the updated impact before applying."
                    : error)}
              </p>
            )}
          </>
        }
        actions={
          conflict ? (
            <button onClick={onBack}>Export fresh task</button>
          ) : (
            impactChanged && (
              <button
                onClick={() => {
                  setReview({
                    ...review,
                    reviewedImpact: impactSignature(project, review.task),
                  });
                  setError("");
                }}
              >
                Confirm updated impact
              </button>
            )
          )
        }
        onApply={apply}
        onDiscard={onBack}
      />
    );
  }

  return (
    <Modal title="Import AI result" open onClose={onBack}>
      <p>
        Paste the AI patch, upload the result file, or provide matching copies.
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
          accept=".mjs,.js,.json"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            clearFeedback();
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
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
                notify("Repair prompt copied.");
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
          Review result
        </button>
      </div>
    </Modal>
  );
}
