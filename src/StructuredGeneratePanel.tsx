import { useState } from "react";
import { useStatusActivity } from "./editor-status";
import { sceneEditTargets } from "../shared/structured-edit";
import {
  parseGenerateResult,
  prepareGeneratedScene,
  type GenerateRequest,
  type GenerateResult,
} from "../shared/structured-generate";
import { bridge } from "./bridge";
import { Modal } from "./components";
import { SceneReview } from "./SceneReview";
import { useStudio } from "./store";

export function StructuredGeneratePanel({
  onClose,
  onApplied,
}: {
  onClose: () => void;
  onApplied: () => void;
}) {
  const project = useStudio((state) => state.project);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useStatusActivity(busy ? "Validating generated scene…" : "");
  const [review, setReview] = useState<{
    task: GenerateRequest;
    result: GenerateResult;
    session: number;
  }>();

  const run = async (action: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const validate = () =>
    run(async () => {
      const session = useStudio.getState().session;
      if (text.length > 65536 || (file && file.size > 65536))
        throw Error("The scene result exceeds the 64 KB limit.");
      if (file && !/\.(mjs|js|json)$/i.test(file.name))
        throw Error(
          "Upload a generated .mjs or .js file, or a legacy .json result.",
        );
      const pasted = text.trim() ? parseGenerateResult(text) : undefined;
      const uploaded = file
        ? parseGenerateResult(await file.text())
        : undefined;
      if (
        pasted &&
        uploaded &&
        JSON.stringify(pasted) !== JSON.stringify(uploaded)
      )
        throw Error("The pasted and uploaded results differ.");
      const result = pasted ?? uploaded;
      if (!result) throw Error("Paste or upload the AI scene result.");
      const task = await bridge.call(
        "structuredGenerateRequest",
        result.requestId,
      );
      if (!task)
        throw Error("No matching Generate task was saved in this browser.");
      const current = useStudio.getState();
      if (current.session !== session)
        throw Error(
          "The project changed. Open the original project and try again.",
        );
      prepareGeneratedScene(current.project, task, result);
      setReview({ task, result, session });
    });
  if (review) {
    let candidate;
    let conflict = "";
    try {
      candidate = prepareGeneratedScene(project, review.task, review.result);
    } catch (failure) {
      conflict = (failure as Error).message;
    }
    const scene = review.result.scene;
    const generated = candidate && {
      ...project,
      ...candidate,
      workflow: undefined,
      assets: [],
      audio: undefined,
    };
    if (generated)
      return (
        <SceneReview
          after={generated}
          initialTime={(sceneEditTargets(scene)[0]?.frame ?? 0) / scene.fps}
          explanation={
            <>
              <p>
                {scene.title} · {(scene.durationFrames / scene.fps).toFixed(3)}s
                · New timeline clip
              </p>
              {error && <p role="alert">{error}</p>}
            </>
          }
          onDiscard={() => setReview(undefined)}
          onApply={() => {
            const current = useStudio.getState();
            try {
              if (current.session !== review.session)
                throw Error("The project changed during review.");
              current.change(
                prepareGeneratedScene(
                  current.project,
                  review.task,
                  review.result,
                ),
                "Add generated scene",
              );
              if (useStudio.getState().revision === current.revision)
                throw Error(
                  useStudio.getState().error ||
                    "The generated scene could not be added.",
                );
              onApplied();
            } catch (failure) {
              setError((failure as Error).message);
            }
          }}
        />
      );
    return (
      <Modal
        title="Review AI changes"
        open
        onClose={() => setReview(undefined)}
      >
        <p role="alert">{conflict}</p>
        <button onClick={() => setReview(undefined)}>Back to import</button>
      </Modal>
    );
  }
  return (
    <Modal title="Import generated scene" open onClose={onClose}>
      <label className="field">
        Paste generated scene code
        <textarea
          value={text}
          disabled={busy}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <label className="field">
        Upload scene result
        <input
          type="file"
          accept=".mjs,.js,.json"
          disabled={busy}
          onChange={(event) => setFile(event.target.files?.[0])}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button
          disabled={busy || (!text.trim() && !file)}
          onClick={() => void validate()}
        >
          Review scene result
        </button>
      </div>
    </Modal>
  );
}
