import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  previewDocument,
  previewScale,
  type PreviewQuality,
  type PreviewConsoleEntry,
} from "./preview-document";
import { useStudio } from "./store";
import type { Project } from "../shared/project";
import { saveTextTemplates } from "./typography-library";
import {
  readTextLayers,
  writeTextLayer,
  textLayerSchema,
} from "../shared/typography";
import { selectedScene } from "../shared/workflow";
import type { PreviewShapePick } from "./preview-shapes";
import { Check } from "lucide-react";
export function Preview({
  run,
  select,
  onSelect,
  shapeSelection,
  onShapePick,
  onReady,
  onVisual,
  onConsole,
  consoleCommandRef,
  shortcutKeys,
  onPreviewShortcut,
  onTextShortcut,
  zoom,
  projectOverride,
  textEditing = true,
  rulers = true,
  quality = "auto",
  compositionProject,
}: {
  run: number;
  select: boolean;
  onSelect: (s: any) => void;
  shapeSelection: { clipId: string; objectId: string } | null;
  onShapePick: (pick: PreviewShapePick) => void;
  onReady: (s: any) => void;
  onVisual: (s: any) => void;
  onConsole: (entries: PreviewConsoleEntry[]) => void;
  consoleCommandRef: Ref<(command: string) => void>;
  shortcutKeys: string[];
  onPreviewShortcut: (chord: string, repeat: boolean) => void;
  onTextShortcut: (key: string) => void;
  zoom: number;
  projectOverride?: Project;
  textEditing?: boolean;
  rulers?: boolean;
  quality?: PreviewQuality;
  compositionProject?: Project;
}) {
  const storedProject = useStudio((s) => s.project);
  const selectedText = useStudio((s) => s.selectedText);
  const textGesture = useRef<{ id: string; revision: number } | null>(null);
  const setError = useStudio((s) => s.setError);
  const project = projectOverride ?? storedProject;
  const clip = selectedScene(project);
  const [active, setActive] = useState<number | null>(null);
  const [candidate, setCandidate] = useState<number | null>(null);
  const [frames, setFrames] = useState<
    { id: number; source: string; js: string }[]
  >([]);
  const nextFrame = useRef(0);
  const activeId = useRef<number | null>(null);
  const activeRef = useRef<HTMLIFrameElement>(null),
    candidateRef = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useImperativeHandle(
    consoleCommandRef,
    () => async (command) => {
      const target = activeRef.current?.contentWindow;
      if (!target) {
        onConsole([
          {
            level: "error",
            text: "Run a valid preview before using the console prompt.",
          },
        ]);
        return;
      }
      try {
        const { parse, parseExpression } = await import("@babel/parser");
        let body = "";
        let result = "undefined";
        try {
          const expression = parseExpression(command);
          result = command.slice(expression.start!, expression.end!);
        } catch {
          const { program } = parse(command, { sourceType: "script" });
          const last = program.body.at(-1);
          if (last?.type === "ExpressionStatement") {
            body = command.slice(0, last.start!);
            result = command.slice(
              last.expression.start!,
              last.expression.end!,
            );
          } else {
            body = command;
          }
        }
        if (target !== activeRef.current?.contentWindow)
          throw Error("The preview changed. Run the command again.");
        const script = `try {\n${body}\n;window.__fsConsoleReport("result", (${result}\n));\n} catch (error) { window.__fsConsoleReport("error", error); }`;
        target.postMessage(
          { framescript: true, type: "preview-console-eval", value: script },
          "*",
        );
      } catch (error) {
        onConsole([{ level: "error", text: String(error) }]);
      }
    },
    [onConsole],
  );
  const [fit, setFit] = useState(1);
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
  const seekBusy = useRef(false);
  const sentTime = useRef<number | null>(null);
  const sendSeek = () => {
    if (!activeRef.current || seekBusy.current || document.hidden) return;
    seekBusy.current = true;
    sentTime.current = timeRef.current;
    activeRef.current.contentWindow?.postMessage(
      { framescript: true, type: "seek", value: timeRef.current },
      "*",
    );
  };
  useEffect(
    () =>
      useStudio.subscribe((state, previous) => {
        if (state.time === previous.time) return;
        timeRef.current = state.time;
        sendSeek();
      }),
    [],
  );
  useEffect(() => {
    const resume = () => {
      if (!document.hidden) sendSeek();
    };
    document.addEventListener("visibilitychange", resume);
    return () => document.removeEventListener("visibilitychange", resume);
  }, []);
  const resolutionScale = previewScale(
    quality,
    project.settings.height,
    project.settings.height * Math.max(0.01, fit * zoom),
    window.devicePixelRatio || 1,
  );
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setFit(
        Math.min(
          (r.width - 96) / project.settings.width,
          (r.height - 72) / project.settings.height,
        ),
      );
    });
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [project.settings.width, project.settings.height]);
  useEffect(() => {
    const id = setTimeout(() => {
      const id = ++nextFrame.current;
      const source = previewDocument(
        project,
        resolutionScale,
        textEditing,
        compositionProject,
        undefined,
        shortcutKeys,
      );
      setFrames((previous) => [
        ...previous.filter((frame) => frame.id === activeId.current),
        { id, source, js: project.js },
      ]);
      setCandidate(id);
    }, 500);
    return () => clearTimeout(id);
  }, [
    run,
    project.html,
    project.css,
    project.js,
    project.settings,
    project.assets,
    clip?.id,
    clip?.locked,
    clip?.sourceOffset,
    clip?.structuredEdit,
    textEditing,
    resolutionScale,
    shortcutKeys,
    compositionProject,
  ]);
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.framescript) return;
      const pending = e.source === candidateRef.current?.contentWindow;
      const visible = e.source === activeRef.current?.contentWindow;
      if (!pending && !visible) return;
      if (
        visible &&
        e.data.type === "preview-shortcut" &&
        typeof e.data.value?.chord === "string"
      )
        onPreviewShortcut(e.data.value.chord, e.data.value.repeat === true);
      if (e.data.type === "preview-console" && Array.isArray(e.data.value)) {
        const payload: Partial<PreviewConsoleEntry>[] = e.data.value;
        const entries = payload
          .slice(0, 50)
          .filter(
            (entry): entry is PreviewConsoleEntry =>
              entry &&
              ["log", "info", "debug", "warn", "error", "result"].includes(
                entry.level ?? "",
              ) &&
              typeof entry.text === "string",
          )
          .map(({ level, text, pretty, structured, table }) => ({
            level,
            text: text.slice(0, 4000),
            pretty:
              typeof pretty === "string" ? pretty.slice(0, 8000) : undefined,
            structured:
              typeof structured === "string" && structured.length <= 256000
                ? structured
                : undefined,
            table: table === true,
          }));
        if (entries.length) onConsole(entries);
      }
      if (visible && e.data.type === "preview-seek-done") {
        seekBusy.current = false;
        if (sentTime.current !== timeRef.current) sendSeek();
      }
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
          onTextShortcut(value.key);
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
        const message =
          typeof error === "object" && error
            ? String(error.message)
            : String(error);
        onConsole([{ level: "error", text: message.slice(0, 4000) }]);
        setError(
          message,
          error && Number.isInteger(error.line) && error.line > 0
            ? { line: error.line, column: error.column || 1 }
            : undefined,
          frames.find(
            (frame) => frame.id === (pending ? candidate : activeId.current),
          )?.js,
        );
        if (pending) {
          setFrames((previous) =>
            previous.filter((frame) => frame.id !== candidate),
          );
          setCandidate(null);
        }
      }
      if (e.data.type === "ready" && pending) {
        setError("");
        if (Array.isArray(e.data.value?.typography))
          saveTextTemplates(e.data.value.typography);
        activeId.current = candidate;
        setActive(candidate);
        setFrames((previous) =>
          previous.filter((frame) => frame.id === candidate),
        );
        setCandidate(null);
        onReady(e.data.value);
      }
      if (e.data.type === "selection" && visible) onSelect(e.data.value);
      if (e.data.type === "shape-pick" && visible) onShapePick(e.data.value);
      if (e.data.type === "visual" && visible) onVisual(e.data.value);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [
    candidate,
    frames,
    onSelect,
    onShapePick,
    onReady,
    onVisual,
    onConsole,
    onPreviewShortcut,
    onTextShortcut,
    setError,
    textEditing,
  ]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "select-text", value: selectedText },
      "*",
    );
  }, [selectedText, active]);
  useEffect(() => {
    seekBusy.current = false;
    sentTime.current = null;
    sendSeek();
  }, [active]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "select", value: select },
      "*",
    );
  }, [select, active]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "shape-selection", value: shapeSelection },
      "*",
    );
  }, [shapeSelection?.clipId, shapeSelection?.objectId, active]);
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
    const rough = 80 / s,
      magnitude = 10 ** Math.floor(Math.log10(rough));
    const step =
      ([1, 2, 5, 10].find((number) => number * magnitude >= rough) ?? 10) *
      magnitude;
    return Array.from(
      { length: Math.floor(length / (step / 5)) + 1 },
      (_, index) => ({ value: (index * step) / 5, major: index % 5 === 0 }),
    );
  };
  const frameStyle = {
    width: project.settings.width,
    height: project.settings.height,
    transform: `scale(${s})`,
    transformOrigin: "top left",
  };
  return (
    <div ref={box} className="preview-area" data-rulers={rulers}>
      <div
        className="canvas-wrap"
        style={{
          width: project.settings.width * s,
          height: project.settings.height * s,
        }}
      >
        {rulers && (
          <>
            <div className="preview-ruler-corner" aria-hidden="true">
              px
            </div>
            <div
              className="preview-ruler preview-ruler-x"
              aria-label="Horizontal pixel ruler"
            >
              {ticks(project.settings.width).map(({ value, major }) => (
                <span
                  key={value}
                  className={major ? "major" : "minor"}
                  style={{ left: `${(value / project.settings.width) * 100}%` }}
                >
                  {major &&
                    (value === 0 ||
                      value * s < project.settings.width * s - 32) && (
                      <b>{Math.round(value)}</b>
                    )}
                </span>
              ))}
            </div>
            <div
              className="preview-ruler preview-ruler-y"
              aria-label="Vertical pixel ruler"
            >
              {ticks(project.settings.height).map(({ value, major }) => (
                <span
                  key={value}
                  className={major ? "major" : "minor"}
                  style={{ top: `${(value / project.settings.height) * 100}%` }}
                >
                  {major &&
                    value > 0 &&
                    value * s < project.settings.height * s - 16 && (
                      <b>{Math.round(value)}</b>
                    )}
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
        {frames.map((frame) => (
          <iframe
            key={frame.id}
            title={
              frame.id === active ? "Animation preview" : "Validating animation"
            }
            className={frame.id === active ? undefined : "candidate"}
            ref={(node) => {
              if (frame.id === active) activeRef.current = node;
              if (frame.id === candidate) candidateRef.current = node;
            }}
            sandbox="allow-scripts"
            srcDoc={frame.source}
            style={frameStyle}
          />
        ))}
      </div>
      <span className="canvas-note">
        {project.settings.width} × {project.settings.height} ·{" "}
        {project.settings.background === "transparent" ? "ALPHA" : "RGB"} ·{" "}
        {Math.round(s * 100)}%
      </span>
    </div>
  );
}
