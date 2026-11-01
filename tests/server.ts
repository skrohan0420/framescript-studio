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
  assert(!JSON.stringify(await rpc("settingsGet")).includes("test-media-secret"));
  await rpc("mediaCredentials", "gemini", "");
  await assert.rejects(() => rpc("mediaCredentials", "unknown", "secret"));
  console.log("PASS media credential session/status API keeps keys out of responses");
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
