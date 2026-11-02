import { useStudio, useProjectState } from "./store";
import { Field } from "./components";
import {
  activateScene,
  selectedScene,
  initialWorkflow,
} from "../shared/workflow";
import type { Project, Scene } from "../shared/project";
import {
  Plus,
  Trash2,
  Play,
  Code2,
  Timer,
  Layers,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
export function ManualTimelines({
  master,
  onMaster,
}: {
  master: boolean;
  onMaster: (value: boolean) => void;
}) {
  const state = useProjectState(),
    p = state.project;
  const workflow = p.workflow ?? initialWorkflow(p);
  const current = workflow.scenes.find(
    (item) => item.id === workflow.selectedId,
  )!;
  const currentIndex = workflow.scenes.findIndex(
    (item) => item.id === current.id,
  );
  const move = (direction: -1 | 1) => {
    const nextIndex = currentIndex + direction;
    if (
      nextIndex < 0 ||
      nextIndex >= workflow.scenes.length ||
      current.locked ||
      workflow.scenes[nextIndex].locked
    )
      return;
    const scenes = [...workflow.scenes];
    [scenes[currentIndex], scenes[nextIndex]] = [
      scenes[nextIndex],
      scenes[currentIndex],
    ];
    useStudio.getState().setPlaying(false);
    useStudio.getState().setTime(0);
    state.change({ workflow: { ...workflow, scenes } }, "Reorder timelines");
  };
  const select = (project: Project, id: string) => {
    state.change(activateScene(project, id), "Select timeline");
    onMaster(false);
  };
  return (
    <div className="manual-timelines">
      <div className="timeline-tabs" role="tablist" aria-label="Timelines">
        {workflow.scenes.map((item, index) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={workflow.selectedId === item.id}
            className={workflow.selectedId === item.id ? "active" : ""}
            title={item.title}
            onClick={() => select({ ...p, workflow }, item.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === "ArrowRight")
                next = (index + 1) % workflow.scenes.length;
              else if (event.key === "ArrowLeft")
                next =
                  (index - 1 + workflow.scenes.length) % workflow.scenes.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = workflow.scenes.length - 1;
              else return;
              event.preventDefault();
              select({ ...p, workflow }, workflow.scenes[next].id);
              (
                event.currentTarget.parentElement?.children[
                  next
                ] as HTMLButtonElement
              )?.focus();
            }}
            tabIndex={workflow.selectedId === item.id ? 0 : -1}
          >
            {index + 1} · {item.title}
          </button>
        ))}
      </div>
      <button
        aria-label="Move timeline earlier"
        title="Move selected timeline earlier in the film"
        disabled={
          currentIndex === 0 ||
          current.locked ||
          workflow.scenes[currentIndex - 1]?.locked
        }
        onClick={() => move(-1)}
      >
        <ArrowLeft size={16} />
      </button>
      <button
        aria-label="Move timeline later"
        title="Move selected timeline later in the film"
        disabled={
          currentIndex === workflow.scenes.length - 1 ||
          current.locked ||
          workflow.scenes[currentIndex + 1]?.locked
        }
        onClick={() => move(1)}
      >
        <ArrowRight size={16} />
      </button>
      <button
        aria-label="Add timeline"
        title="Add timeline"
        disabled={workflow.scenes.length >= 30}
        onClick={() => {
          const item = {
            ...current,
            id: crypto.randomUUID(),
            title: `Timeline ${workflow.scenes.length + 1}`,
            html: "",
            css: "",
            js: "",
            narration: "",
            visual: "",
            locked: false,
            template: "custom",
            sourceOffset: 0,
          };
          select(
            {
              ...p,
              workflow: {
                ...workflow,
                scenes: [...workflow.scenes, item],
                selectedId: item.id,
              },
            },
            item.id,
          );
        }}
      >
        <Plus size={16} />
      </button>
      <button
        aria-label="Remove timeline"
        title="Remove timeline"
        disabled={current.locked}
        onClick={() => {
          const scenes =
            workflow.scenes.length > 1
              ? workflow.scenes.filter((item) => item.id !== current.id)
              : [
                  {
                    ...current,
                    title: "Empty timeline",
                    html: "",
                    css: "",
                    js: "",
                    narration: "",
                    visual: "",
                    template: "custom",
                    sourceOffset: 0,
                  },
                ];
          const next = { ...workflow, scenes, selectedId: scenes[0].id };
          state.change(
            {
              ...activateScene({ ...p, workflow: next }, next.selectedId),
              audio: p.audio?.filter((clip) => clip.sceneId !== current.id),
            },
            "Remove timeline",
          );
          onMaster(false);
        }}
      >
        <Trash2 size={16} />
      </button>
      <label>
        <Timer size={15} aria-hidden="true" />
        <input
          aria-label="Timeline duration (seconds)"
          type="number"
          min="0.1"
          max="600"
          step="0.1"
          disabled={master || current.locked}
          value={p.settings.duration}
          onChange={(event) => {
            const duration = Number(event.target.value);
            if (duration >= 0.1 && duration <= 600)
              state.change(
                { settings: { ...p.settings, duration } },
                "Timeline duration",
              );
          }}
        />
      </label>
      <button
        aria-label={master ? "Edit timeline" : "Preview all timelines"}
        title={master ? "Edit timeline" : "Preview all timelines"}
        onClick={() => onMaster(!master)}
      >
        {master ? <Code2 size={16} /> : <Play size={16} />}
      </button>
    </div>
  );
}

