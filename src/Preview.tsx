import { useEffect, useRef, useState } from "react";
import { documentFor } from "../shared/runtime";
import { useStudio } from "./store";
import type { Project } from "../shared/project";
import { saveTextTemplates } from "./typography-library";
import {
  readTextLayers,
  writeTextLayer,
  textLayerSchema,
} from "../shared/typography";
import { selectedScene } from "../shared/workflow";
import { Ruler, Check } from "lucide-react";
export function Preview({
  run,
  select,
  onSelect,
  onReady,
  onVisual,
  zoom,
  projectOverride,
  textEditing = true,
}: {
  run: number;
  select: boolean;
  onSelect: (s: any) => void;
  onReady: (s: any) => void;
  onVisual: (s: any) => void;
  zoom: number;
  projectOverride?: Project;
  textEditing?: boolean;
}) {
  const storedProject = useStudio((s) => s.project);
  const selectedText = useStudio((s) => s.selectedText);
  const textGesture = useRef<{ id: string; revision: number } | null>(null);
  const setError = useStudio((s) => s.setError);
  const project = projectOverride ?? storedProject;
  const [active, setActive] = useState("");
  const [candidate, setCandidate] = useState("");
  const [candidateKey, setCandidateKey] = useState(0);
  const activeRef = useRef<HTMLIFrameElement>(null),
    candidateRef = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [rulers, setRulers] = useState(true);
  const [inlineText, setInlineText] = useState<string | null>(null);
  const openText = (id: string) => {
    const state = useStudio.getState();
    if (
      selectedScene(state.project)?.locked ||
      !readTextLayers(state.project.html).some((layer) => layer.id === id)
    )
      return;
    state.setPlaying(false);
    state.setSelectedText(id);
    setInlineText(id);
  };
  useEffect(() => {
    const edit = (event: Event) =>
      openText((event as CustomEvent<string>).detail);
    window.addEventListener("framescript-edit-text", edit);
    return () => window.removeEventListener("framescript-edit-text", edit);
  }, []);
  const timeRef = useRef(useStudio.getState().time);
  useEffect(
    () =>
      useStudio.subscribe((state, previous) => {
        if (state.time === previous.time) return;
        timeRef.current = state.time;
        activeRef.current?.contentWindow?.postMessage(
          { framescript: true, type: "seek", value: state.time },
          "*",
        );
      }),
    [],
  );
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setFit(
        Math.min(
          (r.width - 56) / project.settings.width,
          (r.height - 56) / project.settings.height,
        ),
      );
    });
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [project.settings.width, project.settings.height]);
  useEffect(() => {
    const id = setTimeout(() => {
      setError("");
      setCandidate(documentFor(project, { textEditing }));
      setCandidateKey((k) => k + 1);
    }, 500);
    return () => clearTimeout(id);
  }, [
    run,
    project.html,
    project.css,
    project.js,
    project.settings,
    project.assets,
    textEditing,
  ]);
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.framescript) return;
      const pending = e.source === candidateRef.current?.contentWindow;
      const visible = e.source === activeRef.current?.contentWindow;
      if (!pending && !visible) return;
      if (visible && textEditing && e.data.type === "text-open")
        openText(e.data.value?.id);
      if (visible && textEditing && e.data.type === "text-key") {
        const state = useStudio.getState(),
          value = e.data.value;
        if (
          ["Delete", "Backspace", "w", "W"].includes(value?.key) &&
          readTextLayers(state.project.html).some(
            (layer) => layer.id === value.id,
          )
        ) {
          state.setSelectedText(value.id);
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: value.key, bubbles: true }),
          );
        }
      }
      if (visible && textEditing && e.data.type === "text-start") {
        const state = useStudio.getState();
        const id = e.data.value?.id;
        if (
          !selectedScene(state.project)?.locked &&
          readTextLayers(state.project.html).some((layer) => layer.id === id)
        ) {
          textGesture.current = { id, revision: state.revision };
          state.setPlaying(false);
          state.setSelectedText(id);
        }
      }
      if (visible && textEditing && e.data.type === "text-edit") {
        const state = useStudio.getState(),
          value = e.data.value,
          gesture = textGesture.current;
        textGesture.current = null;
        if (
          !gesture ||
          state.revision !== gesture.revision ||
          value?.id !== gesture.id ||
          selectedScene(state.project)?.locked
        )
          return;
        const layer = readTextLayers(state.project.html).find(
          (item) => item.id === value.id,
        );
        if (!layer) return;
        const result = textLayerSchema.safeParse({
          ...layer,
          x: value.x,
          y: value.y,
          size: value.size,
        });
        if (result.success)
          state.change(
            { html: writeTextLayer(state.project.html, result.data) },
            "Move / scale text",
          );
      }
      if (e.data.type === "toggle-play" && visible) {
        const state = useStudio.getState();
        if (!state.playing && state.time >= project.settings.duration)
          state.setTime(0);
        state.setPlaying(!state.playing);
      }
      if (e.data.type === "error") {
        const error = e.data.value;
        setError(
          typeof error === "object" && error
            ? String(error.message)
            : String(error),
          error && Number.isInteger(error.line) && error.line > 0
            ? { line: error.line, column: error.column || 1 }
            : undefined,
        );
        if (pending) setCandidate("");
      }
      if (e.data.type === "ready" && pending) {
        if (Array.isArray(e.data.value?.typography))
          saveTextTemplates(e.data.value.typography);
        setActive(candidate);
        setCandidate("");
        onReady(e.data.value);
      }
      if (e.data.type === "selection" && visible) onSelect(e.data.value);
      if (e.data.type === "visual" && visible) onVisual(e.data.value);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [candidate, onSelect, onReady, onVisual, textEditing]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "select-text", value: selectedText },
      "*",
    );
  }, [selectedText, active]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "seek", value: timeRef.current },
      "*",
    );
  }, [active]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "select", value: select },
      "*",
    );
  }, [select, active]);
  const s = Math.max(0.01, fit * zoom);
  const editingLayer =
    inlineText && textEditing
      ? readTextLayers(storedProject.html).find(
          (layer) => layer.id === inlineText,
        )
      : undefined;
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "editor-scale", value: s },
      "*",
    );
  }, [s, active]);
  const ticks = (length: number) => {
    const rough = 70 / s,
      magnitude = 10 ** Math.floor(Math.log10(rough));
    const step =
      ([1, 2, 5, 10].find((number) => number * magnitude >= rough) ?? 10) *
      magnitude;
    return Array.from(
      { length: Math.floor(length / step) + 1 },
      (_, index) => index * step,
    );
  };
  const frameStyle = {
    width: project.settings.width,
    height: project.settings.height,
    transform: `scale(${s})`,
    transformOrigin: "top left",
  };
  return (
    <div ref={box} className="preview-area">
      <div
        className="canvas-wrap"
        style={{
          width: project.settings.width * s,
          height: project.settings.height * s,
        }}
      >
        {rulers && (
          <>
            <div
              className="preview-ruler preview-ruler-x"
              aria-label="Horizontal pixel ruler"
            >
              {ticks(project.settings.width).map((value) => (
                <span
                  key={value}
                  style={{ left: `${(value / project.settings.width) * 100}%` }}
                >
                  {value}
                </span>
              ))}
            </div>
            <div
              className="preview-ruler preview-ruler-y"
              aria-label="Vertical pixel ruler"
            >
              {ticks(project.settings.height).map((value) => (
                <span
                  key={value}
                  style={{ top: `${(value / project.settings.height) * 100}%` }}
                >
                  {value}
                </span>
              ))}
            </div>
          </>
        )}
        {editingLayer && (
          <div
            className="inline-text-editor"
            style={{
              left: `${editingLayer.x}%`,
              top: `${editingLayer.y}%`,
              width: `${editingLayer.width}%`,
            }}
          >
            <textarea
              autoFocus
              aria-label="Edit text on canvas"
              rows={Math.max(2, editingLayer.text.split("\n").length)}
              value={editingLayer.text}
              style={{
                fontFamily: editingLayer.font,
                fontWeight: editingLayer.template.weight,
                fontSize: Math.max(12, editingLayer.size * s),
                color: editingLayer.color,
                textAlign: editingLayer.align,
              }}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (
                  event.key === "Escape" ||
                  ((event.ctrlKey || event.metaKey) && event.key === "Enter")
                ) {
                  event.preventDefault();
                  setInlineText(null);
                }
              }}
              onChange={(event) => {
                const state = useStudio.getState();
                const layer = readTextLayers(state.project.html).find(
                  (item) => item.id === editingLayer.id,
                );
                if (layer && !selectedScene(state.project)?.locked)
                  state.change(
                    {
                      html: writeTextLayer(state.project.html, {
                        ...layer,
                        text: event.target.value.slice(0, 5000),
                      }),
                    },
                    "Edit text on canvas",
                  );
              }}
            />
            <button
              aria-label="Finish editing text"
              title="Done · Escape"
              onClick={() => setInlineText(null)}
            >
              <Check size={14} />
            </button>
          </div>
        )}
        <iframe
          title="Animation preview"
          ref={activeRef}
          sandbox="allow-scripts"
          srcDoc={active}
          style={frameStyle}
          onLoad={() => {
            activeRef.current?.contentWindow?.postMessage(
              { framescript: true, type: "editor-scale", value: s },
              "*",
            );
            activeRef.current?.contentWindow?.postMessage(
              {
                framescript: true,
                type: "select-text",
                value: useStudio.getState().selectedText,
              },
              "*",
            );
            activeRef.current?.contentWindow?.postMessage(
              { framescript: true, type: "seek", value: timeRef.current },
              "*",
            );
            activeRef.current?.contentWindow?.postMessage(
              { framescript: true, type: "select", value: select },
              "*",
            );
          }}
        />
        {candidate && (
          <iframe
            key={candidateKey}
            title="Validating animation"
            className="candidate"
            ref={candidateRef}
            sandbox="allow-scripts"
            srcDoc={candidate}
            style={frameStyle}
          />
        )}
      </div>
      <button
        className="preview-ruler-toggle"
        aria-label="Show preview rulers"
        aria-pressed={rulers}
        title="Toggle pixel rulers · text snaps to center and safe margins; hold Alt to bypass"
        onClick={() => setRulers(!rulers)}
      >
        <Ruler size={14} />
      </button>
      <span className="canvas-note">
        {project.settings.width} × {project.settings.height} ·{" "}
        {project.settings.background === "transparent" ? "ALPHA" : "RGB"} ·{" "}
        {Math.round(s * 100)}%
      </span>
    </div>
  );
}
