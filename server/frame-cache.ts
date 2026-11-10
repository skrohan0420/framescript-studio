import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import type { Project, ExportOptions } from "../shared/project";
import { compositionCss, compositionScript } from "../shared/composition";
const compress = promisify(gzip),
  decompress = promisify(gunzip);
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const frameCacheVersion = "lossless-frames-v2";

// Only the exact built-in hard-cut composition can be keyed independently by
// scene. Arbitrary HTML/JS retains a whole-document dependency key.
export function frameDependencies(project: Project) {
  const whole = digest([
    project.html,
    project.css,
    project.js,
    project.settings.duration,
    project.assets,
    project.workflow?.scenes.find((s) => s.id === project.workflow?.selectedId)
      ?.sourceOffset ?? 0,
    project.workflow?.scenes.find((s) => s.id === project.workflow?.selectedId)
      ?.visualDuration ?? null,
    project.workflow?.scenes.find((s) => s.id === project.workflow?.selectedId)
      ?.visualContinuations ?? null,
  ]);
  try {
    if (project.css !== compositionCss)
      return (_time: number) => [whole, _time];
    const json = project.js.match(
      /^const scenes=(\[[\s\S]*?\]);window\.renderFrame=/,
    )?.[1];
    const offsets = JSON.parse(json ?? "null") as {
      start: number;
      duration: number;
    }[];
    if (
      !Array.isArray(offsets) ||
      !offsets.length ||
      offsets.some(
        (s) => !Number.isFinite(s.start) || !Number.isFinite(s.duration),
      ) ||
      project.js !== compositionScript(offsets)
    )
      return (t: number) => [whole, t];
    const frames = [
      ...project.html.matchAll(
        /<iframe id="scene-(\d+)" data-start="([^"]+)" title="[^"]*" sandbox="allow-scripts" srcdoc="([^"]*)"><\/iframe>/g,
      ),
    ];
    if (frames.map((frame) => frame[0]).join("\n") !== project.html)
      throw Error("Custom composition");
    const sources = frames.map((match, i) => {
      if (
        !match ||
        Number(match[1]) !== i ||
        Number(match[2]) !== offsets[i]?.start
      )
        throw Error("Custom composition");
      return digest([
        match[3],
        project.assets.filter((asset) =>
          match[3].includes("asset://" + asset.id),
        ),
      ]);
    });
    if (sources.length !== offsets.length) throw Error("Custom composition");
    return (t: number) => {
      let i = offsets.findIndex(
        (s) => t >= s.start && t < s.start + s.duration,
      );
      if (i < 0) i = offsets.length - 1;
      // Preserve the exact clock value. Rounding could merge times on opposite
      // sides of a user-defined reveal boundary; an extra miss is safer.
      return [sources[i], Math.max(0, t - offsets[i].start)];
    };
  } catch {
    return (t: number) => [whole, t];
  }
}

export async function frameCache(
  directory: string,
  project: Project,
  options: ExportOptions,
  environment: string,
  transport: string,
) {
  await fs.mkdir(directory, { recursive: true });
  const lockFile = path.join(directory, ".writer-lock");
  let lock: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    lock = await fs.open(lockFile, "wx");
  } catch {
    try {
      if (Date.now() - (await fs.stat(lockFile)).mtimeMs > 7_200_000) {
        await fs.rm(lockFile, { force: true });
        lock = await fs.open(lockFile, "wx");
      }
    } catch {}
  }
  const limit = 1536 * 1024 ** 2;
  let storedBytes = 0;
  // Exports are queued by the server. Account existing entries before accepting
  // new writes so a long first export cannot grow the cache without a bound.
  for (const name of await fs.readdir(directory)) {
    if (!/^[a-f0-9]{64}\.gz$/.test(name)) continue;
    try {
      storedBytes += (await fs.stat(path.join(directory, name))).size;
    } catch {}
  }
  const dependencies = frameDependencies(project);
  const context = digest([
    frameCacheVersion,
    environment,
    transport,
    {
      ...project.settings,
      duration: undefined,
      speed: undefined,
      loop: undefined,
    },
    options.width,
    options.height,
    options.fit,
    options.transparent,
  ]);
  const fileFor = (time: number) =>
    path.join(directory, digest([context, dependencies(time)]) + ".gz");
  return {
    async get(time: number) {
      try {
        return await decompress(await fs.readFile(fileFor(time)), {
          maxOutputLength: options.width * options.height * 5 + 1024 * 1024,
        });
      } catch {
        return undefined;
      }
    },
    async put(time: number, data: Buffer) {
      if (!lock) return;
      const target = fileFor(time),
        temporary = target + "." + crypto.randomUUID() + ".tmp";
      try {
        const bytes = await compress(data, { level: 1 });
        let previous = 0;
        try {
          previous = (await fs.stat(target)).size;
        } catch {}
        if (storedBytes - previous + bytes.length > limit) return;
        storedBytes += bytes.length - previous;
        await fs.writeFile(temporary, bytes);
        await fs.rename(temporary, target);
      } catch {
        /* Cache failures never prevent a correct export. */
      } finally {
        await fs.rm(temporary, { force: true }).catch(() => {});
      }
    },
    async prune(maxBytes = limit) {
      if (!lock) return;
      try {
        const files = (
          await Promise.all(
            (await fs.readdir(directory))
              .filter((n) => /^[a-f0-9]{64}\.gz$/.test(n))
              .map(async (name) => ({
                name,
                stat: await fs.stat(path.join(directory, name)),
              })),
          )
        ).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
        let total = 0;
        for (const file of files) {
          total += file.stat.size;
          if (
            total > maxBytes ||
            Date.now() - file.stat.mtimeMs > 7 * 86400_000
          )
            await fs
              .rm(path.join(directory, file.name), { force: true })
              .catch(() => {});
        }
      } catch {
        /* A concurrent prune or unavailable disk is harmless. */
      } finally {
        await lock.close().catch(() => {});
        lock = undefined;
        await fs.rm(lockFile, { force: true }).catch(() => {});
      }
    },
  };
}
