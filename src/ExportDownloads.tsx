import { ArrowDownToLine, FileAudio, Film } from "lucide-react";
import { ExportProgress } from "./ExportProgress";
import type { ExportJob } from "./useExports";

export function ExportDownloads({
  jobs,
  onCancel,
}: {
  jobs: ExportJob[];
  onCancel: (id: string) => void;
}) {
  if (!jobs.length) return null;
  return (
    <section
      className="export-file-results"
      aria-label="Export files"
      aria-live="polite"
    >
      <header>
        <strong>Your export files</strong>
        <span>Download each file separately</span>
      </header>
      {jobs.map((job) => {
        const stems = job.options.format === "stems";
        return (
          <div className="export-file-result" key={job.id}>
            <div className="export-file-heading">
              {stems ? <FileAudio size={18} /> : <Film size={18} />}
              <div>
                <strong>{stems ? "Audio stems ZIP" : "Exported file"}</strong>
                <small title={job.name}>{job.name}</small>
              </div>
              {job.download && job.status === "completed" ? (
                <a
                  className="export-file-download"
                  href={job.download.url}
                  download={job.download.name}
                >
                  <ArrowDownToLine size={14} />
                  {stems ? "Download audio stems ZIP" : "Download export"}
                </a>
              ) : (
                <span className="export-file-state">
                  {job.status === "running"
                    ? "Preparing…"
                    : job.status === "cancelled"
                      ? "Cancelled"
                      : job.status === "completed"
                        ? "Complete"
                        : "Failed"}
                </span>
              )}
            </div>
            {stems && job.status === "running" && (
              <div className="export-file-progress">
                <ExportProgress job={job} />
                <button onClick={() => onCancel(job.id)}>Cancel audio</button>
              </div>
            )}
            {job.parentId && job.error && <p role="alert">{job.error}</p>}
          </div>
        );
      })}
      <p>
        If an automatic download did not start, use the download links above.
      </p>
    </section>
  );
}