export function SceneRail({
  manual = false,
  master,
  onMaster,
  busy,
  onEdit,
}: {
  manual?: boolean;
  master: boolean;
  onMaster: (value: boolean) => void;
  busy: boolean;
  onEdit?: () => void;
}) {
  const s = useProjectState(),
    w = s.project.workflow;
  if (!w) return null;
  return (
    <div className="scene-rail">
      <div className="scene-rail-heading">
        <strong>
          {manual ? "CLIPS" : "SCENES"} · {w.scenes.length}
        </strong>
        <button
          disabled={busy}
          className={master ? "accent" : ""}
          onClick={() => onMaster(!master)}
        >
          {master ? (manual ? "Edit clip" : "Edit scene") : "Master preview"}
        </button>
      </div>
      <div className="scene-rail-list">
        {w.scenes.map((scene, i) => (
          <button
            key={scene.id}
            disabled={busy}
            className={!master && scene.id === w.selectedId ? "active" : ""}
            onClick={() => {
              s.change(activateScene(s.project, scene.id), "Select scene");
              s.setTime(0);
              s.setPlaying(false);
              onMaster(false);
              onEdit?.();
            }}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <strong>{scene.title}</strong>
            <small>
              {scene.duration.toFixed(1)}s {scene.locked ? "🔒" : ""}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SceneInspector({
  onOpen,
  onGenerate,
  busy,
  onEditCode,
}: {
  onOpen: (tab: string) => void;
  onGenerate: () => void;
  busy: boolean;
  onEditCode?: () => void;
}) {
  const s = useProjectState(),
    w = s.project.workflow,
    scene = selectedScene(s.project);
  if (!w || !scene) return null;
  const edit = (patch: Partial<Scene>) => {
    const p = useStudio.getState().project;
    const workflow = p.workflow!;
    s.change(
      {
        workflow: {
          ...workflow,
          scenes: workflow.scenes.map((item) =>
            item.id === workflow.selectedId ? { ...item, ...patch } : item,
          ),
        },
        ...(patch.duration !== undefined
          ? { settings: { ...p.settings, duration: patch.duration } }
          : {}),
      },
      "Edit scene details",
    );
  };
  return (
    <section className="inline-scene-editor" aria-label="Selected scene editor">
      <div className="inline-scene-heading">
        <strong>{scene.title}</strong>
        <span>{scene.locked ? "Approved · locked" : "Editing scene"}</span>
        <button
          className="primary"
          disabled={busy || scene.locked}
          onClick={onGenerate}
        >
          {busy ? "Generating scene…" : "Generate scene"}
        </button>
        <button onClick={() => onOpen("voice")}>Voice</button>
        <button onClick={() => onOpen("sound")}>SFX & Music</button>
        <button onClick={() => onOpen("mascot")}>Images</button>
        {onEditCode && <button onClick={onEditCode}>Edit code</button>}
      </div>
      <div className="inline-scene-fields">
        <Field label="Selected scene narration">
          <textarea
            rows={2}
            disabled={scene.locked || busy}
            value={scene.narration}
            onChange={(e) => edit({ narration: e.target.value })}
          />
        </Field>
        <Field label="Selected scene visual direction">
          <textarea
            rows={2}
            disabled={scene.locked || busy}
            value={scene.visual}
            onChange={(e) => edit({ visual: e.target.value })}
          />
        </Field>
        <Field label="Scene length (seconds)">
          <input
            type="number"
            min=".1"
            max="600"
            step=".1"
            disabled={scene.locked || busy}
            value={scene.duration}
            onChange={(e) => {
              const duration = Number(e.target.value);
              if (duration >= 0.1 && duration <= 600) edit({ duration });
            }}
          />
        </Field>
      </div>
    </section>
  );
}
