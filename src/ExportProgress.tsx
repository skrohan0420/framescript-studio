import type { ExportJob } from "./useExports";

export function exportProgressText(
  progress: ExportJob["progress"],
  unit = "frames",
) {
  const stage = progress?.stage ?? "Submitting export";
  if (!progress?.total) return stage;

  const { done, total } = progress;
  return `${stage} · ${Math.round((100 * done) / total)}% · ${done}/${total} ${unit}`;
}

export function ExportProgress({ job }: { job: ExportJob }) {
  const total = job.progress?.total || undefined;
  const text = exportProgressText(
    job.progress,
    job.options.format === "stems" ? "steps" : "frames",
  );

  return (
    <div className="export-progress">
      <span>{text}</span>
      <progress
        aria-label={`Render progress for ${job.name}`}
        aria-valuetext={text}
        max={total}
        value={total ? job.progress?.done : undefined}
      />
    </div>
  );
}
