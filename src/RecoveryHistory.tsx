import { useEffect, useState } from "react";
import { bridge } from "./bridge";
import { Modal } from "./components";
import { useStudio } from "./store";
import type { Project } from "../shared/project";

export function downloadRecoveryCopy() {
  const project = useStudio.getState().project;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(project)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download =
    project.name.replace(/[^a-z0-9 _.-]/gi, "_") + "-recovery.frame";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RecoveryHistory({
  open,
  onClose,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (
    project: Project,
    editor: { sceneChats?: Record<string, any[]> },
  ) => void;
}) {
  const [versions, setVersions] = useState<
    { id: string; name: string; reason: string; created: number }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError("");
    void bridge
      .call("recoveryList")
      .then((items) => {
        if (alive) setVersions(items);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [open]);
  return (
    <Modal title="Recovery history" open={open} onClose={onClose}>
      <p>
        The latest 20 checkpoints are kept locally. Restoring creates a
        checkpoint of your current workspace.
      </p>
      <button onClick={downloadRecoveryCopy}>Download this workspace</button>
      {error && <p role="alert">{error}</p>}
      {!versions.length && (
        <p>
          No recovery versions yet. Checkpoints are created before replacing
          projects or storyboards.
        </p>
      )}
      <div className="recovery-list">
        {versions.map((version) => (
          <article key={version.id}>
            <strong>{version.name}</strong>
            <span>
              {version.reason} · {new Date(version.created).toLocaleString()}
            </span>
            <button
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    "Restore this version? Your current workspace will be checkpointed first.",
                  )
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  await bridge.call(
                    "checkpoint",
                    "Before restoring recovery version",
                    useStudio.getState().project,
                  );
                  const snapshot = await bridge.call(
                    "recoveryRestore",
                    version.id,
                  );
                  onRestore(snapshot.project, snapshot.editor);
                  onClose();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Restore version
            </button>
          </article>
        ))}
      </div>
    </Modal>
  );
}
