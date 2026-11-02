import { projectSchema } from "../shared/project";
import type { RpcName, RpcArgs, RpcResults } from "../shared/rpc";
import type { Project, ExportOptions } from "../shared/project";
export type ExportFileHandle = {
  name?: string;
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};
export function supportsExportPicker() {
  return typeof (window as any).showSaveFilePicker === "function";
}
export async function chooseExportFile(
  name: string,
  format: string,
): Promise<ExportFileHandle> {
  const extension = format === "sequence" ? "zip" : format;
  return (window as any).showSaveFilePicker({
    suggestedName:
      name.replace(/\.(mp4|mkv|webm|gif|png|zip)$/i, "") + "." + extension,
    types: [
      {
        description: "Exported " + extension.toUpperCase(),
        accept: {
          [extension === "zip"
            ? "application/zip"
            : extension === "png"
              ? "image/png"
              : extension === "gif"
                ? "image/gif"
                : "video/" + extension]: ["." + extension],
        },
      },
    ],
  });
}
export async function exportToFile(
  project: Project,
  options: ExportOptions,
  handle?: ExportFileHandle,
) {
  await ready();
  const result = await rpc("export", project, options);
  if (!result?.url) return result;
  if (!handle) return download(result);
  const response = await fetch(result.url, { credentials: "same-origin" });
  if (!response.ok) throw Error("Could not retrieve the rendered video.");
  let writable:
    Awaited<ReturnType<ExportFileHandle["createWritable"]>> | undefined;
  try {
    writable = await handle.createWritable();
    if (response.body && typeof (writable as any).getWriter === "function")
      await response.body.pipeTo(
        writable as unknown as WritableStream<Uint8Array>,
      );
    else {
      await writable.write(await response.blob());
      await writable.close();
    }
    return handle.name || result.name;
  } catch (error) {
    await writable?.abort().catch(() => {});
    download(result);
    throw Error(
      "Could not save to the chosen file. A browser download was started instead: " +
        (error as Error).message,
    );
  }
}
export interface Bridge {
  call: <K extends RpcName>(
    name: K,
    ...args: RpcArgs<K>
  ) => Promise<RpcResults[K]>;
  onProgress: (fn: (p: any) => void) => () => void;
}
function download(item: { url: string; name: string }) {
  const a = document.createElement("a");
  a.href = item.url;
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return item.name;
}
const workspaceWrites = new Set([
  "projectSave",
  "projectRename",
  "projectDuplicate",
  "projectTrash",
  "projectRestore",
  "autosave",
  "newSession",
  "openRecent",
  "save",
  "saveAs",
  "deleteProject",
  "recoveryRestore",
]);
let workspaceVersion: string | undefined;
let workspaceQueue: Promise<unknown> = Promise.resolve();
async function request(name: string, args: any[]) {
  const response = await fetch("/api/" + name, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-FrameScript": "1",
      ...(workspaceWrites.has(name) && workspaceVersion
        ? { "X-Workspace-Version": workspaceVersion }
        : {}),
    },
    body: JSON.stringify({ args }),
  });
  const data = await response.json();
  const version = response.headers.get("X-Workspace-Version");
  if (version && response.status !== 409) workspaceVersion = version;
  if (!response.ok)
    throw Error(data.result?.error || "Local server request failed");
  return data.result;
}
function rpc(name: string, ...args: any[]) {
  if (!workspaceWrites.has(name) && name !== "workspaceGet")
    return request(name, args);
  const task = workspaceQueue.then(() => request(name, args));
  workspaceQueue = task.catch(() => {});
  return task;
}
let session: Promise<any> | undefined;
const ready = () =>
  (session ??= rpc("session").catch((error) => {
    session = undefined;
    throw error;
  }));
async function call(name: RpcName, ...args: any[]) {
  await ready();
  if (name === "open")
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".frame,application/json";
      input.oncancel = () => resolve(null);
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          if (file.size > 100_000_000) throw Error("Project exceeds 100 MB");
          const p = projectSchema.parse(JSON.parse(await file.text()));
          await rpc("newSession");
          resolve(p);
        } catch (error) {
          reject(error);
        }
      };
      input.click();
    });
  if (
    name === "deleteProject" &&
    !confirm("Move this saved project to the local trash folder?")
  )
    return false;
  const result = await rpc(name, ...args);
  if (["save", "saveAs", "source", "export"].includes(name) && result?.url)
    return download(result);
  return result;
}
export const bridge: Bridge = {
  call: call as Bridge["call"],
  onProgress: (fn) => {
    let events: EventSource | undefined;
    let closed = false;
    void ready()
      .then(() => {
        if (closed) return;
        events = new EventSource("/api/events");
        events.onmessage = (e) => fn(JSON.parse(e.data));
      })
      .catch(() => {});
    return () => {
      closed = true;
      events?.close();
    };
  },
};
