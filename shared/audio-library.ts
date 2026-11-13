import type { AudioClip, Project } from "./project";
export const audioDragType = "application/x-framescript-audio-source";
export function retainAudioSources(
  project: Project,
  previous?: Project,
): Project {
  const sources = new Map<string, AudioClip>();
  const library = project.audioLibrary ?? previous?.audioLibrary;
  const importOrders = new Map<string, number>();
  let nextOrder = Math.max(-1, ...(library ?? []).map(clip => clip.importOrder ?? -1), ...(previous?.audioLibrary ?? []).map(clip => clip.importOrder ?? -1)) + 1;
  // Older projects use their saved library order as their import history.
  for (const clip of library ?? [])
    importOrders.set(clip.id, clip.importOrder ?? previous?.audioLibrary?.find(source => source.id === clip.id)?.importOrder ?? nextOrder++);
  const allowed = new Map(library?.map((source) => [source.id, source.data]));
  for (const clip of [
    ...(library ?? []),
    ...(previous?.audio ?? []).filter((clip) => {
      // A replaced source keeps its ID. Its old timeline bytes belong to Undo.
      const currentData = clip.sourceId && allowed.get(clip.sourceId);
      return !currentData || currentData === clip.data;
    }),
    ...(project.audio ?? []),
  ]) {
    if (library && clip.sourceId && !allowed.has(clip.sourceId) &&
      !(clip.enhanced && !previous && project.audio?.includes(clip))) continue;
    const existing = sources.get(clip.data);
    const id = existing?.id ?? clip.sourceId ?? clip.id;
    const importOrder = existing?.importOrder ?? importOrders.get(id) ?? nextOrder++;
    importOrders.set(id, importOrder);
    sources.set(clip.data, {
      ...clip,
      id,
      importOrder,
      sourceId: id,
      sceneId: undefined,
      start: 0,
      trimIn: 0,
      length: Math.min(600, clip.duration),
      muted: false,
      loop: false,
      transcript: clip.transcript ?? existing?.transcript,
      transcriptWords: clip.transcriptWords ?? existing?.transcriptWords,
    });
  }
  if (sources.size > 100)
    throw Error("The audio library supports at most 100 source recordings.");
  return {
    ...project,
    ...(sources.size ? { audioLibrary: [...sources.values()].sort((a, b) => a.importOrder! - b.importOrder!) } : {}),
    ...(project.audio
      ? {
          audio: project.audio.map((clip) => ({
            ...clip,
            sourceId: sources.get(clip.data)?.id ?? clip.sourceId ?? clip.id,
          })),
        }
      : {}),
  };
}
