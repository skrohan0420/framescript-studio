import { ArrowDown, ArrowUp, Code2, Film } from "lucide-react";
import { useProjectState, useStudio } from "./store";
import { activateScene, initialWorkflow } from "../shared/workflow";

export function ClipsPanel({
  onSelect,
  onEdit,
}: {
  onSelect: () => void;
  onEdit: () => void;
}) {
  const { project, change } = useProjectState();
  const workflow = project.workflow ?? initialWorkflow(project);
  const select = (id: string) => {
    useStudio.getState().setPlaying(false);
    change(activateScene({ ...project, workflow }, id), "Select clip");
    useStudio.getState().setTime(0);
    onSelect();
  };
  const move = (index: number, direction: number) => {
    const scenes = [...workflow.scenes];
    const next = index + direction;
    if (!scenes[next] || scenes[index].locked || scenes[next].locked) return;
    [scenes[index], scenes[next]] = [scenes[next], scenes[index]];
    useStudio.getState().setPlaying(false);
    useStudio.getState().setTime(0);
    change({ workflow: { ...workflow, scenes } }, "Reorder clips");
  };
  return (
    <section className="clips-panel" aria-label="Clips">
      <div className="panel-heading">
        <span>
          <Film size={14} /> CLIPS
        </span>
        <span>{workflow.scenes.length}</span>
      </div>
      <div className="clips-list">
        {workflow.scenes.map((clip, index) => (
          <article
            key={clip.id}
            className={
              "clip-card " + (workflow.selectedId === clip.id ? "selected" : "")
            }
          >
            <div className="clip-card-actions">
              <button
                className="clip-select"
                aria-label={`Select clip ${index + 1}: ${clip.title}`}
                onClick={() => select(clip.id)}
              >
                <Film size={15} /> Clip {String(index + 1).padStart(2, "0")}
              </button>
              <button
                aria-label={`Move clip ${index + 1} earlier`}
                title="Move earlier"
                disabled={
                  index === 0 ||
                  clip.locked ||
                  workflow.scenes[index - 1]?.locked
                }
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                aria-label={`Move clip ${index + 1} later`}
                title="Move later"
                disabled={
                  index === workflow.scenes.length - 1 ||
                  clip.locked ||
                  workflow.scenes[index + 1]?.locked
                }
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={15} />
              </button>
              <button
                aria-label={`Edit code for clip ${index + 1}`}
                title="Edit code"
                onClick={() => {
                  select(clip.id);
                  onEdit();
                }}
              >
                <Code2 size={15} />
              </button>
            </div>
            <div className="clip-card-fields">
              <label className="field">
                <span>Name</span>
                <input
                  aria-label={`Clip ${index + 1} name`}
                  value={clip.title}
                  disabled={clip.locked}
                  maxLength={200}
                  onChange={(event) =>
                    change(
                      {
                        workflow: {
                          ...workflow,
                          scenes: workflow.scenes.map((item) =>
                            item.id === clip.id
                              ? {
                                  ...item,
                                  title: event.target.value || "Untitled clip",
                                }
                              : item,
                          ),
                        },
                      },
                      "Rename clip",
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Seconds{clip.locked ? " · Locked" : ""}</span>
                <input
                  aria-label={`Clip ${index + 1} duration`}
                  type="number"
                  min="0.1"
                  max="600"
                  step="0.1"
                  value={Number(clip.duration.toFixed(2))}
                  disabled={clip.locked}
                  onChange={(event) => {
                    const duration = Number(event.target.value);
                    if (duration < 0.1 || duration > 600) return;
                    change(
                      {
                        workflow: {
                          ...workflow,
                          scenes: workflow.scenes.map((item) =>
                            item.id === clip.id ? { ...item, duration } : item,
                          ),
                        },
                        ...(workflow.selectedId === clip.id
                          ? { settings: { ...project.settings, duration } }
                          : {}),
                      },
                      "Clip duration",
                    );
                  }}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
