import { spawn } from "node:child_process";

/** Await process exit, including cancellation/timeout, before callers remove files. */
export async function runProcess(
  command: string,
  args: string[],
  signal: AbortSignal,
  stage: string,
  timeoutMs = 300_000,
) {
  if (signal.aborted) throw Error("Export cancelled");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let log = "",
      timedOut = false;
    const abort = () => child.kill();
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
    };
    child.stderr!.on("data", (data) => {
      log = (log + data).slice(-12000);
    });
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("close", (code) => {
      cleanup();
      if (signal.aborted) reject(Error("Export cancelled"));
      else if (timedOut) reject(Error(stage + " timed out"));
      else if (code !== 0) reject(Error(stage + " failed: " + log));
      else resolve();
    });
  });
}
