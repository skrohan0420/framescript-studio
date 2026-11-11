import { useEffect, useRef, useState } from "react";
import { X, Plus, ArrowDownToLine, Square, Minus } from "lucide-react";
import { download } from "./bridge";
import { ExportProgress } from "./ExportProgress";
import type { ExportJob } from "./useExports";

export function ExportDock({
  jobs,
  onRestore,
  onCancel,
  onDismiss,
  onNew,
}: {
  jobs: ExportJob[];
  onRestore: (id: string) => void;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
  onNew: () => void;
}) {
  const dock = useRef<HTMLElement>(null);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    () => {
      try {
        const value = JSON.parse(
          sessionStorage.getItem("framescript.export-dock-position") || "null",
        );
        return value && Number.isFinite(value.x) && Number.isFinite(value.y)
          ? value
          : null;
      } catch {
        return null;
      }
    },
  );
  const clamp = (x: number, y: number) => {
    const box = dock.current?.getBoundingClientRect();
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - (box?.width ?? 320) - 8)),
      y: Math.max(
        8,
        Math.min(y, window.innerHeight - (box?.height ?? 100) - 8),
      ),
    };
  };
  useEffect(() => {
    if (position)
      try {
        sessionStorage.setItem(
          "framescript.export-dock-position",
          JSON.stringify(position),
        );
      } catch {}
  }, [position]);
  useEffect(() => {
    const constrain = () =>
      setPosition((value) => (value ? clamp(value.x, value.y) : value));
    window.addEventListener("resize", constrain);
    const observer = new ResizeObserver(constrain);
    if (dock.current) observer.observe(dock.current);
    return () => {
      window.removeEventListener("resize", constrain);
      observer.disconnect();
    };
  }, []);
  const drag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button"))
      return;
    event.preventDefault();
    const handle = event.currentTarget,
      box = dock.current!.getBoundingClientRect();
    const offsetX = event.clientX - box.left,
      offsetY = event.clientY - box.top;
    handle.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) =>
      setPosition(clamp(e.clientX - offsetX, e.clientY - offsetY));
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("lostpointercapture", end);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("lostpointercapture", end);
  };
  const running = jobs.filter((job) => job.status === "running").length;
  const finished = jobs.filter((job) => job.status !== "running");
  return (
    <section
      ref={dock}
      className="export-dock"
      aria-label="Background export"
      style={
        position
          ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
          : undefined
      }
    >
      <div
        className="export-dock-heading export-dock-drag"
        onPointerDown={drag}
        aria-label="Move export panel"
        title="Drag to move"
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
              event.key,
            )
          )
            return;
          if ((event.target as HTMLElement).closest("button")) return;
          event.preventDefault();
          event.stopPropagation();
          const box = dock.current!.getBoundingClientRect();
          const step = event.shiftKey ? 40 : 10;
          setPosition(
            clamp(
              box.left +
                (event.key === "ArrowLeft"
                  ? -step
                  : event.key === "ArrowRight"
                    ? step
                    : 0),
              box.top +
                (event.key === "ArrowUp"
                  ? -step
                  : event.key === "ArrowDown"
                    ? step
                    : 0),
            ),
          );
        }}
      >
        <strong>
          Exports{" "}
          <span className="export-job-count">
            {jobs.length}
          </span>
        </strong>
        <div className="export-panel-controls">
          <button
            aria-label="Export another timeline"
            title="Export current timeline"
            onClick={onNew}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label={
              minimized ? "Expand exports panel" : "Minimize exports panel"
            }
            title={minimized ? "Expand exports" : "Minimize exports"}
            onClick={() => setMinimized((value) => !value)}
          >
            {minimized ? <span>Show</span> : <Minus size={16} />}
          </button>
          <button
            aria-label="Dismiss exports panel"
            title={
              running
                ? "Hide panel; active exports continue"
                : "Dismiss all finished exports"
            }
            onClick={() => {
              if (running) setMinimized(true);
              else finished.forEach((job) => onDismiss(job.id));
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="export-job-list" hidden={minimized && !running}>
        {jobs.map((job) => {
          const active = job.status === "running";
          if (minimized && !active) return null;
          const outcome = job.status === "completed"
              ? "Complete"
              : job.status === "cancelled"
                ? "Cancelled"
                : "Failed";
          return (
            <article className="export-job" key={job.id} aria-label={job.name}>
              <div className="export-dock-heading">
                <button
                  className="export-job-title"
                  title={
                    job.name +
                    " — " +
                    job.options.width +
                    " × " +
                    job.options.height +
                    " · " +
                    job.options.fps +
                    " fps"
                  }
                  aria-label={`Restore export ${job.name}`}
                  onClick={() => onRestore(job.id)}
                >
                  {job.name}
                </button>
                {!minimized && job.download && (
                  <button
                    aria-label="Download"
                    title={`Download ${job.name}`}
                    onClick={() => download(job.download!)}
                  >
                    <ArrowDownToLine size={13} />
                  </button>
                )}
                {!minimized &&
                  (active ? (
                    <button
                      aria-label={`Cancel export ${job.name}`}
                      title="Cancel export"
                      onClick={() => onCancel(job.id)}
                    >
                      <Square size={11} /> <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      aria-label={`Dismiss export ${job.name}`}
                      title="Dismiss"
                      onClick={() => onDismiss(job.id)}
                    >
                      <X size={13} />
                    </button>
                  ))}
              </div>
              {!minimized && (
                <div className="export-job-meta">
                  <small className="export-job-timeline">{job.timeline}</small>
                  {!active && <p>{outcome}</p>}
                </div>
              )}
              {active && <ExportProgress job={job} />}
              {!minimized && job.error && <p role="alert">{job.error}</p>}
              {!minimized && job.diagnostics && (
                <details className="export-diagnostics">
                  <summary>Render details</summary>
                  <p>
                    {job.diagnostics.path} · {job.diagnostics.encoder} ·{" "}
                    {job.diagnostics.workers} workers
                  </p>
                  <p>
                    {job.diagnostics.wallMs
                      ? `${(job.diagnostics.wallMs / 1000).toFixed(1)} seconds · `
                      : ""}
                    {job.diagnostics.cacheHits ?? 0} cached frames
                  </p>
                  <p>{job.diagnostics.gpu}</p>
                  <p>{job.diagnostics.bottleneck}</p>
                  {job.diagnostics.captureFallback && (
                    <p>Capture fallback: {job.diagnostics.captureFallback}</p>
                  )}
                  {job.diagnostics.graphicsFallback && (
                    <p>Graphics compatibility mode was used.</p>
                  )}
                  <dl className="export-phase-times">
                    {(
                      [
                        ["Startup", job.diagnostics.startupMs],
                        ["Scene drawing*", job.diagnostics.seekMs],
                        ["Capture / transfer*", job.diagnostics.captureMs],
                        ["Encoder drain", job.diagnostics.encoderDrainMs],
                        ["Verification", job.diagnostics.verificationMs],
                      ] as const
                    ).map(([label, time]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{((time ?? 0) / 1000).toFixed(2)}s</dd>
                      </div>
                    ))}
                  </dl>
                  <small>
                    * Worker totals overlap; they do not add up to export
                    duration.
                  </small>
                </details>
              )}
            </article>
          );
        })}
      </div>
      {!minimized && (running > 0 || finished.length > 0) && (
        <div className="export-panel-actions">
          {running > 0 && (
            <button
              aria-label="Cancel all exports"
              title="Cancel all exports"
              onClick={() =>
                jobs
                  .filter((job) => job.status === "running")
                  .forEach((job) => onCancel(job.id))
              }
            >
              <Square size={12} /> Cancel all
            </button>
          )}
          {finished.length > 0 && (
            <button
              aria-label="Dismiss finished"
              title="Dismiss finished exports"
              onClick={() => finished.forEach((job) => onDismiss(job.id))}
            >
              <X size={13} /> Clear finished
            </button>
          )}
        </div>
      )}
    </section>
  );
}
