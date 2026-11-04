import { useEffect, useRef, useState } from "react";
import type { ConsoleData, PreviewConsoleEntry } from "./preview-document";
import { ConsoleJsonNode, ConsoleTable } from "./ConsoleDataView";
import { Search } from "lucide-react";

function ConsoleMessage({
  entry,
  format,
}: {
  entry: PreviewConsoleEntry;
  format: string;
}) {
  const table =
    format === "table" ||
    ((format === "auto" || format === "pretty") && entry.table);
  if (entry.structured && (table || format === "json" || format === "auto")) {
    let data: ConsoleData;
    try {
      data = JSON.parse(entry.structured);
    } catch {
      data = null;
    }
    if (data && typeof data === "object") {
      return (
        <div className="console-message-data">
          <div className="console-message-summary" title={entry.text}>
            {entry.text}
          </div>
          {table ? (
            <ConsoleTable data={data} />
          ) : (
            <ConsoleJsonNode value={data} expanded={format === "json"} />
          )}
        </div>
      );
    }
  }
  return (
    <code>
      {format === "pretty" || format === "json" || format === "table"
        ? (entry.pretty ?? entry.text)
        : entry.text}
    </code>
  );
}

export function PreviewConsole({
  entries,
  onClear,
  onCommand,
}: {
  entries: PreviewConsoleEntry[];
  onClear: () => void;
  onCommand: (command: string) => void;
}) {
  const [level, setLevel] = useState("all");
  const [format, setFormat] = useState("auto");
  const [filter, setFilter] = useState("");
  const [command, setCommand] = useState("");
  const history = useRef<string[]>([]);
  const historyIndex = useRef(0);
  const output = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const query = filter.trim().toLowerCase();
  const filtered = entries.filter(
    (entry) =>
      (level === "all" || entry.level === level) &&
      (!query ||
        `${entry.text}\n${entry.structured ?? ""}`
          .toLowerCase()
          .includes(query)),
  );
  useEffect(() => {
    if (follow.current && output.current)
      output.current.scrollTop = output.current.scrollHeight;
  }, [entries, level, format, filter]);
  return (
    <section className="preview-console" aria-label="Preview console">
      <header>
        <div className="preview-console-controls">
          <label className="console-filter">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              aria-label="Filter console"
              placeholder="Filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          <select
            aria-label="Console message level"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="all">All levels</option>
            <option value="log">Log</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>
          <select
            aria-label="Console output format"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="pretty">Pretty</option>
            <option value="json">JSON tree</option>
            <option value="table">Table</option>
            <option value="text">Text</option>
          </select>
        </div>
        <button
          onClick={() => {
            follow.current = true;
            onClear();
          }}
        >
          Clear console
        </button>
      </header>
      <div
        className="preview-console-output"
        ref={output}
        tabIndex={0}
        aria-label="Console output"
        onScroll={(event) => {
          const { scrollHeight, clientHeight, scrollTop } = event.currentTarget;
          follow.current = scrollHeight - clientHeight - scrollTop < 12;
        }}
      >
        {filtered.length ? (
          filtered.map((entry, index) => (
            <div
              key={index}
              className="preview-console-entry"
              data-level={entry.level}
            >
              <strong title={entry.level}>
                {entry.level === "command"
                  ? "›"
                  : entry.level === "result"
                    ? "‹"
                    : entry.level}
              </strong>
              <ConsoleMessage entry={entry} format={format} />
            </div>
          ))
        ) : (
          <p>
            {entries.length
              ? "No messages match the current filters."
              : "Console output from the preview appears here."}
          </p>
        )}
      </div>
      <form
        className="console-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          const text = command.trim();
          if (!text) return;
          history.current = [...history.current, text].slice(-100);
          historyIndex.current = history.current.length;
          follow.current = true;
          setCommand("");
          onCommand(text);
        }}
      >
        <span aria-hidden="true">›</span>
        <input
          aria-label="Console command"
          placeholder="Run JavaScript in the preview"
          spellCheck={false}
          autoComplete="off"
          maxLength={4000}
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            historyIndex.current = Math.max(
              0,
              Math.min(
                history.current.length,
                historyIndex.current + (event.key === "ArrowUp" ? -1 : 1),
              ),
            );
            setCommand(history.current[historyIndex.current] ?? "");
          }}
        />
      </form>
    </section>
  );
}
