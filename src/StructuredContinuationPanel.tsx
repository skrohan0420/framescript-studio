import { useStatusActivity, useStatusNotice } from "./editor-status";
import { useState } from "react";
import {
  extendInputSchema,
  parseExtendResult,
  prepareExtension,
  type ExtendTask,
  type ExtendResult,
} from "../shared/structured-extend";
import { structuredExtensionTiming } from "../shared/structured-edit-timing";
import { structuredStarCode } from "../shared/structured-star";
import { newProject, type Project } from "../shared/project";
import type { RpcResults } from "../shared/rpc";
import { bridge, download } from "./bridge";
import { Modal } from "./components";
import { SceneReview } from "./SceneReview";
import { useStudio } from "./store";
import {
  ContextFrame,
  PromptReferences,
  validContextFrame,
} from "./PromptReferences";
import {
  contextFrameRange,
  structuredContextLimitMiB,
  type PromptReferences as References,
} from "../shared/prompt-references";

export function StructuredContinuationPanel({
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
  const timing = structuredExtensionTiming(project, clipId);
  const scene = timing?.clip.structuredEdit;
  const [brief, setBrief] = useState(
    "Continue the star animation smoothly for one second.",
  );
  const [addedFrames, setAddedFrames] = useState(String(scene?.fps ?? 30));
  const [exported, setExported] = useState<{
    fingerprint: string;
    result: RpcResults["structuredExtendPackage"];
  }>();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const notify = useStatusNotice();
  const [busy, setBusy] = useState(false);
  useStatusActivity(busy ? "Processing AI handoff…" : "");
  const [references, setReferences] = useState<References>([]);
  const [capture, setCapture] = useState("");
  const placement = timing && {
    sourceOffset: timing.clip.sourceOffset ?? 0,
    duration: timing.visualDuration,
  };
  const { first, last } =
    scene && placement
      ? contextFrameRange(scene, placement)
      : { first: 0, last: -1 };
  const captureFrame = capture === "" ? undefined : Number(capture);
  const validCapture = validContextFrame(captureFrame, first, last);
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState<{
    task: ExtendTask;
    result: ExtendResult;
    project: Project;
    session: number;
  }>();
  const fingerprint = JSON.stringify([
    scene,
    timing?.handoff,
    timing?.clip.duration,
    brief,
    addedFrames,
    capture,
  ]);
  const run = async (action: () => Promise<void>) => {
    setError("");

    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (review) {
    let candidate;
    let conflict =
      review.project !== project
        ? "The timeline changed during review. Return and review the result again."
        : "";
    try {
      candidate = prepareExtension(
        project,
        clipId,
        review.task,
        review.result,
        review.task.requestId,
      );
    } catch (failure) {
      conflict = (failure as Error).message;
    }
    const original = review.task.input.scene;
    const updated = candidate?.workflow?.scenes.find(
      (clip) => clip.id === clipId,
    )?.structuredEdit;
    const preview = (data: typeof original) => {
      const base = newProject();
      return {
        ...base,
        ...structuredStarCode(data),
        settings: {
          ...base.settings,
          width: data.width,
          height: data.height,
          fps: data.fps,
          duration: data.durationFrames / data.fps,
        },
      };
    };
    const before = preview(original);
    const after = updated ? preview(updated) : before;
    const start = review.result.startFrame / original.fps;
    const end = review.result.endFrame / original.fps;
    const growth = timing ? Math.max(0, timing.visualDuration + end - start - timing.clip.duration) : 0;
    const following = growth > 0 ? timing?.following ?? [] : [];
    return (
      <SceneReview
        before={before}
        after={after}
        initialTime={start}
        comparisonDuration={end}
        applyDisabled={!!conflict || (following.length > 0 && !confirmed)}
        explanation={
          <>
            <p>
              {original.title} · Source revision {original.revision} · Continue
              from {start.toFixed(3)}s to {end.toFixed(3)}s
            </p>
            <p>
              A separate source will be created for this clip. Review the
              handoff and new animation with the slider.
            </p>
            {following.length > 0 && (
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                Move following clips later by {growth.toFixed(3)}s:{" "}
                {following.map((clip) => clip.title).join(", ")}.
              </label>
            )}
            {(conflict || error) && <p role="alert">{conflict || error}</p>}
          </>
        }
        onDiscard={() => {
          setReview(undefined);
          setConfirmed(false);
        }}
        onApply={() => {
          const state = useStudio.getState();
          try {
            if (
              state.session !== review.session ||
              state.project !== review.project
            )
              throw Error("The project changed during review.");
            if (following.length && !confirmed)
              throw Error("Confirm the timeline movement before applying.");
            state.change(
              prepareExtension(
                state.project,
                clipId,
                review.task,
                review.result,
                review.task.requestId,
              ),
              "Apply AI continuation",
            );
            if (useStudio.getState().revision === state.revision)
              throw Error(
                useStudio.getState().error ||
                  "The continuation could not be applied.",
              );
            onApplied();
          } catch (failure) {
            setError((failure as Error).message);
          }
        }}
      />
    );
  }
  return (
    <Modal title="Generate continuation" open onClose={onBack}>
      <p>
        Continue the built-in star glow from the selected clip’s endpoint. This
        version supports one continuation per source at a frame boundary.
      </p>
      <label className="field">
        Continuation brief
        <textarea
          value={brief}
          disabled={busy}
          onChange={(event) => {
            setBrief(event.target.value);
            setExported(undefined);
          }}
        />
      </label>
      <label className="field">
        Frames to add
        <input
          type="number"
          min="1"
          step="1"
          value={addedFrames}
          disabled={busy}
          onChange={(event) => {
            setAddedFrames(event.target.value);
            setExported(undefined);
          }}
        />
      </label>
      <PromptReferences
        references={references}
        busy={busy}
        run={run}
        onChange={(files) => {
          setReferences(files);
          setExported(undefined);

        }}
      />
      <ContextFrame
        value={capture}
        onChange={(frame) => {
          setCapture(frame);
          setExported(undefined);

        }}
        busy={busy}
        first={first}
        last={last}
      />
      <p>
        The Extend ZIP can include up to {structuredContextLimitMiB} MiB of
        context before compression.
      </p>
      {!validCapture && (
        <p role="alert">Choose a whole source frame before the handoff.</p>
      )}
      <div className="modal-actions">
        <button
          disabled={busy || !scene || !placement || !validCapture}
          onClick={() =>
            void run(async () => {
              if (!scene || !placement || !validCapture) return;
              setExported(undefined);
              const input = extendInputSchema.parse({
                scene,
                clipId,
                placement,
                addedFrames: Number(addedFrames),
                brief,
                context: { references, captureFrame },
              });
              const result = await bridge.call(
                "structuredExtendPackage",
                input,
              );
              setExported({ fingerprint, result });
              download(result);
              notify("ZIP ready. Send it with the copied prompt.");
            })
          }
        >
          Download Extend ZIP
        </button>
        <button
          disabled={busy || exported?.fingerprint !== fingerprint}
          onClick={() =>
            void run(async () => {
              if (exported?.fingerprint !== fingerprint) return;
              await navigator.clipboard.writeText(exported.result.prompt);
              notify("Prompt copied.");
            })
          }
        >
          Copy Extend prompt
        </button>
      </div>
      {exported?.fingerprint === fingerprint && (
        <textarea
          readOnly
          aria-label="Exported Extend prompt"
          value={exported.result.prompt}
        />
      )}
      <label className="field">
        Paste AI extension
        <textarea
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label className="field">
        Upload extension result
        <input
          type="file"
          accept=".mjs,.js,.json"
          disabled={busy}
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy || (!text.trim() && !file)}
        onClick={() =>
          void run(async () => {
            const session = useStudio.getState().session;
            if (text.length > 65536 || (file && file.size > 65536))
              throw Error("The extension exceeds the 64 KB limit.");
            if (file && !/\.(mjs|js|json)$/i.test(file.name))
              throw Error("Upload an extension result as .mjs, .js, or .json.");
            const pasted = text.trim() ? parseExtendResult(text) : undefined;
            const uploaded = file
              ? parseExtendResult(await file.text())
              : undefined;
            if (
              pasted &&
              uploaded &&
              JSON.stringify(pasted) !== JSON.stringify(uploaded)
            )
              throw Error("The pasted and uploaded results differ.");
            const result = pasted ?? uploaded;
            if (!result) throw Error("Paste or upload the complete result.");
            const task = await bridge.call(
              "structuredExtendRequest",
              result.requestId,
            );
            if (!task)
              throw Error("No matching Extend request was saved here.");
            const state = useStudio.getState();
            if (state.session !== session) throw Error("The project changed.");
            prepareExtension(
              state.project,
              clipId,
              task,
              result,
              task.requestId,
            );
            setReview({ task, result, project: state.project, session });
            setConfirmed(false);
          })
        }
      >
        Review extension
      </button>
    </Modal>
  );
}
