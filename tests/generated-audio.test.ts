import { expect, it } from "vitest";
import {
  applyGeneratedAudio,
  generatedAudioSchema,
  generatedAudioError,
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
  expect(useStudio.getState().project.audio ?? []).toHaveLength(0);
  useStudio.getState().change({ html: manifest + "<h1>Updated visual</h1>" });
  expect(useStudio.getState().project.audio ?? []).toHaveLength(0);
  useStudio.getState().undo();
  useStudio.getState().undo();
  expect(useStudio.getState().project.audio ?? []).toHaveLength(0);
});
it("ignores malformed soundtrack data when importing visuals", () => {
  expect(
    generatedAudioSchema.safeParse({
      tracks: [
        { ...tracks[0], notes: [{ at: 1, duration: 4, frequency: 220 }] },
      ],
    }).success,
  ).toBe(false);
  useStudio.getState().load(newProject());
  const before = useStudio.getState().project;
  useStudio.getState().change({
    html: '<script type="application/json" id="framescript-audio">invalid</script>',
  });
  expect(useStudio.getState().project.html).toContain("invalid</script>");
  expect(useStudio.getState().project.audio).toEqual(before.audio);
  expect(useStudio.getState().error).toBe("");
});

it("applies requested track volume and fades while keeping legacy defaults", () => {
  const customized = { ...tracks[0], volume: 0.18, fadeIn: 1.2, fadeOut: 1.5 };
  const html = `<script type="application/json" id="framescript-audio">${JSON.stringify({ tracks: [customized] })}</script>`;
  const result = applyGeneratedAudio({ ...newProject(), html });
  expect(result.audio![0]).toMatchObject({
    volume: 0.18,
    fadeIn: 1.2,
    fadeOut: 1.5,
  });
  const short = { ...customized, length: 1, fadeIn: 10, fadeOut: 10 };
  const bounded = applyGeneratedAudio({
    ...newProject(),
    html: `<script type="application/json" id="framescript-audio">${JSON.stringify({ tracks: [short] })}</script>`,
  });
  expect(bounded.audio![0]).toMatchObject({ fadeIn: 0.5, fadeOut: 0.5 });
  expect(
    applyGeneratedAudio({ ...newProject(), html: manifest }).audio![0],
  ).toMatchObject({ fadeIn: 0.02, fadeOut: 0.04 });
});

it("generates continuation scores at the handoff and carries prior music without repeating effects", async () => {
  const { applyContinuationAudio } = await import("../shared/generated-audio");
  const base = applyGeneratedAudio({ ...newProject(), html: manifest });
  const scene = base.workflow!.scenes[0];
  const previous = { ...base, workflow: { ...base.workflow!, selectedId: scene.id } };
  const extension = { id: "tail", start: 10, duration: 3, html: "<div>Tail</div>", css: "", js: "" };
  const project = { ...previous, workflow: { ...previous.workflow, scenes: [{ ...scene, duration: 13, visualContinuations: [extension] }] } };
  const carried = applyContinuationAudio(project, previous);
  expect(carried.audio).toHaveLength(2);
  expect(carried.audio![1]).toMatchObject({ start: 10, length: 3, lane: "music", loop: true, fadeIn: 0 });
  expect(applyContinuationAudio(carried, carried).audio).toHaveLength(2);
  const fx = { ...tracks[0], id: "hit", lane: "sfx", start: 0.5, length: 1 };
  const html = '<script type="application/json" id="framescript-audio">' + JSON.stringify({ tracks: [fx] }) + '</script>';
  const changed = { ...carried, workflow: { ...project.workflow, scenes: [{ ...project.workflow.scenes[0], visualContinuations: [{ ...extension, html }] }] } };
  const result = applyContinuationAudio(changed, carried);
  expect(result.audio).toHaveLength(3);
  expect(result.audio!.find(clip => clip.name === "Score" && clip.lane === "sfx")).toMatchObject({ start: 10.5, length: 1 });
  expect(result.audio!.filter(clip => clip.lane === "music")).toHaveLength(2);
});

it("imports more than eight short continuation cues without dropping audio", async () => {
  const { applyContinuationAudio } = await import("../shared/generated-audio");
  const base = applyGeneratedAudio({ ...newProject(), html: manifest });
  const scene = base.workflow!.scenes[0];
  const cues = Array.from({ length: 12 }, (_, i) => ({
    id: `cue-${i}`, name: `Cue ${i}`, lane: "sfx", start: i / 10,
    length: 0.12, preset: "UI click", loop: false, volume: 0.2,
  }));
  const html = `<script type="application/json" id="framescript-audio">${JSON.stringify({ tracks: cues })}</script>`;
  const project = { ...base, workflow: { ...base.workflow!, scenes: [{ ...scene,
    duration: 13, visualContinuations: [{ id: "many-cues", start: 10, duration: 3, html, css: "", js: "" }],
  }] } };
  const result = applyContinuationAudio(project, base);
  expect(result.audio!.filter(clip => clip.lane === "sfx")).toHaveLength(12);
  expect(result.audio!.find(clip => clip.name === "Cue 11")!.start).toBeCloseTo(11.1);
  expect(result.audio!.filter(clip => clip.lane === "music")).toHaveLength(2);
  expect(applyContinuationAudio(result, result).audio).toEqual(result.audio);
});

it("keeps source and project limits and shows readable validation messages", () => {
  const cue = { ...tracks[0], id: "cue", duration: 0.1, length: 0.1,
    notes: [{ at: 0, duration: 0.1, frequency: 220 }] };
  const many = Array.from({ length: 61 }, (_, i) => ({ ...cue, id: `cue-${i}` }));
  const invalid = generatedAudioSchema.safeParse({ tracks: many });
  expect(invalid.success).toBe(false);
  if (!invalid.success) {
    expect(generatedAudioError(invalid.error)).toContain("Use at most 60 generated audio tracks");
    expect(generatedAudioError(invalid.error)).not.toContain('"code"');
  }
  const long = Array.from({ length: 3 }, (_, i) => ({ ...tracks[0], id: `long-${i}`, duration: 30 }));
  expect(generatedAudioSchema.safeParse({ tracks: long }).success).toBe(false);
  expect(generatedAudioSchema.safeParse({ tracks: [{ ...cue, notes: undefined, preset: "Unknown" }] }).success).toBe(false);
});

it("applies visual continuations without synthesizing audio or extending existing clips", () => {
  const fixture = applyGeneratedAudio({ ...newProject(), html: manifest });
  const existingAudio = fixture.audio!.map(clip => ({ ...clip, generatedSource: undefined }));
  const base = { ...fixture, audio: existingAudio };
  useStudio.getState().load(base);
  const before = useStudio.getState();
  const workflow = base.workflow!;
  before.change({ workflow: { ...workflow, scenes: workflow.scenes.map(scene => ({ ...scene,
    duration: 13, visualDuration: 10, visualContinuations: [{ id: crypto.randomUUID(), start: 10, duration: 3,
      html: '<div>Continuation</div><script type="application/json" id="framescript-audio">invalid</script>',
      css: "", js: "window.renderFrame=()=>{};" }],
  })) } });
  expect(useStudio.getState().error).toBe("");
  expect(useStudio.getState().revision).toBeGreaterThan(before.revision);
  expect(useStudio.getState().project.audio).toHaveLength(existingAudio.length);
  expect(useStudio.getState().project.audio).toMatchObject(existingAudio);
});
