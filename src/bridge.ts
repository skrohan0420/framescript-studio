import { projectSchema } from "../shared/project";
export interface Bridge {
  call: (name: string, ...args: any[]) => Promise<any>;
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
async function rpc(name: string, ...args: any[]) {
  const response = await fetch("/api/" + name, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-FrameScript": "1" },
    body: JSON.stringify({ args }),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.result?.error || "Local server request failed");
  return data.result;
}
let session: Promise<any> | undefined;
const ready = () =>
  (session ??= rpc("session").catch((error) => {
    session = undefined;
    throw error;
  }));
export const bridge: Bridge = {
  call: async (name, ...args) => {
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
  },
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
