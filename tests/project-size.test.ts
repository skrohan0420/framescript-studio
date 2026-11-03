import { expect, it } from "vitest";
import { newProject } from "../shared/project";
import { projectBytes } from "../shared/project-size";
import { useStudio } from "../src/store";
import { clipFromAudio } from "../src/audio";

it("counts repeated sources as they travel in JSON, including escaped and Unicode URIs", () => {
  const p = newProject();
  p.assets = [
    {
      id: "a",
      name: "image",
      data: 'data:image/svg+xml,<svg title="é😀">\\</svg>',
    },
  ];
  expect(projectBytes(p)).toBe(
    new TextEncoder().encode(JSON.stringify(p)).length,
  );
  const clip = clipFromAudio(
    { name: "a", data: "data:audio/wav;base64,AAAA", duration: 5 },
    "voice",
  );
  p.audioLibrary = [clip];
  p.audio = [clip, { ...clip, id: "b" }];
  expect(projectBytes(p)).toBe(
    new TextEncoder().encode(JSON.stringify(p)).length,
  );
});

it("rejects a repeated-media addition over the limit without changing project or undo history", () => {
  const p = newProject();
  const clip = clipFromAudio(
    {
      name: "large",
      data: "data:audio/wav;base64," + "A".repeat(12_000_000),
      duration: 5,
    },
    "voice",
  );
  p.audioLibrary = [clip];
  p.audio = Array.from({ length: 5 }, (_, i) => ({
    ...clip,
    id: String(i),
    sourceId: clip.id,
  }));
  useStudio.getState().load(p);
  const before = useStudio.getState();
  useStudio
    .getState()
    .change({
      audio: [...p.audio, { ...clip, id: "6" }, { ...clip, id: "7" }],
    });
  expect(useStudio.getState().error).toContain("90 MB");
  expect(useStudio.getState().project).toBe(before.project);
  expect(useStudio.getState().past).toBe(before.past);
  useStudio.getState().change({ name: "Still editable" });
  expect(useStudio.getState().project.name).toBe("Still editable");
  useStudio.getState().load(newProject());
});
