import { expect, it } from "vitest";
import { prepareEditCandidate } from "../shared/structured-edit";
import fixture from "./fixtures/structured-edit/round-trip.json";

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
