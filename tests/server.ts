import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { newProject, type ExportOptions } from "../shared/project";
const dataDir = path.resolve("test-results/server-" + Date.now()),
  port = 5187;
const child = spawn(process.execPath, ["scripts/start.mjs"], {
  env: { ...process.env, PORT: String(port), FRAMESCRIPT_DATA_DIR: dataDir },
  stdio: "pipe",
});
let logs = "";
child.stdout.on("data", (d) => {
  logs += d;
});
child.stderr.on("data", (d) => {
  logs += d;
});
const base = "http://127.0.0.1:" + port;
let cookie = "";
async function rpc(name: string, ...args: any[]) {
  const response = await fetch(base + "/api/" + name, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-FrameScript": "1",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ args }),
  });
  const c = response.headers.get("set-cookie");
  if (c) cookie = c.split(";")[0];
  const data = await response.json();
  if (!response.ok) throw Error(data.result?.error || "Request failed");
  return data.result;
}
try {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw Error(logs);
    try {
      await rpc("session");
      break;
    } catch {
      if (i === 99) throw Error(logs);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.equal((await fetch(base)).status, 200);
  assert.equal(typeof (await rpc("mediaStatus")).gemini, "boolean");
  await rpc("mediaCredentials", "gemini", "test-media-secret");
  const media = await rpc("mediaStatus");
  assert.equal(media.gemini, true);
  assert(!JSON.stringify(media).includes("test-media-secret"));
  assert(
    !JSON.stringify(await rpc("settingsGet")).includes("test-media-secret"),
  );
  const services = await rpc("servicesStatus");
  assert.equal(services.length, 6);
  assert.equal(services.find((s: any) => s.id === "gemini").source, "session");
  assert(!JSON.stringify(services).includes("test-media-secret"));
  await assert.rejects(() => rpc("serviceCheck", "invalid"));
  assert.equal((await rpc("serviceCheck", "chatgpt")).state, "error");
  await rpc("serviceRemove", "gemini");
  assert.notEqual(
    (await rpc("servicesStatus")).find((s: any) => s.id === "gemini").source,
    "session",
  );
  await rpc("mediaCredentials", "gemini", "");
  await assert.rejects(() => rpc("mediaCredentials", "unknown", "secret"));
  console.log(
    "PASS media credential session/status API keeps keys out of responses",
  );
  assert.equal(
    (
      await fetch(base + "/api/settingsGet", {
        method: "POST",
        headers: { Origin: "http://evil.example", "X-FrameScript": "1" },
        body: '{"args":[]}',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/settingsGet", {
        method: "POST",
        body: '{"args":[]}',
      })
    ).status,
    403,
  );
  console.log(
    "PASS production React hosting, cross-origin and missing-header rejection",
  );
  const project = newProject();
  project.name = "Web test";
  project.settings = {
    ...project.settings,
    width: 320,
    height: 180,
    duration: 0.4,
    fps: 10,
  };
  const saved = await rpc("save", project);
  assert(saved.url);
  const portable = await fetch(base + saved.url, {
    headers: { Cookie: cookie },
  }).then((r) => r.json());
  assert.deepEqual(portable, project);
  const recent = await rpc("recents");
  assert.equal(recent.length, 1);
  assert.deepEqual(await rpc("openRecent", recent[0]), project);
  await assert.rejects(() => rpc("openRecent", "../settings.json"));
  console.log("PASS server-managed projects, browser download and safe reopen");
  await rpc("autosave", project);
  assert.deepEqual(await rpc("recover"), project);
  const workspace = await fetch(base + "/api/workspaceGet", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-FrameScript": "1",
      Cookie: cookie,
    },
    body: '{"args":[]}',
  });
  const version = workspace.headers.get("X-Workspace-Version");
  assert(version);
  const concurrent = await Promise.all(
    ["Tab A", "Tab B"].map((name) =>
      fetch(base + "/api/autosave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FrameScript": "1",
          "X-Workspace-Version": version,
          Cookie: cookie,
        },
        body: JSON.stringify({ args: [{ ...project, name }] }),
      }),
    ),
  );
  assert.deepEqual(
    concurrent.map((response) => response.status).sort(),
    [200, 409],
  );
  await rpc("autosave", project);
  console.log("PASS concurrent workspace compare-and-swap rejects stale tabs");
  await rpc("settingsSet", { fontSize: 16 });
  assert.equal((await rpc("settingsGet")).fontSize, 16);
  const html = await rpc("source", project);
  assert(
    (
      await fetch(base + html.url, { headers: { Cookie: cookie } }).then((r) =>
        r.text(),
      )
    ).startsWith("<!doctype html>"),
  );
  console.log("PASS autosave, preferences and standalone HTML source download");
  const options: ExportOptions = {
    format: "mp4",
    width: 320,
    height: 180,
    fps: 10,
    duration: 0.4,
    speed: 1,
    quality: 24,
    fit: "fit",
    transparent: false,
    time: 0,
  };
  const eventsController = new AbortController();
  let progressSeen = false;
  let cancelRequested = false;
  const events = await fetch(base + "/api/events", {
    headers: { Cookie: cookie },
    signal: eventsController.signal,
  });
  const reader = events.body!.getReader();
  const consume = (async () => {
    let pending = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += new TextDecoder().decode(value);
        let index;
        while ((index = pending.indexOf("\n\n")) >= 0) {
          const message = pending.slice(0, index);
          pending = pending.slice(index + 2);
          if (!message.startsWith("data: ")) continue;
          const p = JSON.parse(message.slice(6));
          progressSeen = true;
          if (p.total === 300 && p.done >= 2 && !cancelRequested) {
            cancelRequested = true;
            void rpc("cancelExport");
          }
        }
      }
    } catch {}
  })();
  for (const format of ["mp4", "sequence"] as const) {
    const result = await rpc("export", project, { ...options, format });
    const response = await fetch(base + result.url, {
        headers: { Cookie: cookie },
      }),
      bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length > 100);
    assert(
      response.headers
        .get("content-disposition")
        ?.includes(format === "sequence" ? ".zip" : ".mp4"),
    );
    if (format === "sequence")
      assert.equal(bytes.subarray(0, 2).toString(), "PK");
    await fs.writeFile(path.join(dataDir, result.name), bytes);
    console.log("PASS real " + format + " HTTP export and download");
  }
  assert(progressSeen, "Expected SSE progress events");
  await assert.rejects(
    () => rpc("export", project, { ...options, duration: 30 }),
    /cancel/i,
  );
  assert(cancelRequested);
  eventsController.abort();
  await consume;
  assert(
    !(await fs.readdir(path.join(dataDir, "exports"))).some((f) =>
      f.includes(".partial-"),
    ),
  );
  console.log(
    "PASS SSE progress and HTTP cancellation with partial-output cleanup",
  );

  // Three distinct jobs: two run, one waits; targeted cancellation must be isolated.
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const progress = new Map<string, any[]>();
  const multiEventsAbort = new AbortController();
  const multiEvents = await fetch(base + "/api/events", {
    headers: { Cookie: cookie },
    signal: multiEventsAbort.signal,
  });
  const multiReader = multiEvents.body!.getReader();
  const consumeMulti = (async () => {
    let buffer = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await multiReader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        let split: number;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const event = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          if (!event.startsWith("data: ")) continue;
          const item = JSON.parse(event.slice(6));
          if (item.jobId)
            progress.set(item.jobId, [
              ...(progress.get(item.jobId) ?? []),
              item,
            ]);
        }
      }
    } catch (error) {
      if (!multiEventsAbort.signal.aborted) throw error;
    }
  })();
  const waitStage = async (id: string, stage: string) => {
    const until = Date.now() + 10000;
    while (!progress.get(id)?.some((p) => p.stage === stage)) {
      if (Date.now() > until)
        throw Error("Missing job stage " + stage + " for " + id);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const settle = (promise: Promise<any>) =>
    promise.then(
      (result) => ({ result, error: "" }),
      (error) => ({ result: null, error: error.message as string }),
    );
  const first = settle(
    rpc(
      "export",
      { ...project, html: "<h1>First clip</h1>" },
      { ...options, duration: 30, fileName: "First clip" },
      ids[0],
    ),
  );
  await waitStage(ids[0], "Starting render browser");
  const second = settle(
    rpc(
      "export",
      { ...project, html: "<h1>Second clip</h1>" },
      { ...options, duration: 5, fileName: "Second clip" },
      ids[1],
    ),
  );
  await waitStage(ids[1], "Starting render browser");
  const third = settle(
    rpc("export", project, { ...options, fileName: "Queued clip" }, ids[2]),
  );
  await waitStage(ids[2], "Queued");
  assert(
    !progress.get(ids[2])?.some((p) => p.stage === "Starting render browser"),
  );
  await assert.rejects(
    () => rpc("export", project, options, ids[0]),
    /already running/i,
  );
  // Another browser's cancellation cannot affect this client's second clip.
  await fetch(base + "/api/cancelExport", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-FrameScript": "1" },
    body: JSON.stringify({ args: [ids[1]] }),
  });
  await rpc("cancelExport", ids[2]);
  await rpc("cancelExport", ids[0]);
  const results = await Promise.all([first, second, third]);
  assert.match(results[0].error, /cancel/i);
  assert.match(results[2].error, /cancel/i);
  assert.equal(results[1].error, "");
  assert.equal(results[1].result.name, "Second clip.mp4");
  const secondFile = await fetch(base + results[1].result.url, {
    headers: { Cookie: cookie },
  });
  assert((await secondFile.arrayBuffer()).byteLength > 100);
  assert(progress.get(ids[1])?.some((p) => p.stage === "Complete"));
  const earlyId = crypto.randomUUID();
  await rpc("cancelExport", earlyId);
  await assert.rejects(
    () => rpc("export", project, options, earlyId),
    /cancel/i,
  );
  multiEventsAbort.abort();
  await consumeMulti;
  assert(
    !(await fs.readdir(path.join(dataDir, "exports"))).some((f) =>
      f.includes(".partial-"),
    ),
  );
  console.log(
    "PASS two concurrent exports, queued third, job-tagged SSE, isolated active/queued cancellation, early cancellation and separate download",
  );

  await rpc("credentials", "test-key");
  assert.equal(await rpc("hasKey"), true);
  assert(!(await fs.readdir(dataDir)).some((f) => /credential|key/.test(f)));
  await rpc("credentials", "");
  await rpc("deleteProject");
  assert.equal((await rpc("recents")).length, 0);
  assert.equal((await fs.readdir(path.join(dataDir, "trash"))).length, 1);
  console.log("PASS session-only credentials and recoverable project trash");
} finally {
  child.kill();
}
