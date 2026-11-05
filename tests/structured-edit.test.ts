import { expect, it } from "vitest";
import { prepareEditCandidate } from "../shared/structured-edit";
import fixture from "./fixtures/structured-edit/round-trip.json";
import { editSceneSchema } from "../shared/structured-edit";
import { structuredClipTiming } from "../shared/structured-edit-timing";

it("edits a declared shape track without changing other scene content", () => {
  const scene = editSceneSchema.parse({
    ...fixture.scene,
    objects: [
      {
        id: "planet",
        kind: "circle",
        x: 20,
        y: 40,
        width: 60,
        height: 60,
        color: "#0088ff",
        opacity: 1,
        tracks: [
          { property: "x", keyframe: { id: "move", frame: 30, value: 100 } },
        ],
      },
    ],
  });
  const target = { nodeId: "planet", property: "x", keyframeId: "move" };
  const request = {
    ...fixture.request,
    allowedTarget: target,
    requestedValue: 320,
  };
  const patch = {
    ...fixture.patch,
    operations: [{ ...target, op: "set-keyframe-value", value: 320 }],
  };
  const candidate = prepareEditCandidate(scene, request, patch);
  expect(candidate.objects![0].tracks[0].keyframe.value).toBe(320);
  expect(scene.objects![0].tracks[0].keyframe.value).toBe(100);
  expect(candidate.star).toEqual(scene.star);
  expect(candidate.label).toEqual(scene.label);
  expect(
    editSceneSchema.safeParse({
      ...scene,
      objects: [scene.objects![0], scene.objects![0]],
    }).success,
  ).toBe(false);
  const invalid = structuredClone(scene);
  invalid.objects![0].tracks[0].property = "opacity";
  expect(editSceneSchema.safeParse(invalid).success).toBe(false);
});

it("assigns a keyframe at a split boundary to the right clip only", () => {
  const structuredEdit = editSceneSchema.parse(fixture.scene);
  expect(
    structuredClipTiming({ structuredEdit, duration: 3.2 }),
  ).toBeUndefined();
  expect(
    structuredClipTiming({ structuredEdit, sourceOffset: 3.2, duration: 2.8 }),
  ).toMatchObject({ sourceTime: 3.2, clipTime: 0 });
  expect(
    structuredClipTiming({ structuredEdit, sourceOffset: 3.2, duration: 3 }),
  ).toBeUndefined();
});

it("changes only the requested keyframe value in the review candidate", () => {
  const original = structuredClone(fixture.scene);
  const expected = structuredClone(original);
  expected.star.keyframe.value = 0.8;

  expect(
    prepareEditCandidate(fixture.scene, fixture.request, fixture.patch),
  ).toEqual(expected);
  expect(fixture.scene).toEqual(original);
});

it.each([
  ["wrong request", { requestId: "another-request" }, /Wrong request ID/],
  ["wrong scene", { sceneId: "another-scene" }, /Wrong target scene/],
  ["stale patch", { baseRevision: 13 }, /Stale scene revision/],
])("rejects %s", (_name, change, message) => {
  expect(() =>
    prepareEditCandidate(fixture.scene, fixture.request, {
      ...fixture.patch,
      ...change,
    }),
  ).toThrow(message);
});

it.each([
  [
    "out-of-scope node",
    { nodeId: "galaxy-label" },
    /outside the saved request scope/,
  ],
  [
    "out-of-scope keyframe",
    { keyframeId: "another-keyframe" },
    /outside the saved request scope/,
  ],
  ["invalid value", { value: 1.4 }, /<=1/],
  ["unrequested value", { value: 0.7 }, /differs from the saved request/],
  ["keyframe time change", { frame: 97 }, /Unrecognized key/],
])("rejects %s", (_name, change, message) => {
  expect(() =>
    prepareEditCandidate(fixture.scene, fixture.request, {
      ...fixture.patch,
      operations: [{ ...fixture.patch.operations[0], ...change }],
    }),
  ).toThrow(message);
});

it("rejects a valid result when the current scene revision has advanced", () => {
  expect(() =>
    prepareEditCandidate(
      { ...fixture.scene, revision: 15 },
      fixture.request,
      fixture.patch,
    ),
  ).toThrow("Stale scene revision");
});
