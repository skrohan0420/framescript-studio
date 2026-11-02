import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const directory = path.resolve("test-results/remember-" + randomUUID()),
  base = "http://127.0.0.1:5189";
let child: ChildProcess | undefined,
  cookie = "";
async function rpc(name: string, ...args: any[]) {
  const response = await fetch(base + "/api/" + name, {
    method: "POST",
    headers: {
      "X-FrameScript": "1",
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ args }),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = await response.json();
  if (!response.ok) throw Error(data.result.error);
  return data.result;
}
async function start() {
  child = spawn(process.execPath, ["scripts/start.mjs"], {
    env: { ...process.env, PORT: "5189", FRAMESCRIPT_DATA_DIR: directory },
    stdio: "ignore",
    windowsHide: true,
  });
  for (let i = 0; i < 100; i++) {
    try {
      await rpc("session");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw Error("Test server did not start");
}
async function stop() {
  if (!child) return;
  const running = child;
  await new Promise<void>((resolve) => {
    running.once("close", () => resolve());
    running.kill();
  });
  child = undefined;
}
try {
  await start();
  await rpc("mediaCredentials", "eleven", "restart-test-secret", true);
  const originalCookie = cookie;
  assert(
    (await rpc("servicesStatus")).find((s: any) => s.id === "eleven")
      .remembered,
  );
  const files = await fs.readdir(path.join(directory, "credentials"));
  assert.equal(files.length, 1);
  assert(
    !(
      await fs.readFile(path.join(directory, "credentials", files[0]), "utf8")
    ).includes("restart-test-secret"),
  );
  await stop();
  await start();
  assert.equal(cookie, originalCookie);
  const status = (await rpc("servicesStatus")).find(
    (s: any) => s.id === "eleven",
  );
  assert(status.configured && status.remembered);
  assert(!JSON.stringify(status).includes("restart-test-secret"));
  await rpc("serviceRemove", "eleven");
  await stop();
  await start();
  assert(
    !(await rpc("servicesStatus")).find((s: any) => s.id === "eleven")
      .remembered,
  );
  console.log(
    "PASS encrypted key, stable cookie, actual server restart restoration and durable forgetting",
  );
} finally {
  await stop();
}
