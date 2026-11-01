import { create } from "zustand";
import { newProject, projectSchema, type Project } from "../shared/project";
import { selectedScene, synchronizeScene } from "../shared/workflow";
type Snapshot = { project: Project; label: string };
interface State {
  project: Project;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  revision: number;
  time: number;
  playing: boolean;
  error: string;
  setError: (e: string) => void;
  change: (p: Partial<Project>, label?: string) => void;
  load: (p: Project) => void;
  undo: () => void;
  redo: () => void;
  setTime: (t: number) => void;
  setPlaying: (b: boolean) => void;
  saved: () => void;
}
export const useStudio = create<State>((set, get) => ({
  project: newProject(),
  past: [],
  future: [],
  dirty: false,
  revision: 0,
  time: 0,
  playing: false,
  error: "",
  setError: (error) => set({ error }),
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
        error:
          "This scene is locked. Unlock it in the storyboard before editing.",
      });
      return;
    }
    const candidate = projectSchema.safeParse({ ...s.project, ...patch });
    if (!candidate.success) {
      set({
        error: candidate.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    const project = projectSchema.parse(synchronizeScene(candidate.data));
    if (JSON.stringify(project) === JSON.stringify(s.project)) return;
    set({
      project,
      past: [...s.past, { project: s.project, label }].slice(-80),
      future: [],
      dirty: true,
      revision: s.revision + 1,
    });
  },
  load: (p) =>
    set((s) => ({
      project: projectSchema.parse(p),
      past: [],
      future: [],
      time: 0,
      playing: false,
      dirty: false,
      revision: s.revision + 1,
    })),
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
  saved: () => set({ dirty: false }),
}));
