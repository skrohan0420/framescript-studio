// @vitest-environment node
import { expect, it } from "vitest";
import { previewDocument, previewScale } from "../src/preview-document";
import { newProject } from "../shared/project";
import { documentFor } from "../shared/runtime";
it("preview settings never modify export documents or project settings", () => {
  const p = newProject();
  p.settings = { ...p.settings, width: 3840, height: 2160, fps: 60 };
  p.html = '<canvas width="3840" height="2160"></canvas>';
  p.js = "FrameScript3D.create({});";
  const snapshot = JSON.stringify(p),
    before = documentFor(p, { export: true });
  const preview = previewDocument(p, 0.25, true);
  expect(preview).toContain("PreviewRenderer");
  expect(preview).toContain("preview-seek-done");
  expect(JSON.stringify(p)).toBe(snapshot);
  expect(documentFor(p, { export: true })).toBe(before);
  expect(before).not.toContain("PreviewRenderer");
  expect(before).not.toContain("preview-seek-done");
  expect(previewScale("auto", 2160, 400, 1)).toBe(0.25);
  expect(previewScale("1080", 2160, 400, 1)).toBe(0.5);
  expect(previewScale("full", 2160, 400, 2)).toBe(1);
  expect(previewScale("auto", 720, 1200, 2)).toBe(1);
});
