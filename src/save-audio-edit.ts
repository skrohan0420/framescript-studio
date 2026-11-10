import type { AudioClip } from "../shared/project";
import { mapAudioTime, retimeWords } from "../shared/silence";
import { useStudio } from "./store";
import type { cutRecording } from "./silence-audio";

export type AudioEditMode = "original" | "copy";

export function saveAudioEdit(
  clip: AudioClip,
  edit: ReturnType<typeof cutRecording>,
  mode: AudioEditMode,
) {
  const state = useStudio.getState(),
    p = state.project;
  const library = p.audioLibrary ?? [];
  const source = library.find((item) => item.id === clip.id);
  if (!source || source.data !== clip.data)
    throw Error("The source changed. Reopen the audio editor.");
  if (
    library.some(
      (item) =>
        (mode === "copy" || item.id !== source.id) && item.data === edit.data,
    )
  )
    throw Error(
      "An identical edited recording is already in the audio library.",
    );
  const matchesSource = (item: AudioClip) =>
    item.sourceId === source.id ||
    (!item.sourceId && item.data === source.data);
  const locked = new Set(
    p.workflow?.scenes.filter((scene) => scene.locked).map((scene) => scene.id),
  );
  if (
    mode === "original" &&
    p.audio?.some(
      (item) => matchesSource(item) && item.sceneId && locked.has(item.sceneId),
    )
  )
    throw Error(
      "Unlock the timelines using this recording before updating the original.",
    );
  const words = source.transcriptWords?.length
    ? retimeWords(source.transcriptWords, edit.cuts)
    : undefined;
  const id = mode === "original" ? source.id : crypto.randomUUID();
  const copySuffix = " · edited.wav";
  const cleaned: AudioClip = {
    ...source,
    id,
    sourceId: id,
    name:
      mode === "original"
        ? source.name
        : source.name
            .replace(/\.[^.]+$/, "")
            .replace(/ · (cleaned|edited)$/, "")
            .slice(0, 200 - copySuffix.length) + copySuffix,
    data: edit.data,
    duration: edit.duration,
    peaks: edit.peaks,
    start: 0,
    trimIn: 0,
    length: Math.min(600, edit.duration),
    sceneId: undefined,
    loop: false,
    generatedSource: undefined,
    transcriptWords: words,
    transcript: words ? words.map((w) => w.text).join(" ") : source.transcript,
  };
  const audio =
    mode === "original"
      ? p.audio?.flatMap((item) => {
          if (!matchesSource(item)) return [item];
          const trimIn = mapAudioTime(item.trimIn, edit.cuts);
          const length = item.loop
            ? item.length
            : Math.min(
                edit.duration,
                mapAudioTime(
                  Math.min(item.duration, item.trimIn + item.length),
                  edit.cuts,
                ),
              ) - trimIn;
          if (trimIn >= edit.duration || length < 0.001) return [];
          return [
            {
              ...item,
              data: cleaned.data,
              sourceId: id,
              duration: cleaned.duration,
              peaks: cleaned.peaks,
              trimIn,
              length,
              fadeIn: Math.min(item.fadeIn, length),
              fadeOut: Math.min(item.fadeOut, length),
              transcript: cleaned.transcript,
              transcriptWords: words,
              generatedSource: undefined,
            },
          ];
        })
      : p.audio;
  const audioLibrary =
    mode === "original"
      ? library.map((item) => (item.id === id ? cleaned : item))
      : [cleaned, ...library];
  state.change({ audioLibrary, audio }, "Edit narration audio");
  const updated = useStudio.getState();
  if (updated.revision === state.revision)
    throw Error(updated.error || "The audio edit could not be saved.");
  updated.setPlaying(false);
}
