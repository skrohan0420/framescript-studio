import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { TerminalState } from "../shared/rpc";

type Session = TerminalState & {
  process?: ChildProcess;
  marker?: string;
  touched: number;
};
const sessions = new Map<string, Session>();
const keyFor = (owner: string, id: string) => `${owner}:${id}`;
const append = (session: Session, text: string) => {
  session.output = (session.output + text).slice(-128_000);
};

export function terminalState(owner: string, id: string): TerminalState {
  const session = sessions.get(keyFor(owner, id));
  if (!session)
    return { cwd: process.cwd(), output: "", running: false, exitCode: null };
  session.touched = Date.now();
  const { cwd, output, running, exitCode, marker } = session;
  const markerIndex = marker ? output.indexOf(marker) : -1;
  return {
    cwd,
    output: markerIndex < 0 ? output : output.slice(0, markerIndex),
    running,
    exitCode,
  };
}

export function runTerminal(
  owner: string,
  id: string,
  command: string,
): TerminalState {
  if (process.platform !== "win32")
    throw Error("The local terminal requires Windows PowerShell.");
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (!session.running && now - session.touched > 3_600_000)
      sessions.delete(key);
  }
  const key = keyFor(owner, id);
  const session = sessions.get(key) ?? {
    cwd: process.cwd(),
    output: "",
    running: false,
    exitCode: null,
    touched: now,
  };
  if (session.running)
    throw Error("A command is already running in this terminal.");
  if ([...sessions.values()].filter((item) => item.running).length >= 8)
    throw Error("Too many terminal commands are running.");
  if (!existsSync(session.cwd)) session.cwd = process.cwd();
  sessions.set(key, session);
  session.running = true;
  session.exitCode = null;
  session.touched = now;
  const marker = `__FRAMESCRIPT_CWD_${randomUUID()}__`;
  session.marker = marker;
  append(
    session,
    `${session.output ? "\n" : ""}PS ${session.cwd}> ${command}\n`,
  );
  const source = Buffer.from(command, "utf16le").toString("base64");
  const script = `
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$ProgressPreference = 'SilentlyContinue'
$fsExit = 0
try {
  . ([scriptblock]::Create([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${source}'))))
  if (-not $?) { $fsExit = if ($LASTEXITCODE) { $LASTEXITCODE } else { 1 } }
} catch {
  [Console]::Error.WriteLine($_.ToString())
  $fsExit = 1
} finally {
  $fsCwd = (Get-Location -PSProvider FileSystem).ProviderPath
  [Console]::WriteLine('${marker}' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($fsCwd)))
}
exit $fsExit
`;
  const child = spawn(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    {
      cwd: session.cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  session.process = child;
  child.stdout
    .setEncoding("utf8")
    .on("data", (text: string) => append(session, text));
  child.stderr
    .setEncoding("utf8")
    .on("data", (text: string) => append(session, text));
  child.on("error", (error) =>
    append(session, `PowerShell: ${error.message}\n`),
  );
  child.once("close", (code) => {
    const index = session.output.lastIndexOf(marker);
    if (index >= 0) {
      const end = session.output.indexOf("\n", index);
      const encoded = session.output
        .slice(index + marker.length, end < 0 ? undefined : end)
        .trim();
      const cwd = Buffer.from(encoded, "base64").toString("utf8");
      if (cwd && existsSync(cwd)) session.cwd = cwd;
      session.output =
        session.output.slice(0, index) +
        (end < 0 ? "" : session.output.slice(end + 1));
    }
    session.marker = undefined;
    session.process = undefined;
    session.running = false;
    session.exitCode = code ?? 1;
    session.touched = Date.now();
  });
  return terminalState(owner, id);
}

function stop(session?: Session) {
  const child = session?.process;
  if (!child?.pid || child.exitCode !== null) return;
  const killer = spawn(
    "taskkill.exe",
    ["/PID", String(child.pid), "/T", "/F"],
    { windowsHide: true, stdio: "ignore" },
  );
  killer.once("error", () => child.kill());
  killer.once("exit", (code) => {
    if (code && child.exitCode === null) child.kill();
  });
}

export function stopTerminal(owner: string, id: string, close = false) {
  const key = keyFor(owner, id);
  stop(sessions.get(key));
  if (close) sessions.delete(key);
  return true;
}

export function clearTerminal(owner: string, id: string) {
  const session = sessions.get(keyFor(owner, id));
  if (session && !session.running) session.output = "";
  return terminalState(owner, id);
}

export function stopTerminals() {
  for (const session of sessions.values()) stop(session);
}
