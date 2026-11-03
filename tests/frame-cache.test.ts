// @vitest-environment node
import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { frameCache, frameDependencies } from "../server/frame-cache";
import { newProject, type ExportOptions } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { composeProject } from "../shared/composition";
const options: ExportOptions = {
  format: "mp4",
  width: 3840,
  height: 2160,
  fps: 60,
  duration: 2,
  speed: 1,
  quality: 20,
  fit: "fit",
  transparent: false,
  time: 0,
};
it("reuses independent built-in scenes without trusting custom composition code", () => {
  const p = newProject();
  p.settings.duration = 1;
  p.workflow = initialWorkflow(p);
  p.workflow.scenes.push({
    ...p.workflow.scenes[0],
    id: "second",
    html: "<div>Second</div>",
  });
  const before = composeProject(p),
    key = frameDependencies(before);
  p.workflow.scenes[1].html = "<div>Changed</div>";
  const changed = frameDependencies(composeProject(p));
  expect(changed(0.25)).toEqual(key(0.25));
  expect(changed(1.25)).not.toEqual(key(1.25));
  expect(key(1.25 + 1e-12)).not.toEqual(key(1.25));
  const custom = frameDependencies({
    ...before,
    js: before.js + ";document.body.style.opacity=.5",
  });
  expect(custom(0.25)).not.toEqual(key(0.25));
});
it("invalidates only scenes referencing a changed asset", () => {
  const p = newProject();
  p.settings.duration = 1;
  p.html = '<img src="asset://first">';
  p.assets = [
    { id: "first", name: "first.png", data: "data:image/png;base64,AAAA" },
    { id: "second", name: "second.png", data: "data:image/png;base64,BBBB" },
  ];
  p.workflow = initialWorkflow(p);
  p.workflow.scenes.push({
    ...p.workflow.scenes[0],
    id: "second-scene",
    html: '<img src="asset://second">',
  });
  const before = frameDependencies(composeProject(p));
  p.assets[1].data = "data:image/png;base64,CCCC";
  const after = frameDependencies(composeProject(p));
  expect(after(0.5)).toEqual(before(0.5));
  expect(after(1.5)).not.toEqual(before(1.5));
});
it("stores lossless frames, invalidates dependencies and tolerates corrupt cache files", async () => {
  const dir = path.resolve("test-results/cache-" + crypto.randomUUID());
  const project = newProject();
  project.settings = {
    ...project.settings,
    width: 3840,
    height: 2160,
    fps: 60,
  };
  try {
    const cache = await frameCache(
      dir,
      project,
      options,
      "browser-a|gpu-a",
      "rgba",
    );
    const data = Buffer.from("exact pixels and alpha\0\xff");
    expect(await cache.get(0)).toBeUndefined();
    await cache.put(0, data);
    expect(await cache.get(0)).toEqual(data);
    expect(
      await (
        await frameCache(
          dir,
          { ...project, js: "changed" },
          options,
          "browser-a|gpu-a",
          "rgba",
        )
      ).get(0),
    ).toBeUndefined();
    expect(
      await (
        await frameCache(
          dir,
          project,
          options,
          "different-browser|gpu-a",
          "rgba",
        )
      ).get(0),
    ).toBeUndefined();
    expect(
      await (
        await frameCache(
          dir,
          project,
          { ...options, fit: "fill" },
          "browser-a|gpu-a",
          "rgba",
        )
      ).get(0),
    ).toBeUndefined();
    expect(await cache.get(1 / 60)).toBeUndefined();
    for (const name of (await fs.readdir(dir)).filter((name) =>
      name.endsWith(".gz"),
    ))
      await fs.writeFile(path.join(dir, name), "corrupt");
    expect(await cache.get(0)).toBeUndefined();
    await cache.put(0, data);
    await cache.prune(0);
    expect(await cache.get(0)).toBeUndefined();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
