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
it("trims the visual independently and keeps the scene long enough for its audio", () => {
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
  expect(result.settings!.duration).toBe(6);
  expect(result.workflow!.scenes[0].visualDuration).toBe(2);
  expect({ ...p, ...result }.audio).toEqual([clip]);
  expect(resizeVisual({ ...p, audio: [] }, p.workflow.selectedId, -10).settings!.duration).toBe(0.1);
});
