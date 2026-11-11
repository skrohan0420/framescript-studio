import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import { chromium } from "playwright";
import {
  buildCodeContinuationPrompt,
  type CodeContinuationInput,
} from "../shared/code-continuation";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { archiveGenerateFiles } from "./structured-generate-package";
import {
  describePackageFiles,
  packageReferences,
} from "./structured-package-context";
import { renderExport } from "./export";

export async function writeCodeContinuationPackage(
  input: CodeContinuationInput,
  destination: string,
) {
  const root = await fs.mkdtemp(
    path.join(path.dirname(destination), "code-continuation-"),
  );
  try {
    const capture = path.join(root, "frames");
    const step =
      Math.max(1, Math.round(input.settings.fps / 10)) / input.settings.fps;
    const frameCount = Math.min(
      6,
      Math.floor(input.lastFrameTime / step + 1e-9) + 1,
    );
    const firstFrameTime = Math.max(
      0,
      input.lastFrameTime - (frameCount - 1) * step,
    );
    const frames = Array.from({ length: frameCount }, (_, index) => {
      const time =
        index === frameCount - 1
          ? input.lastFrameTime
          : firstFrameTime + index * step;
      return {
        path:
          index === frameCount - 1
            ? "references/handoff.png"
            : `references/motion-${index + 1}.png`,
        time,
        sourceTime: input.sourceOffset + time,
      };
    });
    const project = {
      ...newProject(),
      ...input.source,
      assets: input.assets,
      settings: input.settings,
    };
    const workflow = initialWorkflow(project);
    workflow.scenes[0].sourceOffset = input.sourceOffset;
    const chrome =
      !existsSync(chromium.executablePath()) && process.platform === "win32"
        ? [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]
            .filter((folder): folder is string => !!folder)
            .flatMap((folder) => [
              path.join(folder, "Google/Chrome/Application/chrome.exe"),
              path.join(folder, "Microsoft/Edge/Application/msedge.exe"),
            ])
            .find(existsSync)
        : undefined;
    await renderExport(
      { ...project, workflow },
      {
        format: "sequence",
        width: input.settings.width,
        height: input.settings.height,
        fps: 10,
        duration: frameCount / 10,
        time: 0,
        speed: 1,
        quality: 0,
        fit: "fit",
        transparent: false,
        acceleration: "software",
      },
      capture,
      ffmpeg ?? "",
      AbortSignal.timeout(60_000),
      () => {},
      chrome,
      { workers: 1, sequenceTimes: frames.map((frame) => frame.time) },
    );
    const prompt = buildCodeContinuationPrompt(input);
    const files = [
      { path: "TASK.md", role: "task", content: prompt },
      {
        path: "source/previous.html",
        role: "source",
        content: input.source.html,
      },
      {
        path: "source/previous.css",
        role: "source",
        content: input.source.css,
      },
      { path: "source/previous.js", role: "source", content: input.source.js },
      ...(await Promise.all(
        frames.map(async (frame, index) => ({
          path: frame.path,
          role: index === frameCount - 1 ? "handoff" : "motion-reference",
          content: await fs.readFile(
            path.join(capture, `frame-${String(index).padStart(6, "0")}.png`),
          ),
        })),
      )),
      {
        path: "references/motion.json",
        role: "motion-timing",
        content: JSON.stringify(
          {
            frames,
            fps: input.settings.fps,
            sourceOffset: input.sourceOffset,
            previousDuration: input.settings.duration,
            sourceTimeAtHandoff: input.sourceOffset + input.settings.duration,
            timelineHandoff: input.timelineHandoff,
            width: input.settings.width,
            height: input.settings.height,
            background: input.settings.background,
          },
          null,
          2,
        ),
      },
      {
        path: "context/narration.srt",
        role: "narration",
        content: input.narration,
      },
      ...(input.inheritedContext
        ? [
            {
              path: "context/inherited.json",
              role: "inherited",
              content: input.inheritedContext,
            },
          ]
        : []),
      ...(input.assets.length
        ? [
            {
              path: "source/assets.json",
              role: "source-assets",
              content: JSON.stringify(input.assets),
            },
          ]
        : []),
      ...packageReferences(input.references),
    ];
    await archiveGenerateFiles(destination, files, {
      packageType: "framescript-task",
      packageVersion: "1",
      mode: "extend-code",
      format: "document",
      handoff: input.handoff,
      timelineHandoff: input.timelineHandoff,
      lastFrameTime: input.lastFrameTime,
      sourceOffset: input.sourceOffset,
      duration: input.duration,
      files: describePackageFiles(files),
    });
    return prompt;
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
