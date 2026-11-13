// @vitest-environment node
import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ExportRetention } from "../server/export-retention";

it("expires old outputs, preserves active files, and clears only managed completed renders", async () => {
  const dir = path.resolve("test-results/retention-" + randomUUID());
  await fs.mkdir(dir, { recursive: true });
  const old = path.join(dir, randomUUID() + ".mp4");
  const current = path.join(dir, randomUUID() + ".stems.zip");
  const active = path.join(dir, randomUUID() + ".mp4");
  const unrelated = path.join(dir, "user-video.mp4");
  await Promise.all(
    [old, current, active, unrelated].map((file) => fs.writeFile(file, "1234")),
  );
  const yesterday = new Date(Date.now() - 8 * 86_400_000);
  await fs.utimes(old, yesterday, yesterday);
  const retention = new ExportRetention(dir);
  const release = retention.protect(active);
  const automatic = await retention.inspect();
  expect(automatic.removed.has(old)).toBe(true);
  expect(automatic.files).toBe(2);
  const manual = await retention.inspect(true);
  expect(manual.removed.has(current)).toBe(true);
  expect(manual.files).toBe(1);
  expect(await fs.readFile(active, "utf8")).toBe("1234");
  expect(await fs.readFile(unrelated, "utf8")).toBe("1234");
  release();
  expect((await retention.inspect(true)).files).toBe(0);
});
