import { useCallback, useState } from "react";
import { bridge, exportToFile, type ExportFileHandle } from "./bridge";
import type { Project, ExportOptions } from "../shared/project";
import type { RenderMetrics } from "../server/export-plan";

export type ExportJob = {
  diagnostics?: RenderMetrics;
  id: string;
  name: string;
  timeline: string;
  options: ExportOptions;
  status: "running" | "completed" | "failed" | "cancelled";
  progress?: { stage: string; done: number; total: number };
  error?: string;
  download?: { url: string; name: string };
};
export function useExports() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const update = useCallback((id: string, patch: Partial<ExportJob>) => {
    setJobs((all) =>
      all.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }, []);
  const onProgress = useCallback((progress: any) => {
    setJobs((all) => {
      // Untagged events are supported only when there is exactly one active job.
      const id =
        progress.jobId ??
        (all.filter((j) => j.status === "running").length === 1
          ? all.find((j) => j.status === "running")?.id
          : undefined);
      return all.map((job) =>
        job.id === id && (job.status === "running" || progress.diagnostics)
          ? {
              ...job,
              progress,
              diagnostics: progress.diagnostics ?? job.diagnostics,
            }
          : job,
      );
    });
  }, []);
  const start = (
    project: Project,
    options: ExportOptions,
    timeline: string,
    handle?: ExportFileHandle,
  ) => {
    if (jobs.filter((job) => job.status === "running").length >= 10)
      throw Error(
        "At most 10 exports can be queued. Wait for a clip to finish or cancel one.",
      );
    const id = crypto.randomUUID();
    const extension = options.format === "sequence" ? "zip" : options.format;
    const totalFrames =
      options.format === "png"
        ? 1
        : Math.ceil((options.duration / options.speed) * options.fps);
    const name = `${(options.fileName || project.name).replace(/\.(mp4|mkv|webm|gif|png|zip)$/i, "")}.${extension}`;
    setJobs((all) => [
      ...all,
      {
        id,
        name,
        timeline,
        options: { ...options },
        status: "running",
        progress: {
          stage: "Submitting export",
          done: 0,
          total: totalFrames,
        },
      },
    ]);
    const finished = exportToFile(project, options, handle, id, (download) =>
      update(id, { download }),
    )
      .then((destination) => {
        update(id, {
          status: "completed",
          progress: {
            stage: "Complete",
            done: totalFrames,
            total: totalFrames,
          },
        });
        return destination;
      })
      .catch((error) => {
        update(id, {
          status: /cancel/i.test(error.message) ? "cancelled" : "failed",
          error: error.message,
        });
        throw error;
      });
    return { id, finished };
  };
  const cancel = (id: string) => {
    update(id, { progress: { stage: "Cancelling", done: 0, total: 1 } });
    void bridge
      .call("cancelExport", id)
      .catch((error) => update(id, { error: error.message }));
  };
  const dismiss = (id: string) =>
    setJobs((all) =>
      all.filter((job) => job.id !== id || job.status === "running"),
    );
  return { jobs, start, cancel, dismiss, onProgress };
}
