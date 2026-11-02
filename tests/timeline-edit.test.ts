import { expect, it } from "vitest";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import { splitVisual, resizeVisual } from "../shared/timeline-edit";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";

it("splits visuals with continuous source time and divides attached audio", () => {
  const p = newProject();
  p.settings.duration = 8;
  p.workflow = initialWorkflow(p);
  const clip = clipFromAudio(
    synthesizeSound("Ambient loop"),
    "voice",
    p.workflow.selectedId,
  );
  clip.length = 6;
  p.audio = [clip];
  const result = splitVisual(p, p.workflow.selectedId, 3);
  expect(result.workflow!.scenes.map((s) => s.duration)).toEqual([3, 5]);
  expect(result.workflow!.scenes[1].sourceOffset).toBe(3);
  expect(result.audio!.map((a) => [a.start, a.trimIn, a.length])).toEqual([
    [0, 0, 3],
    [0, 3, 3],
  ]);
  expect(() => splitVisual(p, p.workflow!.selectedId, 0)).toThrow();
  p.workflow.scenes[0].locked = true;
  expect(() => splitVisual(p, p.workflow!.selectedId, 3)).toThrow();
});
it("trimming caps duration and prevents attached audio extending beyond the visual", () => {
  const p = newProject();
  p.settings.duration = 8;
  p.workflow = initialWorkflow(p);
  const clip = clipFromAudio(
    synthesizeSound("Ambient loop"),
    "voice",
    p.workflow.selectedId,
  );
  clip.length = 6;
  p.audio = [clip];
  const result = resizeVisual(p, p.workflow.selectedId, 2);
  expect(result.settings!.duration).toBe(2);
  expect(result.audio![0].length).toBe(2);
  expect(resizeVisual(p, p.workflow.selectedId, -10).settings!.duration).toBe(
    0.1,
  );
});
