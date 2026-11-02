import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { atomicWrite } from "./storage";
export type CredentialStore = {
  get: (key: string) => any;
  set: (key: string, value: any) => Promise<void>;
};
async function dpapi(value: string, decrypt = false) {
  if (process.platform !== "win32")
    throw Error(
      "Remembering credentials requires Windows protected storage on this installation.",
    );
  const script = `[Console]::InputEncoding=New-Object Text.UTF8Encoding($false); [Console]::OutputEncoding=New-Object Text.UTF8Encoding($false); Add-Type -AssemblyName System.Security; $inputValue=[Console]::In.ReadToEnd(); ${decrypt ? "$bytes=[Convert]::FromBase64String($inputValue); $plain=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))" : "$bytes=[Text.Encoding]::UTF8.GetBytes($inputValue); $cipher=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($cipher))"}`;
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let output = "";
    const timer = setTimeout(() => child.kill(), 15000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 2_000_000) child.kill();
    });
    child.stderr.on("data", () => {});
    child.on("error", () => {
      clearTimeout(timer);
      reject(Error("Windows protected storage could not be started."));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(output)
        : reject(
            Error(
              "Windows could not unlock credential storage. Reconnect services under the same Windows account.",
            ),
          );
    });
    child.stdin.on("error", () => {});
    child.stdin.end(value);
  });
}
export class WindowsCredentialStore implements CredentialStore {
  private values: Record<string, any> = {};
  private locked = false;
  private queue: Promise<void> = Promise.resolve();
  constructor(private file: string) {}
  async load() {
    try {
      this.values = JSON.parse(
        await dpapi(await fs.readFile(this.file, "utf8"), true),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.locked = true;
        throw error;
      }
    }
  }
  get(key: string) {
    return structuredClone(this.values[key]);
  }
  set(key: string, value: any) {
    const operation = this.queue.then(async () => {
      if (this.locked)
        throw Error(
          "Protected credential storage could not be unlocked. Its existing file has been preserved.",
        );
      const next = { ...this.values };
      if (value === undefined) delete next[key];
      else next[key] = value;
      if (Object.keys(next).length)
        await atomicWrite(this.file, await dpapi(JSON.stringify(next)));
      else await fs.rm(this.file, { force: true });
      this.values = next;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
