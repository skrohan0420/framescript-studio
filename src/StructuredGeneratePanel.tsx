import { useState } from "react";
import { sceneEditTargets } from "../shared/structured-edit";
import {
  generateInputSchema,
  parseGenerateResult,
  prepareGeneratedScene,
  type GenerateInput,
  type GenerateRequest,
  type GenerateResult,
} from "../shared/structured-generate";
import type { RpcResults } from "../shared/rpc";
import { bridge, download } from "./bridge";
import { Modal } from "./components";
import { SceneReview } from "./SceneReview";
import { useStudio } from "./store";

export function StructuredGeneratePanel({
  initial,
  onClose,
  onApplied,
}: {
  initial: GenerateInput;
  onClose: () => void;
  onApplied: () => void;
}) {
  const project = useStudio((state) => state.project);
  const [brief, setBrief] = useState(initial.brief);
  const [references, setReferences] = useState<
    NonNullable<GenerateInput["references"]>
  >([]);
  const [exported, setExported] =
    useState<RpcResults["structuredGeneratePackage"]>();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{
    task: GenerateRequest;
    result: GenerateResult;
    session: number;
  }>();

  const run = async (action: () => Promise<void>) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const exportZip = () =>
    run(async () => {
      setExported(undefined);
      const result = await bridge.call(
        "structuredGeneratePackage",
        generateInputSchema.parse({ ...initial, brief, references }),
      );
      setExported(result);
      download(result);
      setNotice(
        "ZIP ready. Copy the prompt and send both in the same AI message.",
      );
    });
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
        <button onClick={() => setReview(undefined)}>Back to Generate</button>
      </Modal>
    );
  }
  return (
    <Modal title="Generate structured scene" open onClose={onClose}>
      <p>
        Create a scene with shapes, a star, or an on-screen title. Shapes can
        have editable position and opacity tracks.
      </p>
      <p>
        {initial.width} × {initial.height} · {initial.fps} fps ·{" "}
        {(initial.durationFrames / initial.fps).toFixed(3)}s
      </p>
      <label className="field">
        Scene brief
        <textarea
          value={brief}
          disabled={busy}
          onChange={(event) => {
            setBrief(event.target.value);
            setExported(undefined);
            setNotice("");
          }}
        />
      </label>
      <label className="field">
        Reference images and example code
        <input
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.js,.css,.html,.json,.txt"
          disabled={busy}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void run(async () => {
              if (references.length + files.length > 6)
                throw Error("Choose at most six references.");
              const added: typeof references = [];
              for (const file of files) {
                if (file.size > 2 * 1024 * 1024)
                  throw Error("Each reference must fit within 2 MB.");
                const extension = file.name.split(".").pop()?.toLowerCase();
                const kind =
                  extension === "png"
                    ? "png"
                    : extension === "jpg" || extension === "jpeg"
                      ? "jpeg"
                      : extension === "webp"
                        ? "webp"
                        : "code";
                if (
                  ![
                    "png",
                    "jpg",
                    "jpeg",
                    "webp",
                    "js",
                    "css",
                    "html",
                    "json",
                    "txt",
                  ].includes(extension ?? "")
                )
                  throw Error(
                    "Choose PNG, JPEG, WebP or a supported text code file.",
                  );
                const data = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onerror = () =>
                    reject(Error("Could not read " + file.name));
                  reader.onload = () =>
                    resolve(String(reader.result).split(",")[1]);
                  reader.readAsDataURL(file);
                });
                added.push({ name: file.name, kind, data });
              }
              generateInputSchema.parse({
                ...initial,
                brief: brief || "Draft",
                references: [...references, ...added],
              });
              setReferences([...references, ...added]);
              setExported(undefined);
            });
          }}
        />
      </label>
      <p>
        Up to six references, 2 MB each and 6 MB total. Included as visual
        guidance or example code.
      </p>
      {references.length > 0 && (
        <ul>
          {references.map((reference, index) => (
            <li key={index}>
              {reference.name} ·{" "}
              {reference.kind === "code" ? "Example code" : "Visual reference"}
              <button
                disabled={busy}
                aria-label={"Remove reference " + reference.name}
                onClick={() => {
                  setReferences(
                    references.filter((_, position) => position !== index),
                  );
                  setExported(undefined);
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="modal-actions">
        <button
          disabled={busy || !brief.trim()}
          onClick={() => void exportZip()}
        >
          Download ZIP
        </button>
        <button
          disabled={busy || !exported}
          onClick={() =>
            void run(async () => {
              if (!exported) return;
              await navigator.clipboard.writeText(exported.prompt);
              setNotice("Prompt copied.");
            })
          }
        >
          Copy Generate prompt
        </button>
      </div>
      {exported && (
        <textarea
          readOnly
          aria-label="Exported Generate prompt"
          value={exported.prompt}
        />
      )}
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
      {notice && <p role="status">{notice}</p>}
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
