import { it, expect, beforeEach } from "vitest";
import { newProject, projectSchema } from "../shared/project";
import {
  localStoryboard,
  verifyPlan,
  scenesFromPlan,
  initialWorkflow,
  activateScene,
  selectedScene,
  templateCode,
  totalDuration,
  mascotPrompt,
} from "../shared/workflow";
import { composeProject } from "../shared/composition";
import { useStudio } from "../src/store";
beforeEach(() => useStudio.getState().load(newProject()));
const script =
  "Our universe is enormous. Every star has a story. Some stars live for billions of years. Others burn brightly before exploding. A telescope lets us explore their light and understand our place in space. Small discoveries can change how we see everything.";
it("splits scripts without rewriting or dropping narration and rejects incomplete AI plans", () => {
  const plan = localStoryboard(script);
  expect(verifyPlan(script, plan).scenes.length).toBeGreaterThan(1);
  expect(() =>
    verifyPlan(script, {
      scenes: [
        {
          title: "Bad",
          narration: "Missing content",
          visual: "x",
          duration: 3,
          template: "headline",
        },
      ],
    }),
  ).toThrow("omitted or rewrote");
});
it("keeps source code independent across scene switches and saves a portable storyboard", () => {
  const p = newProject(),
    scenes = scenesFromPlan(script, localStoryboard(script), p),
    workflow = {
      ...initialWorkflow(p),
      script,
      scenes,
      selectedId: scenes[0].id,
    };
  useStudio
    .getState()
    .change({
      ...activateScene({ ...p, workflow }, workflow.selectedId),
      workflow,
    });
  useStudio.getState().change({ html: "<h1>First edit</h1>" });
  let state = useStudio.getState();
  state.change(activateScene(state.project, scenes[1].id));
  state = useStudio.getState();
  expect(state.project.html).not.toContain("First edit");
  state.change({ html: "<h1>Second edit</h1>" });
  state = useStudio.getState();
  state.change(activateScene(state.project, scenes[0].id));
  expect(useStudio.getState().project.html).toContain("First edit");
  const saved = projectSchema.parse(
    JSON.parse(JSON.stringify(useStudio.getState().project)),
  );
  expect(saved.workflow?.scenes[1].html).toContain("Second edit");
  expect(totalDuration(saved)).toBe(scenes.reduce((n, s) => n + s.duration, 0));
});
it("protects approved scene source and supports undoing storyboard edits", () => {
  const p = newProject(),
    workflow = initialWorkflow(p);
  workflow.scenes[0].locked = true;
  useStudio.getState().change({ workflow });
  useStudio.getState().change({ html: "<h1>overwrite</h1>" });
  expect(useStudio.getState().project.html).toBe(p.html);
  expect(useStudio.getState().error).toContain("locked");
  useStudio.getState().undo();
  expect(useStudio.getState().project.workflow).toBeUndefined();
});
it("escapes typography input and keeps mascot identity context in variation prompts", () => {
  expect(templateCode("headline", "<script>alert(1)</script>").html).toContain(
    "&lt;script&gt;",
  );
  const p = newProject();
  p.workflow = initialWorkflow(p);
  p.workflow.mascot.name = "Orbit";
  expect(mascotPrompt(p, "Waving")).toContain("Orbit");
  expect(mascotPrompt(p, "Waving")).toContain("Waving");
  const master = composeProject(p);
  expect(master.html).toContain('sandbox="allow-scripts"');
  expect(master.workflow).toBeUndefined();
});
