import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { frameCacheVersion } from "./frame-cache";
const budget = 512 * 1024 ** 2;
async function checksum(file: string) {
  const hash = createHash("sha256");
  for await (const part of createReadStream(file)) hash.update(part);
  return hash.digest("hex");
}
export async function videoCache(
  directory: string,
  dependencies: unknown,
  extension: string,
) {
  directory = path.join(directory, "completed");
  await fs.mkdir(directory, { recursive: true });
  const key = createHash("sha256")
    .update(
      JSON.stringify(["completed-video-v2", frameCacheVersion, dependencies]),
    )
    .digest("hex");
  const file = path.join(directory, key + "." + extension),
    metadata = path.join(directory, key + ".json");
  return {
    async restore(target: string) {
      try {
        const record = JSON.parse(await fs.readFile(metadata, "utf8")),
          stat = await fs.stat(file);
        if (
          stat.size !== record.size ||
          Date.now() - stat.mtimeMs > 7 * 86400_000 ||
          (await checksum(file)) !== record.hash
        )
          return false;
        await fs.copyFile(file, target);
        return true;
      } catch {
        return false;
      }
    },
    async store(source: string) {
      let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
      const lockFile = path.join(directory, ".writer-lock"),
        temp = file + "." + crypto.randomUUID() + ".tmp";
      try {
        try {
          lock = await fs.open(lockFile, "wx");
        } catch {
          if (Date.now() - (await fs.stat(lockFile)).mtimeMs <= 7_200_000)
            return;
          await fs.rm(lockFile, { force: true });
          lock = await fs.open(lockFile, "wx");
        }
        const size = (await fs.stat(source)).size;
        if (size > budget) return;
        let used = 0;
        const entries = (
          await Promise.all(
            (await fs.readdir(directory))
              .filter((n) => /^[a-f0-9]{64}\.(mp4|mkv|webm)$/.test(n))
              .map(async (n) => ({
                name: n,
                stat: await fs.stat(path.join(directory, n)),
              })),
          )
        ).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
        for (const entry of entries) {
          used += entry.stat.size;
          if (
            used + size > budget ||
            Date.now() - entry.stat.mtimeMs > 7 * 86400_000
          ) {
            await fs.rm(path.join(directory, entry.name), { force: true });
            await fs.rm(
              path.join(directory, entry.name.replace(/\.[^.]+$/, ".json")),
              { force: true },
            );
            used -= entry.stat.size;
          }
        }
        await fs.copyFile(source, temp);
        const hash = await checksum(temp);
        await fs.rename(temp, file);
        await fs.writeFile(metadata, JSON.stringify({ size, hash }));
      } catch {
        /* Optional caching never changes export success. */
      } finally {
        await fs.rm(temp, { force: true }).catch(() => {});
        if (lock) {
          await lock.close().catch(() => {});
          await fs.rm(lockFile, { force: true }).catch(() => {});
        }
      }
    },
  };
}
