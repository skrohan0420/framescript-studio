import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { ZipArchive } from "archiver";

export async function archiveSequence(
  directory: string,
  destination: string,
  signal: AbortSignal,
) {
  const temporary = destination + ".partial";
  try {
    if (signal.aborted) throw Error("Export cancelled");
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(temporary),
        archive = new ZipArchive({ zlib: { level: 1 } });
      let failure: Error | undefined;
      const stop = (error: Error) => {
        failure ??= error;
        archive.abort();
        output.destroy();
      };
      const abort = () => stop(Error("Export cancelled"));
      const timer = setTimeout(
        () => stop(Error("ZIP packaging timed out")),
        300_000,
      );
      signal.addEventListener("abort", abort, { once: true });
      output.on("error", stop);
      archive.on("error", stop);
      archive.on("warning", stop);
      output.once("close", () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        failure ? reject(failure) : resolve();
      });
      archive.pipe(output);
      if (signal.aborted) abort();
      else {
        archive.directory(directory, false);
        void archive.finalize().catch(stop);
      }
    });
    if (signal.aborted) throw Error("Export cancelled");
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
