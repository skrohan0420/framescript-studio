import { promises as fs } from "node:fs";
import path from "node:path";

export class ExportRetention {
  readonly retentionDays = 7;
  private active = new Map<string, number>();
  constructor(private directory: string) {}
  protect(file: string) {
    this.active.set(file, (this.active.get(file) ?? 0) + 1);
    return () => {
      const count = (this.active.get(file) ?? 1) - 1;
      if (count) this.active.set(file, count);
      else this.active.delete(file);
    };
  }
  async inspect(clear = false, now = Date.now()) {
    let files = 0,
      bytes = 0;
    const removed = new Set<string>();
    for (const entry of await fs.readdir(this.directory, {
      withFileTypes: true,
    })) {
      // Only generated output files directly in the managed directory.
      if (
        !entry.isFile() ||
        !/^[a-f0-9-]{36}\.(?:mp4|mkv|webm|gif|png|html|sequence\.zip|stems\.zip)$/.test(
          entry.name,
        )
      )
        continue;
      const file = path.join(this.directory, entry.name);
      const stat = await fs.stat(file).catch(() => null);
      if (!stat) continue;
      if (
        !this.active.has(file) &&
        (clear || now - stat.mtimeMs >= this.retentionDays * 86_400_000)
      ) {
        try {
          await fs.unlink(file);
          removed.add(file);
          continue;
        } catch {
          /* Retain files locked by the OS. */
        }
      }
      files++;
      bytes += stat.size;
    }
    return { files, bytes, retentionDays: this.retentionDays, removed };
  }
}
