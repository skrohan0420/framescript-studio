import { useState, type PointerEvent } from "react";
import { Type } from "lucide-react";
import { useProjectState, useStudio } from "./store";
import {
  readTextLayers,
  writeTextLayer,
  type TextLayer,
} from "../shared/typography";
import { editTextTiming } from "../shared/text-timing";
import { sceneOffset, selectedScene } from "../shared/workflow";

export function TextTimeline({
  master,
  duration,
  snapping,
  onSnap,
  onSelect,
}: {
  master: boolean;
  duration: number;
  snapping: boolean;
  onSnap: (time: number | null) => void;
  onSelect: (sceneId: string | undefined, textId: string) => void;
}) {
  const { project, change } = useProjectState();
  const selected = useStudio((state) => state.selectedText);
  const [draft, setDraft] = useState<{ key: string; layer: TextLayer } | null>(
    null,
  );
  const scenes =
    master && project.workflow
      ? project.workflow.scenes
      : [
          {
            ...selectedScene(project),
            id: project.workflow?.selectedId ?? "",
            html: project.html,
            duration: project.settings.duration,
          },
        ];
  const items = scenes
    .flatMap((scene) =>
      readTextLayers(scene.html).map((layer) => ({
        layer,
        scene,
        offset: master && scene.id ? sceneOffset(project, scene.id) : 0,
        origin: scene.sourceOffset ?? 0,
        key: `${scene.id}:${layer.id}`,
      })),
    )
    .filter(
      ({ layer, scene, origin }) =>
        layer.start < origin + scene.duration && layer.end > origin,
    );
  const drag = (
    event: PointerEvent<HTMLButtonElement>,
    item: (typeof items)[number],
    mode: "move" | "start" | "end",
  ) => {
    if (event.button !== 0 || item.scene.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const width = target
      .closest(".audio-edit-track")!
      .getBoundingClientRect().width;
    const startX = event.clientX,
      revision = useStudio.getState().revision;
    let next = item.layer,
      moved = false;
    useStudio.getState().setPlaying(false);
    target.setPointerCapture(event.pointerId);
    const targets = [
      0,
      duration,
      useStudio.getState().time,
      ...project.markers,
    ];
    for (const other of items)
      if (other.key !== item.key)
        targets.push(
          other.offset + other.layer.start - other.origin,
          other.offset + other.layer.end - other.origin,
        );
    for (const clip of project.audio ?? []) {
      if (
        !master &&
        clip.sceneId &&
        clip.sceneId !== project.workflow?.selectedId
      )
        continue;
      const start =
        clip.start +
        (master && clip.sceneId ? sceneOffset(project, clip.sceneId) : 0);
      targets.push(start, start + clip.length);
    }
    const move = (e: globalThis.PointerEvent) => {
      let delta = ((e.clientX - startX) / width) * duration;
      let result = editTextTiming(
        item.layer,
        delta,
        mode,
        item.origin,
        item.scene.duration,
      );
      let snapped: number | null = null;
      if (snapping && !e.altKey) {
        let nearest = (duration * 8) / width;
        const edges =
          mode === "start"
            ? [result.start]
            : mode === "end"
              ? [result.end]
              : [result.start, result.end];
        for (const edge of edges)
          for (const time of targets) {
            const difference = time - (item.offset + edge - item.origin);
            if (Math.abs(difference) <= nearest) {
              const candidate = editTextTiming(
                item.layer,
                delta + difference,
                mode,
                item.origin,
                item.scene.duration,
              );
              if (
                Math.abs(
                  (edge === result.start ? candidate.start : candidate.end) +
                    item.offset -
                    item.origin -
                    time,
                ) > 1e-5
              )
                continue;
              nearest = Math.abs(difference);
              snapped = time;
            }
          }
        if (snapped !== null) {
          const edge = edges.reduce((best, edge) =>
            Math.abs(item.offset + edge - item.origin - snapped!) <
            Math.abs(item.offset + best - item.origin - snapped!)
              ? edge
              : best,
          );
          delta += snapped - (item.offset + edge - item.origin);
          result = editTextTiming(
            item.layer,
            delta,
            mode,
            item.origin,
            item.scene.duration,
          );
        }
      }
      next = result;
      moved = true;
      setDraft({ key: item.key, layer: result });
      onSnap(snapped);
    };
    const end = (e: globalThis.PointerEvent) => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      target.removeEventListener("lostpointercapture", end);
      setDraft(null);
      onSnap(null);
      if (e.type !== "pointerup" || !moved) return;
      const state = useStudio.getState();
      if (state.revision !== revision) {
        state.setError("Project changed during text timing edit. Try again.");
        return;
      }
      if (master && item.scene.id && project.workflow) {
        const html = writeTextLayer(item.scene.html, next);
        change(
          {
            workflow: {
              ...project.workflow,
              scenes: project.workflow.scenes.map((scene) =>
                scene.id === item.scene.id ? { ...scene, html } : scene,
              ),
            },
            ...(item.scene.id === project.workflow.selectedId ? { html } : {}),
          },
          "Move / trim text",
        );
      } else
        change(
          { html: writeTextLayer(project.html, next) },
          "Move / trim text",
        );
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
    target.addEventListener("lostpointercapture", end);
  };
  if (!items.length) return null;
  return (
    <section className="text-timeline" aria-label="Text timeline">
      {items.map((item) => {
        const layer = draft?.key === item.key ? draft.layer : item.layer;
        const start = item.offset + Math.max(0, layer.start - item.origin);
        const end =
          item.offset + Math.min(item.scene.duration, layer.end - item.origin);
        return (
          <div className="audio-edit-row text-edit-row" key={item.key}>
            <span className="audio-lane-label">
              <Type size={13} /> Text
            </span>
            <div className="audio-edit-track text-edit-track">
              <div
            data-timeline-kind="text" data-timeline-id={layer.id} data-timeline-scene={item.scene.id}
            className={
              "text-timeline-clip " +
                  (selected === layer.id &&
                  item.scene.id === (project.workflow?.selectedId ?? "")
                    ? "selected"
                    : "")
                }
                style={{
                  left: `${(start / duration) * 100}%`,
                  width: `${((end - start) / duration) * 100}%`,
                }}
              >
                <button
                  className="text-trim"
                  aria-label={`Trim start of text ${layer.text.slice(0, 30)}`}
                  disabled={item.scene.locked}
                  onPointerDown={(event) => drag(event, item, "start")}
                />
                <button
                  className="text-clip-move"
                  aria-label={`Move text ${layer.text.slice(0, 30)}`}
                  title={`${layer.text} · ${(start - item.offset).toFixed(2)}–${(end - item.offset).toFixed(2)}s · Drag to move, edges to trim`}
                  onPointerDown={(event) => drag(event, item, "move")}
                  onClick={() => onSelect(item.scene.id || undefined, layer.id)}
                  onDoubleClick={() => {
                    onSelect(item.scene.id || undefined, layer.id);
                    window.dispatchEvent(
                      new CustomEvent("framescript-edit-text", {
                        detail: layer.id,
                      }),
                    );
                  }}
                >
                  <Type size={12} />
                  <span>{layer.text}</span>
                </button>
                <button
                  className="text-trim"
                  aria-label={`Trim end of text ${layer.text.slice(0, 30)}`}
                  disabled={item.scene.locked}
                  onPointerDown={(event) => drag(event, item, "end")}
                />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
