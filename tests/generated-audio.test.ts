import { expect, it } from "vitest";
import {
  applyGeneratedAudio,
  generatedAudioSchema,
} from "../shared/generated-audio";
import { newProject, parseCombined } from "../shared/project";
import { useStudio } from "../src/store";
const tracks = [
  {
    id: "score",
    name: "Score",
    lane: "music",
    start: 0,
    length: 10,
    duration: 1,
    loop: true,
    volume: 0.3,
    notes: [{ at: 0, duration: 0.9, frequency: 220, gain: 0.3 }],
  },
];
const manifest = `<script type="application/json" id="framescript-audio">${JSON.stringify({ tracks })}</script>`;
it("preserves soundtrack JSON in HTML while extracting executable JavaScript", () => {
  const source = parseCombined(
    `<html><head>${manifest}<style>body{margin:0}</style></head><body><h1>Scene</h1><script>window.renderFrame=()=>{};</script></body></html>`,
  );
  expect(source.html).toContain('id="framescript-audio"');
  expect(source.js).toBe("window.renderFrame=()=>{};");
});
it("synthesizes audible deterministic audio and updates without duplicating generated tracks", () => {
  const project = { ...newProject(), html: manifest };
  const first = applyGeneratedAudio(project);
  expect(first.audio).toHaveLength(1);
  expect(first.audio![0]).toMatchObject({
    name: "Score",
    length: 10,
    loop: true,
  });
  const bytes = Uint8Array.from(
    atob(first.audio![0].data.split(",")[1]),
    (character) => character.charCodeAt(0),
  );
  expect(bytes.subarray(44).some((sample) => sample !== 0)).toBe(true);
  expect(applyGeneratedAudio(first).audio![0].id).toBe(first.audio![0].id);
  useStudio.getState().load(newProject());
  useStudio.getState().change({ html: manifest }, "Paste full HTML document");
  expect(useStudio.getState().project.audio).toHaveLength(1);
  useStudio.getState().change({ html: manifest + "<h1>Updated visual</h1>" });
  expect(useStudio.getState().project.audio).toHaveLength(1);
  useStudio.getState().undo();
  useStudio.getState().undo();
  expect(useStudio.getState().project.audio ?? []).toHaveLength(0);
});
it("rejects malformed scores and keeps the prior project intact", () => {
  expect(
    generatedAudioSchema.safeParse({
      tracks: [
        { ...tracks[0], notes: [{ at: 1, duration: 4, frequency: 220 }] },
      ],
    }).success,
  ).toBe(false);
  useStudio.getState().load(newProject());
  const before = useStudio.getState().project;
  useStudio
    .getState()
    .change({
      html: '<script type="application/json" id="framescript-audio">invalid</script>',
    });
  expect(useStudio.getState().project).toBe(before);
  expect(useStudio.getState().error).toContain("Generated audio");
});
