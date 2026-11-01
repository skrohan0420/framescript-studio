import { parentPort, workerData } from "node:worker_threads";
import { renderExport } from "./export";
const controller = new AbortController();
parentPort!.on("message", (message) => {
  if (message === "cancel") controller.abort();
});
renderExport(
  workerData.project,
  workerData.options,
  workerData.destination,
  workerData.ffmpeg,
  controller.signal,
  (progress) => parentPort!.postMessage({ type: "progress", progress }),
  workerData.executablePath,
)
  .then((destination) =>
    parentPort!.postMessage({ type: "complete", destination }),
  )
  .catch((error) =>
    parentPort!.postMessage({ type: "error", error: error.message }),
  )
  .finally(() => parentPort!.close());
