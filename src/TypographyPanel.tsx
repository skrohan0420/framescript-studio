import { useStatusNotice } from "./editor-status";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Type } from "lucide-react";
import { useProjectState, useStudio } from "./store";
import { selectedScene } from "../shared/workflow";
import {
  readTextLayers,
  writeTextLayer,
  textTemplates,
  typographyDragType,
  type TextLayer,
  type TextTemplate,
} from "../shared/typography";
import {
  deleteTextTemplate,
  savedTextTemplates,
  saveTextTemplates,
} from "./typography-library";

function TemplateTile({
  template,
  active,
  onClick,
  onDrag,
}: {
  template: TextTemplate;
  active: boolean;
  onClick: () => void;
  onDrag: (event: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const sample = useRef<HTMLSpanElement>(null);
  const animation = useRef<Animation | null>(null);
  useEffect(() => () => animation.current?.cancel(), []);
  return (
    <button
      className={"type-template " + (active ? "active" : "")}
      aria-pressed={active}
      aria-label={`Use ${template.name} text template`}
      onClick={onClick}
      draggable
      onDragStart={onDrag}
      title="Click to choose · drag onto the timeline to add"
      onPointerEnter={() => {
        animation.current?.cancel();
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          animation.current =
            sample.current?.animate(template.frames, {
              duration: 900,
              easing: template.easing,
            }) ?? null;
      }}
    >
      <span
        ref={sample}
        style={{
          ...template.appearance,
          color: template.color,
          fontFamily: template.font,
          fontWeight: template.weight,
        }}
      >
        Aa
      </span>
      <strong>{template.name}</strong>
      <small>
        {template.category === "Saved" ? "From your scenes" : template.category}
      </small>
    </button>
  );
}
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="0.1"
        value={editing ?? Number(value.toFixed(2))}
        onFocus={(event) => setEditing(event.target.value)}
        onBlur={() => setEditing(null)}
        onChange={(event) => {
          setEditing(event.target.value);
          const next = Number(event.target.value);
          if (
            event.target.value &&
            Number.isFinite(next) &&
            next >= min &&
            next <= max
          )
            onChange(next);
        }}
      />
    </label>
  );
}
export function TypographyPanel({ master }: { master: boolean }) {
  const { project, change } = useProjectState();
  const [saved, setSaved] = useState(savedTextTemplates);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const selectedId = useStudio((state) => state.selectedText);
  const setSelectedId = useStudio((state) => state.setSelectedText);
  const notify = useStatusNotice();
  const origin = selectedScene(project)?.sourceOffset ?? 0;
  const createDraft = (template = textTemplates[0]): TextLayer => ({
    id: "text-" + crypto.randomUUID(),
    text: "Your text here",
    template,
    x: 50,
    y:
      template.name === "Subtitle" || template.name === "Lower third" ? 85 : 50,
    width: 80,
    size: Math.min(400, Math.max(8, Math.round(project.settings.width / 24))),
    color: template.color,
    font: template.font,
    align: "center",
    start: origin,
    end: origin + project.settings.duration,
    entrance: 0.8,
  });
  const [draft, setDraft] = useState<TextLayer>(() => createDraft());
  const sceneId = project.workflow?.selectedId;
  const previousScene = useRef(sceneId);
  useEffect(() => {
    if (previousScene.current === sceneId) return;
    previousScene.current = sceneId;
    const selected = readTextLayers(project.html).find(
      (layer) => layer.id === selectedId,
    );
    if (selected) {
      setDraft(selected);
      return;
    }
    setSelectedId(null);
    setDraft(createDraft());

  }, [sceneId]);
  useEffect(() => {
    if (!selectedId) return;
    const layer = readTextLayers(project.html).find(
      (item) => item.id === selectedId,
    );
    if (layer) setDraft(layer);
  }, [selectedId, project.html]);
  useEffect(() => {
    const update = () => setSaved(savedTextTemplates());
    window.addEventListener("typography-library-change", update);
    return () =>
      window.removeEventListener("typography-library-change", update);
  }, []);
  const layers = readTextLayers(project.html);
  const locked = master || !!selectedScene(project)?.locked;
  const templates = [...textTemplates, ...saved].filter(
    (template) =>
      (category === "All" || template.category === category) &&
      template.name.toLowerCase().includes(search.toLowerCase()),
  );
  const update = (patch: Partial<TextLayer>) => {
    const next = { ...draft, ...patch, ...(patch.start !== undefined ? { motionStart: Math.max(0, (draft.motionStart ?? draft.start) + patch.start - draft.start) } : {}) };
    setDraft(next);

    if (!selectedId || locked) return;
    if (
      next.end <= next.start ||
      next.start < origin ||
      next.end > origin + project.settings.duration
    ) {
      notify("Keep the text timing within this scene.");
      return;
    }
    change({ html: writeTextLayer(project.html, next) }, "Edit text layer");
  };
  const apply = () => {
    if (locked) return;
    if (!draft.text.trim()) {
      notify("Enter text first.");
      return;
    }
    if (
      draft.end <= draft.start ||
      draft.end > origin + project.settings.duration ||
      draft.start < origin
    ) {
      notify("End must be after Start and within this scene’s duration.");
      return;
    }
    const layer = { ...draft, id: selectedId ?? "text-" + crypto.randomUUID() };
    change(
      { html: writeTextLayer(project.html, layer) },
      selectedId ? "Edit text layer" : "Add text layer",
    );
    setSelectedId(layer.id);
    setDraft(layer);
    const sourceOffset = selectedScene(project)?.sourceOffset ?? 0;
    useStudio
      .getState()
      .setTime(
        Math.max(
          0,
          Math.min(layer.end - 0.001, layer.start + layer.entrance) -
            sourceOffset,
        ),
      );
    notify(selectedId ? "Text updated." : "Text added to this scene.");
  };
  return (
    <section className="typography-panel" aria-label="Typography templates">
      <div className="panel-heading">
        <span>
          <Type size={14} /> TYPOGRAPHY
        </span>
        <span>{textTemplates.length + saved.length} styles</span>
      </div>
      <div className="typography-scroll">
        <input
          className="library-search"
          aria-label="Search text templates"
          placeholder="Search text animations…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="type-filters">
          {["All", "Titles", "Captions", "Motion", "Saved"].map((name) => (
            <button
              key={name}
              aria-pressed={category === name}
              className={category === name ? "active" : ""}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="type-template-grid">
          {templates.map((template) => (
            <TemplateTile
              key={template.id}
              template={template}
              active={draft.template.id === template.id}
              onDrag={(event) => {
                event.dataTransfer.setData(
                  typographyDragType,
                  JSON.stringify({
                    ...draft,
                    template,
                    color: template.color,
                    font: template.font,
                  }),
                );
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() =>
                update({ template, font: template.font, color: template.color })
              }
            />
          ))}
        </div>
        {!templates.length && (
          <p className="type-hint">
            No matching styles. New HTML text styles are saved here
            automatically when scenes preview successfully.
          </p>
        )}
        <p className="type-hint">
          Drag a style onto the timeline to add text. Hover to preview. HTML
          text styles and supported animation keyframes are collected
          automatically on this browser. Canvas text and custom JavaScript
          motion aren’t captured.
        </p>
        <div className="type-editor">
          <div className="type-section-heading">
            <strong>{selectedId ? "Edit text layer" : "New text layer"}</strong>
            <button
              title="Start a new text layer"
              onClick={() => {
                setSelectedId(null);
                setDraft(createDraft(draft.template));

              }}
            >
              <Plus size={14} /> New
            </button>
          </div>
          {locked && (
            <p className="type-hint">
              Select an unlocked timeline to add or edit text.
            </p>
          )}
          <label className="field">
            <span>Text · {draft.template.name}</span>
            <textarea
              aria-label="Typography text"
              rows={3}
              maxLength={5000}
              value={draft.text}
              onChange={(event) => update({ text: event.target.value })}
            />
          </label>
          <div className="type-properties">
            <label className="field">
              <span>Font</span>
              <input
                aria-label="Text font"
                value={draft.font}
                maxLength={200}
                onChange={(event) => update({ font: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Color</span>
              <input
                aria-label="Text color"
                value={draft.color}
                maxLength={100}
                onChange={(event) => update({ color: event.target.value })}
              />
            </label>
            <NumberField
              label="Size (px)"
              value={draft.size}
              min={8}
              max={400}
              onChange={(size) => update({ size })}
            />
            <NumberField
              label="Width (%)"
              value={draft.width}
              min={5}
              max={100}
              onChange={(width) => update({ width })}
            />
            <NumberField
              label="X (%)"
              value={draft.x}
              min={0}
              max={100}
              onChange={(x) => update({ x })}
            />
            <NumberField
              label="Y (%)"
              value={draft.y}
              min={0}
              max={100}
              onChange={(y) => update({ y })}
            />
            <NumberField
              label="Start (s)"
              value={Math.max(0, draft.start - origin)}
              min={0}
              max={project.settings.duration}
              onChange={(start) => update({ start: start + origin })}
            />
            <NumberField
              label="End (s)"
              value={Math.min(project.settings.duration, draft.end - origin)}
              min={0.1}
              max={project.settings.duration}
              onChange={(end) => update({ end: end + origin })}
            />
            <NumberField
              label="Entrance (s)"
              value={draft.entrance}
              min={0.05}
              max={30}
              onChange={(entrance) => update({ entrance })}
            />
            <label className="field">
              <span>Alignment</span>
              <select
                aria-label="Text alignment"
                value={draft.align}
                onChange={(event) =>
                  update({ align: event.target.value as TextLayer["align"] })
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <div className="type-presets">
            {[
              ["Top", 20],
              ["Center", 50],
              ["Bottom", 85],
            ].map(([label, y]) => (
              <button
                key={label}
                onClick={() => update({ x: 50, y: Number(y) })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="type-editor-actions">
            {!selectedId && (
              <button className="primary" disabled={locked} onClick={apply}>
                <Plus size={14} /> Add to scene
              </button>
            )}
            {selectedId && (
              <span className="type-live-label">Edits save automatically</span>
            )}
            <button
              onClick={() => {
                saveTextTemplates([
                  {
                    ...draft.template,
                    color: draft.color,
                    font: draft.font,
                    name: draft.text.slice(0, 45) || draft.template.name,
                    sample: draft.text.slice(0, 500),
                  },
                ]);
                notify("Style saved to the library.");
              }}
            >
              Save style
            </button>
            {draft.template.category === "Saved" && (
              <button
                title="Delete saved template"
                onClick={() => {
                  deleteTextTemplate(draft.template.id);
                  update({ template: textTemplates[0] });
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="type-section-heading">
          <strong>Text in this scene</strong>
          <span>{layers.length}</span>
        </div>
        {!layers.length && (
          <p className="type-hint">
            Add a template above to create an editable text layer.
          </p>
        )}
        {layers.map((layer) => (
          <div
            className={
              "type-layer-row " + (selectedId === layer.id ? "active" : "")
            }
            key={layer.id}
          >
            <button
              onClick={() => {
                setSelectedId(layer.id);
                setDraft(layer);

              }}
            >
              <Type size={13} />
              <span>{layer.text.slice(0, 50)}</span>
              <small>
                {layer.start.toFixed(1)}–{layer.end.toFixed(1)}s
              </small>
            </button>
            <button
              title="Remove text layer"
              aria-label={`Remove text ${layer.text.slice(0, 30)}`}
              disabled={locked}
              onClick={() => {
                change(
                  { html: writeTextLayer(project.html, layer, true) },
                  "Remove text layer",
                );
                if (selectedId === layer.id) {
                  setSelectedId(null);
                  setDraft(createDraft());
                }
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
