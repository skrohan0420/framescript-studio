import { useEffect, useRef, useState } from "react";
import { bridge } from "./bridge";
import type { TerminalState } from "../shared/rpc";
import { useStatusActivity } from "./editor-status";

function terminalError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message === "Unknown operation"
    ? "The running FrameScript server needs an update. Press Ctrl+C in its terminal, run npm run dev again, then refresh this page."
    : message;
}

export function TerminalPanel({ id }: { id: string }) {
  const [terminal, setTerminal] = useState<TerminalState>();
  const [command, setCommand] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useStatusActivity(
    busy || terminal?.running
      ? "Running PowerShell command…"
      : !terminal && !error ? "Connecting to PowerShell…" : "",
  );
  const output = useRef<HTMLPreElement>(null);
  const follow = useRef(true);
  const generation = useRef(0);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const version = generation.current;
      try {
        const snapshot = await bridge.call("terminalPoll", id);
        if (!active) return;
        if (version === generation.current) setTerminal(snapshot);
        timer = setTimeout(poll, snapshot.running ? 250 : 750);
      } catch (cause) {
        if (active && version === generation.current)
          setError(terminalError(cause));
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);
  useEffect(() => {
    if (follow.current && output.current)
      output.current.scrollTop = output.current.scrollHeight;
  }, [terminal?.output]);
  const submit = async () => {
    const text = command.trim();
    if (!text || busy || !terminal || terminal.running) return;
    generation.current++;
    setBusy(true);
    setError("");
    try {
      const snapshot = await bridge.call("terminalRun", id, text);
      generation.current++;
      setTerminal(snapshot);
      history.current = [...history.current, text].slice(-100);
      historyIndex.current = history.current.length;
      follow.current = true;
      setCommand("");
    } catch (cause) {
      setError(terminalError(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="terminal-panel" aria-label="PowerShell terminal">
      <header>
        <span>
          <strong>PowerShell</strong>{" "}
          <span className="muted">
            {!terminal && error ? "Unavailable" : terminal?.exitCode != null ? `Exit ${terminal.exitCode}` : ""}
          </span>
        </span>
        <div>
          <button
            disabled={!terminal?.running}
            onClick={() =>
              void bridge
                .call("terminalStop", id)
                .catch((cause: Error) => setError(terminalError(cause)))
            }
          >
            Stop command
          </button>
          <button
            disabled={busy || terminal?.running || !terminal?.output}
            onClick={async () => {
              generation.current++;
              try {
                const snapshot = await bridge.call("terminalClear", id);
                generation.current++;
                setTerminal(snapshot);
              } catch (cause) {
                setError(terminalError(cause));
              }
            }}
          >
            Clear terminal
          </button>
        </div>
      </header>
      {error && (
        <p role="alert" className="terminal-error">
          {error}
        </p>
      )}
      <pre
        ref={output}
        tabIndex={0}
        aria-label="Terminal output"
        onScroll={(event) => {
          const node = event.currentTarget;
          follow.current =
            node.scrollHeight - node.scrollTop - node.clientHeight < 12;
        }}
      >
        {terminal?.output || "Run a local PowerShell command below."}
      </pre>
      <form
        className="console-prompt"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <span className="terminal-cwd" title={terminal?.cwd}>
          PS {terminal?.cwd ?? ""}&gt;
        </span>
        <input
          aria-label="PowerShell command"
          placeholder="Enter a command"
          maxLength={3000}
          autoComplete="off"
          spellCheck={false}
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
        <button
          type="submit"
          disabled={busy || !terminal || terminal.running || !command.trim()}
        >
          Run
        </button>
      </form>
    </section>
  );
}
