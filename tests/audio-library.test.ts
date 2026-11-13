import { expect, it } from "vitest";
import { retainAudioSources } from "../shared/audio-library";
import { newProject } from "../shared/project";
import { clipFromAudio } from "../src/audio";
import { synthesizeSound } from "../shared/audio";
it("keeps import order across processing, timeline ordering, new imports and reload", () => {
  const first = clipFromAudio(synthesizeSound("Success chime"), "voice");
  const second = clipFromAudio(synthesizeSound("Soft pop"), "voice");
  const initial = retainAudioSources({ ...newProject(), audioLibrary: [first, second], audio: [second, first] });
  const updated = retainAudioSources({ ...initial,
    audioLibrary: initial.audioLibrary!.map(c => c.id === first.id ? { ...c, data: "data:audio/wav;base64,AAAA", enhanced: true } : c),
    audio: [],
  }, initial);
  expect(updated.audioLibrary!.map(c => c.id)).toEqual([first.id, second.id]);
  const third = clipFromAudio(synthesizeSound("Impact"), "sfx");
  const imported = retainAudioSources({ ...updated, audioLibrary: [...updated.audioLibrary!, third] }, updated);
  const reloaded = retainAudioSources({ ...imported, audioLibrary: [...imported.audioLibrary!].reverse() });
  expect(reloaded.audioLibrary!.map(c => c.id)).toEqual([first.id, second.id, third.id]);
});
it("recovers a missing enhanced recording on load without duplicating it", () => {
  const clip = { ...clipFromAudio(synthesizeSound("Success chime"), "voice"), sourceId: "missing-source", enhanced: true };
  const project = retainAudioSources({ ...newProject(), audioLibrary: [], audio: [clip] });
  expect(project.audioLibrary).toHaveLength(1);
  expect(project.audioLibrary![0]).toMatchObject({ id: "missing-source", enhanced: true, data: clip.data });
  expect(retainAudioSources(project).audioLibrary).toHaveLength(1);
});
it("migrates split clips to one source and retains it after all timeline instances are removed", () => {
  const source = clipFromAudio(synthesizeSound("Success chime"), "voice");
  const project = retainAudioSources({
    ...newProject(),
    audio: [
      { ...source, length: 0.5 },
      { ...source, id: "right", start: 0.5, trimIn: 0.5, length: 0.5 },
    ],
  });
  expect(project.audioLibrary).toHaveLength(1);
  expect(project.audioLibrary![0]).toMatchObject({
    trimIn: 0,
    start: 0,
    length: source.duration,
  });
  expect(project.audio![0].sourceId).toBe(project.audio![1].sourceId);
  const deleted = retainAudioSources({ ...project, audio: [] }, project);
  expect(deleted.audio).toHaveLength(0);
  expect(deleted.audioLibrary).toHaveLength(1);
  expect(deleted.audioLibrary![0].data).toBe(source.data);
});
it("explicit source removal does not remove timeline instances or reappear on edits", () => {
  const source = clipFromAudio(synthesizeSound("Success chime"), "voice");
  const project = retainAudioSources({ ...newProject(), audio: [source] });
  const removed = retainAudioSources({ ...project, audioLibrary: [] }, project);
  expect(removed.audioLibrary).toHaveLength(0);
  expect(removed.audio).toHaveLength(1);
  expect(retainAudioSources({ ...removed, name: "Edited" }, removed).audioLibrary).toHaveLength(0);
});
