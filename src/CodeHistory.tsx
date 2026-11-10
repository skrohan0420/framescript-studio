import { useEffect, useState } from "react";
import type { CodeSnapshot, CodeVersion } from "../shared/rpc";
import { bridge } from "./bridge";
import { Modal } from "./components";
import { useStatusActivity } from "./editor-status";

export function CodeHistory({
  scene,
  readOnly,
  onClose,
  onRestore,
  onCompare,
}: {
  scene: string | null;
  readOnly: boolean;
  onClose: () => void;
  onRestore: (code: CodeSnapshot) => void;
  onCompare: (code: CodeSnapshot, language: keyof CodeSnapshot) => void;
}) {
  const [versions, setVersions] = useState<CodeVersion[] | null>(null);
  const [version, setVersion] = useState("");
  const [snapshot, setSnapshot] = useState<CodeSnapshot | null>(null);
  const [language, setLanguage] = useState<keyof CodeSnapshot>("html");
  const [error, setError] = useState("");
  useStatusActivity(!versions && !error ? "Loading code history…" : "");
  useEffect(() => {
    let active = true;
    void bridge
      .call("codeHistory", scene)
      .then((items) => {
        if (active) {
          setVersions(items);
          setVersion(items[0]?.id ?? "");
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [scene]);
  useEffect(() => {
    if (!version) return;
    let active = true;
    void bridge
      .call("codeVersion", scene, version)
      .then((code) => {
        if (active) setSnapshot(code);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [scene, version]);
  return (
    <Modal title="Code history" open onClose={onClose} wide>
      <p>
        The last 20 saved code versions for this timeline. Restoring a version
        replaces its HTML, CSS, and JavaScript in the editor.
      </p>
      {error && <p role="alert">{error}</p>}
      {versions?.length === 0 && (
        <p>Save the project to record its first code version.</p>
      )}
      {!!versions?.length && (
        <>
          <label className="field">
            <span>Saved version</span>
            <select
              value={version}
              onChange={(event) => {
                setSnapshot(null);
                setError("");
                setVersion(event.target.value);
              }}
            >
              {versions.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.created).toLocaleString()} · {item.reason}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Preview language</span>
            <select
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as keyof CodeSnapshot)
              }
            >
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="js">JavaScript</option>
            </select>
          </label>
          {snapshot && (
            <pre className="code-history-preview" tabIndex={0}>
              {snapshot[language] || "(Empty)"}
            </pre>
          )}
          <div className="modal-actions">
            <button onClick={onClose}>Close</button>
            <button
              disabled={!snapshot}
              onClick={() => snapshot && onCompare(snapshot, language)}
            >
              Compare with current
            </button>
            <button
              className="primary"
              disabled={!snapshot || readOnly}
              onClick={() => snapshot && onRestore(snapshot)}
            >
              Restore code
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
