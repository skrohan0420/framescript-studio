import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { newProject, projectSchema, type Project } from "../shared/project";
import { selectedScene, synchronizeScene } from "../shared/workflow";
import {
  applyGeneratedAudio,
  audioManifestSource,
} from "../shared/generated-audio";
import { retainAudioSources } from "../shared/audio-library";
import {
  assertProjectSize,
  projectBytes,
  MAX_PROJECT_BYTES,
} from "../shared/project-size";
type Snapshot = { project: Project; label: string };
interface State {
  project: Project;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  revision: number;
  session: number;
  time: number;
  playing: boolean;
  error: string;
  selectedText: string | null;
  setSelectedText: (id: string | null) => void;
  errorLocation?: { line: number; column: number };
  errorCode?: string;
  setError: (
    e: string,
    location?: { line: number; column: number },
    code?: string,
  ) => void;
  change: (p: Partial<Project>, label?: string) => void;
  load: (p: Project) => void;
  undo: () => void;
  redo: () => void;
  setTime: (t: number) => void;
  setPlaying: (b: boolean) => void;
  saved: (revision: number) => void;
}
const patchSchema = projectSchema.partial();
// Compare only changed fields; do not serialize all embedded media per keystroke.
function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        equal(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  );
}
export const useStudio = create<State>((set, get) => ({
  project: newProject(),
  past: [],
  future: [],
  dirty: false,
  revision: 0,
  session: 0,
  time: 0,
  playing: false,
  error: "",
  selectedText: null,
  setSelectedText: (selectedText) => set({ selectedText }),
  setError: (error, errorLocation, errorCode) =>
    set({ error, errorLocation, errorCode }),
  change: (patch, label = "Code edit") => {
    const s = get();
    const sourceChange =
      (["html", "css", "js"] as const).some(
        (k) => patch[k] !== undefined && patch[k] !== s.project[k],
      ) ||
      (patch.settings !== undefined &&
        patch.settings.duration !== s.project.settings.duration);
    if (
      sourceChange &&
      selectedScene(s.project)?.locked &&
      (!patch.workflow ||
        patch.workflow.selectedId === s.project.workflow?.selectedId)
    ) {
      set({
        errorLocation: undefined,
        errorCode: undefined,
        error:
          "This scene is locked. Unlock it in the storyboard before editing.",
      });
      return;
    }
    const candidate = patchSchema.safeParse(patch);
    if (!candidate.success) {
      set({
        errorLocation: undefined,
        errorCode: undefined,
        error: candidate.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    const changes = Object.keys(patch).filter(
      (key) =>
        candidate.data[key as keyof Project] !== undefined &&
        !equal(
          s.project[key as keyof Project],
          candidate.data[key as keyof Project],
        ),
    );
    if (!changes.length) return;
    const changed = Object.fromEntries(
      changes.map((key) => [key, candidate.data[key as keyof Project]]),
    );
    let project = synchronizeScene({ ...s.project, ...changed });
    if (
      patch.html !== undefined &&
      (!patch.workflow ||
        patch.workflow.selectedId === s.project.workflow?.selectedId)
    ) {
      try {
        if (
          audioManifestSource(project.html) !==
          audioManifestSource(s.project.html)
        )
          project = applyGeneratedAudio(project);
      } catch (error) {
        set({
          error: "Generated audio: " + (error as Error).message,
          errorLocation: undefined,
          errorCode: undefined,
        });
        return;
      }
    }
    if (
      project.workflow &&
      project.workflow.scenes.reduce((sum, scene) => sum + scene.duration, 0) >
        600
    ) {
      set({
        error: "Composition exceeds ten minutes",
        errorLocation: undefined,
        errorCode: undefined,
      });
      return;
    }
    try {
      project = retainAudioSources(project, s.project);
      if (
        projectBytes(project) > MAX_PROJECT_BYTES &&
        projectBytes(project) >= projectBytes(s.project)
      )
        assertProjectSize(project);
    } catch (error) {
      set({
        error: (error as Error).message,
        errorLocation: undefined,
        errorCode: undefined,
      });
      return;
    }
    set({
      project,
      past: [...s.past, { project: s.project, label }].slice(-80),
      future: [],
      dirty: true,
      revision: s.revision + 1,
    });
  },
  load: (p) => {
    const project = retainAudioSources(projectSchema.parse(p));
    set((s) => ({
      project,
      error: "",
      errorLocation: undefined,
      errorCode: undefined,
      selectedText: null,
      past: [],
      future: [],
      time: 0,
      playing: false,
      dirty: false,
      revision: s.revision + 1,
      session: s.session + 1,
    }));
  },
  undo: () => {
    const s = get(),
      last = s.past.at(-1);
    if (last)
      set({
        project: last.project,
        past: s.past.slice(0, -1),
        future: [{ project: s.project, label: last.label }, ...s.future],
        dirty: true,
        revision: s.revision + 1,
      });
  },
  redo: () => {
    const s = get(),
      next = s.future[0];
    if (next)
      set({
        project: next.project,
        past: [...s.past, { project: s.project, label: next.label }],
        future: s.future.slice(1),
        dirty: true,
        revision: s.revision + 1,
      });
  },
  setTime: (time) => set({ time }),
  setPlaying: (playing) => set({ playing }),
  saved: (revision) => {
    if (get().revision === revision) set({ dirty: false });
  },
}));

/** Editing panels do not subscribe to the animation clock. */
export function useProjectState() {
  return useStudio(
    useShallow(({ time: _time, playing: _playing, ...state }) => state),
  );
}
