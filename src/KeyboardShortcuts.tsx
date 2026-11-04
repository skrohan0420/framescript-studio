import { useState } from "react";
import { Modal } from "./components";
import {
  formatShortcut,
  keyboardChord,
  shortcutBinding,
  shortcutIds,
  shortcuts,
  type ShortcutId,
  type ShortcutOverrides,
} from "./shortcuts";

export function KeyboardShortcuts({
  overrides,
  onChange,
  onClose,
}: {
  overrides: ShortcutOverrides;
  onChange: (overrides: ShortcutOverrides) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState<ShortcutId | null>(null);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState<{
    id: ShortcutId;
    other: ShortcutId;
    chord: string;
  } | null>(null);
  const groups = [...new Set(shortcutIds.map((id) => shortcuts[id][0]))];
  const search = query.trim().toLowerCase();
  const reset = (id: ShortcutId) => {
    const next = { ...overrides };
    const defaultKey = shortcuts[id][2];
    const other = shortcutIds.find(
      (action) =>
        action !== id && shortcutBinding(action, overrides) === defaultKey,
    );
    if (other) {
      setMessage(
        `${formatShortcut(defaultKey)} is assigned to ${shortcuts[other][1]}.`,
      );
      setConflict({ id, other, chord: defaultKey });
      return;
    }
    delete next[id];
    onChange(next);
    setMessage("");
    setConflict(null);
  };
  return (
    <Modal
      title="Keyboard shortcuts"
      open
      onClose={onClose}
      wide
      onEscapeKeyDown={(event) => {
        if (!recording) return;
        event.preventDefault();
        setRecording(null);
      }}
    >
      <div className="shortcut-toolbar">
        <input
          type="search"
          aria-label="Filter shortcuts"
          placeholder="Find an action or shortcut"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          onClick={() => {
            onChange({});
            setRecording(null);
            setMessage("");
            setConflict(null);
          }}
        >
          Reset all
        </button>
      </div>
      <p className="muted">
        Select a binding and press a new key combination. Single-key bindings
        work outside text fields. Browser and system shortcuts may take
        priority.
      </p>
      {message && (
        <p role="status">
          {message}{" "}
          {conflict && (
            <button
              onClick={() => {
                onChange({
                  ...overrides,
                  [conflict.other]: null,
                  [conflict.id]: conflict.chord,
                });
                setConflict(null);
                setMessage("");
                setRecording(null);
              }}
            >
              Reassign
            </button>
          )}
        </p>
      )}
      <div className="shortcut-list">
        {groups.map((group) => {
          const items = shortcutIds.filter(
            (id) =>
              shortcuts[id][0] === group &&
              `${shortcuts[id][1]} ${formatShortcut(shortcutBinding(id, overrides) ?? "")}`
                .toLowerCase()
                .includes(search),
          );
          if (!items.length) return null;
          return (
            <section key={group}>
              <h3>{group}</h3>
              {items.map((id) => {
                const binding = shortcutBinding(id, overrides);
                const active = recording === id;
                return (
                  <div className="shortcut-row" key={id}>
                    <span>{shortcuts[id][1]}</span>
                    <button
                      aria-label={`Change shortcut for ${shortcuts[id][1]}`}
                      aria-pressed={active}
                      onClick={() => {
                        setRecording(active ? null : id);
                        setMessage("");
                        setConflict(null);
                      }}
                      onKeyDown={(event) => {
                        if (!active || event.key === "Tab") return;
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.key === "Escape") {
                          setRecording(null);
                          return;
                        }
                        const chord = keyboardChord(event.nativeEvent);
                        if (!chord || event.repeat) return;
                        const other = shortcutIds.find(
                          (action) =>
                            action !== id &&
                            shortcutBinding(action, overrides) === chord,
                        );
                        if (other) {
                          setMessage(
                            `${formatShortcut(chord)} is assigned to ${shortcuts[other][1]}.`,
                          );
                          setConflict({ id, other, chord });
                          setRecording(null);
                          return;
                        }
                        onChange({ ...overrides, [id]: chord });
                        setRecording(null);
                        setMessage("");
                      }}
                    >
                      <kbd>
                        {active
                          ? "Press shortcut…"
                          : binding
                            ? formatShortcut(binding)
                            : "Unassigned"}
                      </kbd>
                    </button>
                    <button
                      aria-label={`Clear shortcut for ${shortcuts[id][1]}`}
                      disabled={!binding}
                      onClick={() => {
                        onChange({ ...overrides, [id]: null });
                        setRecording(null);
                        setConflict(null);
                        setMessage("");
                      }}
                    >
                      Clear
                    </button>
                    <button
                      aria-label={`Reset shortcut for ${shortcuts[id][1]}`}
                      disabled={overrides[id] === undefined}
                      onClick={() => reset(id)}
                    >
                      Reset
                    </button>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
