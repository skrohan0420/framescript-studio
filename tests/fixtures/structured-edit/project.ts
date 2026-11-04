import { newProject, projectSchema } from "../../../shared/project";
import { editSceneSchema } from "../../../shared/structured-edit";
import { structuredStarCode } from "../../../shared/structured-star";
import { initialWorkflow } from "../../../shared/workflow";
import fixture from "./round-trip.json" with { type: "json" };

export function structuredEditFixtureProject() {
  const scene = editSceneSchema.parse(fixture.scene);
  const base = newProject();
  const project = {
    ...base,
    ...structuredStarCode(scene),
    name: scene.title,
    settings: {
      ...base.settings,
      width: scene.width,
      height: scene.height,
      fps: scene.fps,
      duration: scene.durationFrames / scene.fps,
      speed: 1,
    },
  };
  const workflow = initialWorkflow(project);
  workflow.scenes[0].structuredEdit = scene;
  return projectSchema.parse({ ...project, workflow });
}
