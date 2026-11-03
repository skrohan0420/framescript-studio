import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { homedir, release } from "node:os";
import path from "node:path";
import { newProject } from "../shared/project";
import { documentFor } from "../shared/runtime";
import { threeSource } from "../shared/three-source.generated";
const empty = newProject();
empty.html = "";
empty.css = "";
empty.js = "";
const engine = createHash("sha256")
  .update(documentFor(empty, { export: true, textEditing: false }))
  .update(threeSource)
  .digest("hex");
export async function renderEnvironment(
  browser: string,
  gpu: string,
  ffmpeg: string,
) {
  const fonts =
    process.platform === "win32"
      ? [
          path.join(process.env.WINDIR ?? "C:/Windows", "Fonts"),
          path.join(homedir(), "AppData/Local/Microsoft/Windows/Fonts"),
        ]
      : process.platform === "darwin"
        ? [
            "/System/Library/Fonts",
            "/Library/Fonts",
            path.join(homedir(), "Library/Fonts"),
          ]
        : ["/usr/share/fonts", path.join(homedir(), ".local/share/fonts")];
  const versions = await Promise.all(
    [...fonts, ffmpeg].map(async (file) => {
      try {
        const s = await fs.stat(file);
        return [file, s.mtimeMs, s.size];
      } catch {
        return [file, null];
      }
    }),
  );
  return JSON.stringify([
    engine,
    browser,
    gpu,
    process.platform,
    release(),
    versions,
  ]);
}
