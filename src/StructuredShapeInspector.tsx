import { useState } from "react";
import { editSceneSchema } from "../shared/structured-edit";
import type { Project } from "../shared/project";
import { structuredClipTiming } from "../shared/structured-edit-timing";
import {
  matchesStructuredSceneCode,
  structuredStarCode,
  type StructuredEditScene,
} from "../shared/structured-star";
import { selectedScene } from "../shared/workflow";
import { Field } from "./components";
import { useStudio } from "./store";

type Shape = NonNullable<StructuredEditScene["objects"]>[number];
type Scope = "clip" | "shared";
const baseFields = [
  ["x", "X position (px)"],
  ["y", "Y position (px)"],
  ["width", "Width (px)"],
  ["height", "Height (px)"],
  ["color", "Fill color (hex)"],
  ["opacity", "Opacity (0–1)"],
] as const;
type Property = (typeof baseFields)[number][0];

function ShapeField({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: string | number;
  onCommit: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string>();
  return (
    <Field label={label}>
      <input
        type={typeof value === "number" ? "number" : "text"}
        step={typeof value === "number" ? "any" : undefined}
        disabled={disabled}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== undefined) onCommit(draft);
          setDraft(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(undefined);
        }}
      />
    </Field>
  );
}

export function StructuredShapeInspector({
  appliedProject,
  objectId,
  onChooseShape,
}: {
  appliedProject: Project;
  objectId: string | null;
  onChooseShape: (id: string | null) => void;
}) {
  const project = useStudio((state) => state.project);
  const [scope, setScope] = useState<Scope>("clip");
  const objects = selectedScene(project)?.structuredEdit?.objects;
  const object = objects?.find((item) => item.id === objectId);
  if (!objects?.length) return null;
  return (
    <section aria-label="Shape inspector">
      <h3>Scene objects</h3>
      <Field label="Shape">
        <select
          aria-label="Shape"
          value={object?.id ?? ""}
          onChange={(event) => onChooseShape(event.target.value || null)}
        >
          <option value="">Select a shape</option>
          {objects.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} ({item.kind})
            </option>
          ))}
        </select>
      </Field>
      {object && (
        <ShapeProperties
          key={object.id}
          project={project}
          appliedProject={appliedProject}
          object={object}
          scope={scope}
          setScope={setScope}
        />
      )}
    </section>
  );
}

function ShapeProperties({
  project,
  appliedProject,
  object,
  scope,
  setScope,
}: {
  project: Project;
  appliedProject: Project;
  object: Shape;
  scope: Scope;
  setScope: (scope: Scope) => void;
}) {
  const clip = selectedScene(project);
  const scene = clip?.structuredEdit;
  const [mode, setMode] = useState<"base" | "keyframe">("base");
  const [error, setError] = useState("");
  const workflow = project.workflow;
  if (!scene || !clip || !workflow) return null;

  const linked = workflow.scenes.filter(
    (item) => item.structuredEdit?.sceneId === scene.sceneId,
  );
  const shared = scope === "shared" && linked.length > 1;
  const affected = shared ? linked : [clip];
  const blocked = affected.some((item) => {
    const applied = appliedProject.workflow?.scenes.find(
      ({ id }) => id === item.id,
    );
    return (
      item.locked ||
      JSON.stringify(item.structuredEdit) !== JSON.stringify(scene) ||
      !matchesStructuredSceneCode(item, scene) ||
      !applied ||
      !matchesStructuredSceneCode(applied, scene)
    );
  });
  const modeIsKeyframe = mode === "keyframe" && object.tracks.length > 0;
  const commit = (
    property: Property,
    raw: string,
    track?: Shape["tracks"][number],
  ) => {
    setError("");
    const state = useStudio.getState();
    if (blocked || state.project !== project) return;
    const input = raw.trim();
    const value = property === "color" ? input : input ? Number(input) : NaN;
    if (value === (track ? track.keyframe.value : object[property])) return;
    const objects = scene.objects!.map((item) => {
      if (item.id !== object.id) return item;
      if (!track) return { ...item, [property]: value };
      return {
        ...item,
        tracks: item.tracks.map((candidate) =>
          candidate.property === track.property
            ? { ...candidate, keyframe: { ...candidate.keyframe, value } }
            : candidate,
        ),
      };
    });
    const result = editSceneSchema.safeParse({
      ...scene,
      sceneId:
        !shared && linked.length > 1 ? crypto.randomUUID() : scene.sceneId,
      revision: scene.revision + 1,
      objects,
    });
    if (!result.success) {
      setError(
        "Use a six-digit hex color, position from −10000 to 10000, size above 0 and at most 10000, or opacity from 0 to 1.",
      );
      return;
    }
    const code = structuredStarCode(result.data);
    const ids = new Set(affected.map((item) => item.id));
    state.change(
      {
        ...code,
        workflow: {
          ...workflow,
          scenes: workflow.scenes.map((item) =>
            ids.has(item.id)
              ? { ...item, ...code, structuredEdit: result.data }
              : item,
          ),
        },
      },
      track ? "Edit shape keyframe" : "Edit shape base value",
    );
    const updated = useStudio.getState();
    if (updated.revision === state.revision)
      setError(updated.error || "The shape edit could not be applied.");
  };

  return (
    <>
      {linked.length > 1 && (
        <Field label="Shape edit scope">
          <select
            aria-label="Shape edit scope"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value === "shared" ? "shared" : "clip");
              setError("");
            }}
          >
            <option value="clip">This clip only</option>
            <option value="shared">All {linked.length} linked clips</option>
          </select>
        </Field>
      )}
      {shared && (
        <p className="muted">
          Affects {affected.map((item) => item.title).join(", ")}.
        </p>
      )}
      <Field label="Edit shape values">
        <select
          aria-label="Edit shape values"
          value={modeIsKeyframe ? "keyframe" : "base"}
          onChange={(event) => {
            setMode(event.target.value === "keyframe" ? "keyframe" : "base");
            setError("");
          }}
        >
          <option value="base">Base values</option>
          <option value="keyframe" disabled={!object.tracks.length}>
            Existing keyframes
          </option>
        </select>
      </Field>
      <p className="muted">
        {modeIsKeyframe
          ? "Change a value at its existing source time. Keyframe timing stays fixed."
          : "Change the starting values. Animated properties still follow their existing keyframes."}
      </p>
      {blocked && (
        <p role="status">
          Shape edits require unlocked clips with matching structured source in
          the editor and preview.
        </p>
      )}
      <div
        key={JSON.stringify([
          scene.sceneId,
          scene.revision,
          object.id,
          modeIsKeyframe,
          shared,
        ])}
      >
        {modeIsKeyframe
          ? object.tracks.map((track) => {
              const timing = structuredClipTiming(clip, {
                nodeId: object.id,
                property: track.property,
                keyframeId: track.keyframe.id,
              });
              return (
                <ShapeField
                  key={track.property}
                  label={`${baseFields.find(([key]) => key === track.property)![1]} keyframe · ${(track.keyframe.frame / scene.fps).toFixed(3)}s source${timing ? "" : " (outside clip)"}`}
                  value={track.keyframe.value}
                  disabled={blocked || !timing}
                  onCommit={(value) => commit(track.property, value, track)}
                />
              );
            })
          : baseFields.map(([property, label]) => (
              <ShapeField
                key={property}
                label={label}
                value={object[property]}
                disabled={blocked}
                onCommit={(value) => commit(property, value)}
              />
            ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
