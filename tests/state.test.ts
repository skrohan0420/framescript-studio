import { beforeEach, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useStudio, useProjectState } from "../src/store";
import { newProject } from "../shared/project";
import { initialWorkflow } from "../shared/workflow";

beforeEach(() => useStudio.getState().load(newProject()));
it("a save acknowledgment cannot clear edits made after submission or project replacement", () => {
  useStudio.getState().change({ name: "Submitted" });
  const submitted = useStudio.getState().revision;
  useStudio.getState().change({ name: "Newer edit" });
  useStudio.getState().saved(submitted);
  expect(useStudio.getState().dirty).toBe(true);
  useStudio.getState().saved(useStudio.getState().revision);
  expect(useStudio.getState().dirty).toBe(false);
  useStudio.getState().load(newProject());
  useStudio.getState().change({ name: "Different project" });
  useStudio.getState().saved(submitted);
  expect(useStudio.getState().dirty).toBe(true);
});
it("editing a large storyboard preserves unchanged media and rejects an overlong composition", () => {
  const p = newProject();
  p.assets = [
    {
      id: "large",
      name: "image",
      data: "data:image/png;base64," + "A".repeat(1_000_000),
    },
  ];
  p.workflow = initialWorkflow(p);
  p.workflow.scenes = Array.from({ length: 30 }, (_, i) => ({
    ...p.workflow!.scenes[0],
    id: "scene-" + (i + 1),
    duration: 20,
  }));
  p.settings.duration = 20;
  useStudio.getState().load(p);
  const assets = useStudio.getState().project.assets;
  useStudio.getState().change({ html: "<h1>Typing</h1>" });
  expect(useStudio.getState().project.assets).toBe(assets);
  expect(useStudio.getState().project.workflow?.scenes[0].html).toContain(
    "Typing",
  );
  useStudio.getState().change({ settings: { ...p.settings, duration: 21 } });
  expect(useStudio.getState().project.settings.duration).toBe(20);
  expect(useStudio.getState().error).toContain("ten minutes");
});
it("editing subscriptions do not rerender for playback ticks", () => {
  let renders = 0;
  const hook = renderHook(() => {
    renders++;
    return useProjectState();
  });
  const before = renders;
  act(() => {
    for (let i = 0; i < 100; i++) useStudio.getState().setTime(i / 30);
  });
  expect(renders).toBe(before);
  act(() => useStudio.getState().change({ name: "Updated" }));
  expect(hook.result.current.project.name).toBe("Updated");
  expect(renders).toBeGreaterThan(before);
});
