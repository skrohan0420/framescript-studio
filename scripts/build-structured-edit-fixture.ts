import { writeFile } from "node:fs/promises";
import { writeStructuredEditPackage } from "../server/structured-edit-package";
import { prepareEditCandidate } from "../shared/structured-edit";
import { structuredEditFixtureProject } from "../tests/fixtures/structured-edit/project";
import fixture from "../tests/fixtures/structured-edit/round-trip.json";

const { request, patch } = fixture;
const project = structuredEditFixtureProject();
const scene = project.workflow!.scenes[0].structuredEdit!;
const output = "test-results/structured-edit-fixture";
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const candidate = prepareEditCandidate(scene, request, patch);
const { prompt } = await writeStructuredEditPackage(
  scene,
  request.requestId,
  request.requestedValue,
  `${output}/fireworks-glow-edit.zip`,
  `${output}/saved-request.json`,
  project.workflow!.selectedId,
);
await Promise.all([
  writeFile(`${output}/copied-prompt.txt`, prompt),
  writeFile(`${output}/expected-result.json`, json(patch)),
  writeFile(`${output}/expected-candidate.json`, json(candidate)),
  writeFile(`${output}/fireworks-galaxy.frame`, json(project)),
]);
console.log(`Wrote the structured Edit fixture to ${output}`);
