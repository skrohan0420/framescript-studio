// @vitest-environment node
import { expect, it } from "vitest";
import { runProcess } from "../server/process";
import { archiveSequence } from "../server/archive";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";

it("stops a running export subprocess on cancellation and timeout", async () => {
  const controller = new AbortController();
  const task = runProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    controller.signal,
    "Verification",
  );
  setTimeout(() => controller.abort(), 100);
  await expect(task).rejects.toThrow("cancelled");
  await expect(
    runProcess(
      process.execPath,
      ["-e", "setInterval(()=>{},1000)"],
      new AbortController().signal,
      "Verification",
      100,
    ),
  ).rejects.toThrow("timed out");
});
it("cancels ZIP packaging and removes partial output", async () => {
  const dir = path.resolve("test-results/zip-" + randomUUID());
  await fs.mkdir(dir, { recursive: true });
  const bytes = randomBytes(1_000_000);
  await Promise.all(
    Array.from({ length: 16 }, (_, i) =>
      fs.writeFile(path.join(dir, i + ".png"), bytes),
    ),
  );
  const controller = new AbortController(),
    destination = dir + ".zip";
  const task = archiveSequence(dir, destination, controller.signal);
  setTimeout(() => controller.abort(), 10);
  await expect(task).rejects.toThrow("cancelled");
  await expect(fs.stat(destination + ".partial")).rejects.toThrow();
  await expect(fs.stat(destination)).rejects.toThrow();
});
