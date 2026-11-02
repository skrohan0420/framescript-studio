import type { AudioClip } from "../shared/project";
import { mapAudioTime, retimeWords } from "../shared/silence";
import { useStudio } from "./store";
import type { cutRecording } from "./silence-audio";
export function saveAudioEdit(
  clip: AudioClip,
  edit: ReturnType<typeof cutRecording>,
  replace: boolean,
) {
  const state = useStudio.getState(),
    p = state.project;
  if (!p.audioLibrary?.some((c) => c.id === clip.id && c.data === clip.data))
    throw Error("The source changed. Reopen silence removal.");
  const locked = p.workflow?.scenes.find(
    (s) => s.id === p.workflow?.selectedId,
  )?.locked;
  if (
    replace &&
    p.audio?.some(
      (item) =>
        item.data === clip.data &&
        item.sceneId === p.workflow?.selectedId &&
        !item.loop,
    ) &&
    locked
  )
    throw Error("Unlock the active timeline before replacing its audio.");
  const words = clip.transcriptWords?.length
    ? retimeWords(clip.transcriptWords, edit.cuts)
    : undefined;
  const id = crypto.randomUUID();
  const cleaned: AudioClip = {
    ...clip,
    id,
    sourceId: id,
    name:
      clip.name.replace(/\.[^.]+$/, "").replace(/ · (cleaned|edited)$/, "") +
      " · edited.wav",
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
    transcript: words ? words.map((w) => w.text).join(" ") : clip.transcript,
  };
  const audio = replace
    ? (p.audio ?? []).flatMap((item) => {
        if (!(
          item.data === clip.data &&
          item.sceneId === p.workflow?.selectedId &&
          !item.loop
        ))
          return [item];
        const trimIn = mapAudioTime(item.trimIn, edit.cuts);
        const length =
          mapAudioTime(
            Math.min(item.duration, item.trimIn + item.length),
            edit.cuts,
          ) - trimIn;
        if (length < 0.001) return [];
        return [
          {
            ...item,
            name: cleaned.name,
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
  state.setPlaying(false);
  state.change(
    { audioLibrary: [cleaned, ...(p.audioLibrary ?? [])], audio },
    "Edit narration audio",
  );
}
