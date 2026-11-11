import { expect, it } from "vitest";
import { newProject, projectSchema } from "../shared/project";
import { editCodeContinuation } from "../shared/code-continuation";
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
  expect(
    resizeVisual({ ...p, audio: [] }, p.workflow.selectedId, -10).settings!
      .duration,
  ).toBe(0.1);
});

it("resizes individual visual blocks, keeps their joins closed and preserves audio placement", () => {
  const p = newProject();
  p.settings.duration = 10;
  p.workflow = initialWorkflow(p);
  const scene = p.workflow.scenes[0];
  scene.visualDuration = 2;
  const code = { html: "<div>Continuation</div>", css: "", js: "" };
  scene.visualContinuations = [
    { ...code, id: crypto.randomUUID(), start: 2, duration: 3 },
    { ...code, id: crypto.randomUUID(), start: 5, duration: 3 },
  ];
  p.audio = [
    {
      ...clipFromAudio(synthesizeSound("Ambient loop"), "voice", scene.id),
      start: 7,
      length: 3,
    },
  ];
  const first = scene.visualContinuations[0].id;
  const resized = projectSchema.parse({
    ...p,
    ...resizeVisual(p, scene.id, 4, first),
  });
  expect(
    resized.workflow!.scenes[0].visualContinuations!.map(
      ({ start, duration }) => [start, duration],
    ),
  ).toEqual([
    [2, 4],
    [6, 3],
  ]);
  expect(resized.audio).toEqual(p.audio);
  expect(resized.settings.duration).toBe(10);
  const shorter = projectSchema.parse({
    ...p,
    ...resizeVisual(p, scene.id, 1),
  });
  expect(
    shorter.workflow!.scenes[0].visualContinuations!.map(({ start }) => start),
  ).toEqual([1, 4]);
  expect(shorter.workflow!.scenes[0].visualDuration).toBe(1);
  expect(shorter.settings.duration).toBe(10);
  const limited = projectSchema.parse({
    ...p,
    ...resizeVisual(p, scene.id, 999, first),
  });
  expect(limited.settings.duration).toBe(600);
  expect(
    limited.workflow!.scenes[0].visualContinuations!.at(-1)!.start + 3,
  ).toBe(600);
  expect(() => resizeVisual(p, scene.id, 2, "missing")).toThrow("unavailable");
  scene.locked = true;
  expect(() => resizeVisual(p, scene.id, 4, first)).toThrow("unlocked");
});

it("edits only the selected continuation and validates its source and lock", () => {
  const p = newProject();
  p.workflow = initialWorkflow(p);
  const scene = p.workflow.scenes[0];
  scene.visualDuration = 2;
  scene.visualContinuations = [
    {
      id: crypto.randomUUID(),
      start: 2,
      duration: 3,
      html: "<p>Before</p>",
      css: "",
      js: "",
    },
  ];
  const id = scene.visualContinuations[0].id;
  const result = projectSchema.parse({
    ...p,
    ...editCodeContinuation(p, scene.id, id, { html: "<p>After</p>" }),
  });
  expect(result.html).toBe(p.html);
  expect(result.workflow!.scenes[0].html).toBe(scene.html);
  expect(result.workflow!.scenes[0].visualContinuations![0]).toEqual({
    ...scene.visualContinuations[0],
    html: "<p>After</p>",
  });
  expect(() =>
    editCodeContinuation(p, scene.id, "missing", { css: "" }),
  ).toThrow("unavailable");
  scene.locked = true;
  expect(() => editCodeContinuation(p, scene.id, id, { css: "" })).toThrow(
    "Unlock",
  );
});
