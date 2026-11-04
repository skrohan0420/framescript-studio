import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { z } from "zod";
import { archiveSequence } from "../server/archive";
import {
  editPatchSchema,
  prepareEditCandidate,
} from "../shared/structured-edit";
import fixture from "../tests/fixtures/structured-edit/round-trip.json";

const { scene, request, patch } = fixture;
const candidate = prepareEditCandidate(scene, request, patch);
const output = "test-results/structured-edit-fixture";
const packageRoot = `${output}/package`;
const frame = scene.star.keyframe.frame;
const seconds = (frame / scene.fps).toFixed(3);
const framePath = `references/preview-frames/glow-${seconds}s.png`;
const moduleSource = await readFile("tests/fixtures/structured-edit/star.mjs");
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const brief = `Edit ${scene.title}, revision ${scene.revision}. Set the star's glow at ${seconds}s to ${request.requestedValue}. Preserve the keyframe time, label and unrelated content.`;
const prompt = `${brief}\n\nOpen the attached ZIP and read TASK.md first. Inspect ${framePath} and return JSON following OUTPUT_CONTRACT.md. If you cannot access a required file, name it before proceeding.\n`;

const browser = await chromium.launch();
const screenshot = await (async () => {
  try {
    const page = await browser.newPage({
      viewport: { width: scene.width, height: scene.height },
    });
    await page.setContent(`
      <style>body{margin:0}span{position:absolute;bottom:24px;width:100%;text-align:center;color:white;font:24px sans-serif}</style>
      <canvas width="${scene.width}" height="${scene.height}"></canvas>
      <span></span>
      <script type="module">
        import { renderStar } from "data:text/javascript;base64,${moduleSource.toString("base64")}";
        renderStar(document.querySelector("canvas").getContext("2d"),
          { glowIntensity: ${scene.star.keyframe.value} });
        document.querySelector("span").textContent = ${JSON.stringify(scene.label.text)};
      </script>
    `);
    await page.getByText(scene.label.text, { exact: true }).waitFor();
    return await page.screenshot();
  } finally {
    await browser.close();
  }
})();

const files = [
  {
    path: "TASK.md",
    role: "task",
    content: `${prompt}\nTarget \`${scene.star.id}.glowIntensity\` keyframe \`${scene.star.keyframe.id}\` at frame ${frame}. Read \`source/scene.json\` for the current value and use the preview PNG as evidence of the current appearance.\n`,
  },
  {
    path: "OUTPUT_CONTRACT.md",
    role: "contract",
    content: `Return one JSON object conforming to \`schemas/edit-result.schema.json\`. Echo request ID \`${request.requestId}\`, scene ID \`${scene.sceneId}\` and base revision ${scene.revision}. The only allowed operation is \`set-keyframe-value\` on \`${scene.star.id}.glowIntensity\`, keyframe \`${scene.star.keyframe.id}\`, with value ${request.requestedValue}.\n`,
  },
  { path: "source/scene.json", role: "scene-source", content: json(scene) },
  {
    path: scene.star.modulePath,
    role: "runtime-module",
    content: moduleSource,
  },
  {
    path: framePath,
    role: "required-evidence",
    content: screenshot,
    frame,
    sceneRevision: scene.revision,
  },
  {
    path: "schemas/edit-result.schema.json",
    role: "schema",
    content: json(z.toJSONSchema(editPatchSchema)),
  },
];

for (const { path, content } of files) {
  await mkdir(`${packageRoot}/${path.slice(0, path.lastIndexOf("/") + 1)}`, {
    recursive: true,
  });
  await writeFile(`${packageRoot}/${path}`, content);
}
await writeFile(
  `${packageRoot}/manifest.json`,
  json({
    packageType: "framescript-task",
    packageVersion: "1",
    ...request,
    files: files.map(({ content, ...entry }) => ({
      ...entry,
      sha256: createHash("sha256").update(content).digest("hex"),
    })),
  }),
);
await archiveSequence(
  packageRoot,
  `${output}/fireworks-glow-edit.zip`,
  new AbortController().signal,
);
await writeFile(`${output}/copied-prompt.txt`, prompt);
await writeFile(`${output}/saved-request.json`, json(request));
await writeFile(`${output}/expected-result.json`, json(patch));
await writeFile(`${output}/expected-candidate.json`, json(candidate));
console.log(`Wrote the Stage 1 fixture to ${output}`);
