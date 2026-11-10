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
    const capture = path.join(root, "handoff.png");
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
        format: "png",
        width: input.settings.width,
        height: input.settings.height,
        fps: input.settings.fps,
        duration: input.settings.duration,
        time: input.lastFrameTime,
        speed: 1,
        quality: 0,
        fit: "fit",
        transparent: false,
        acceleration: "software",
      },
      capture,
      ffmpeg ?? "",
      AbortSignal.timeout(45_000),
      () => {},
      chrome,
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
      {
        path: "references/handoff.png",
        role: "handoff",
        content: await fs.readFile(capture),
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
