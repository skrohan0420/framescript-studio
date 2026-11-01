import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Editor from "@monaco-editor/react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Columns2,
  Expand,
  FilePlus2,
  FolderOpen,
  History,
  ImagePlus,
  Maximize2,
  MousePointer2,
  Moon,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Sparkles,
  Square,
  Sun,
  Undo2,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  combined,
  parseCombined,
  applyAI,
  exportSchema,
  newProject,
  type Project,
  type ExportOptions,
} from "../shared/project";
import { examples } from "../shared/examples";
import { useStudio } from "./store";
import { bridge } from "./bridge";
import { Preview } from "./Preview";
import { Field, Modal } from "./components";
import { GenerationProgress } from "./GenerationProgress";
import { Workflow, SceneRail } from "./Workflow";
import { AudioPlayback } from "./AudioPlayback";
import {
  initialWorkflow,
  selectedScene,
  totalDuration,
  sceneOffset,
} from "../shared/workflow";
import { composeProject } from "../shared/composition";
import { acknowledgeRecovery, recoveryAcknowledged } from "./recovery";
type Tab = "html" | "css" | "js" | "all" | "split";
export function App() {
  const s = useStudio(),
    p = s.project;
  const [masterMode, setMasterMode] = useState(false);
  const viewProject = useMemo(
    () => (masterMode ? composeProject(p) : p),
    [masterMode, p],
  );
  const playbackDuration = masterMode ? totalDuration(p) : p.settings.duration;
  const sceneLocked = !!selectedScene(p)?.locked;
  const changeScope = (master: boolean) => {
    setMasterMode(master);
    s.setTime(0);
    s.setPlaying(false);
    setSelect(false);
  };
  const [tab, setTab] = useState<Tab>("html"),
    [combinedDraft, setCombinedDraft] = useState(""),
    [parseError, setParseError] = useState("");
  const [run, setRun] = useState(0),
    [zoom, setZoom] = useState(1),
    [select, setSelect] = useState(false),
    [selection, setSelection] = useState<any>(null),
    [runtime, setRuntime] = useState<any>(null);
  const [modal, setModal] = useState(""),
    [rightTab, setRightTab] = useState("assistant"),
    [prompt, setPrompt] = useState(""),
    [provider, setProvider] = useState("chatgpt"),
    [chatgpt, setChatgpt] = useState<{
      connected: boolean;
      pending: boolean;
      email?: string;
      error?: string;
      planEnabled?: boolean;
    }>({ connected: false, pending: false }),
    [connecting, setConnecting] = useState(false),
    [model, setModel] = useState(""),
    [providerError, setProviderError] = useState(""),
    [models, setModels] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [aiProgress, setAIProgress] = useState({
      stage: "Waiting for model",
      characters: 0,
    }),
    [generationSeconds, setGenerationSeconds] = useState(0),
    [chat, setChat] = useState<
      { role: string; content: string; applied?: boolean }[]
    >([]),
    [attached, setAttached] = useState<string[]>([]);
  const [notice, setNotice] = useState("Ready"),
    [progress, setProgress] = useState<any>(null),
    [exporting, setExporting] = useState(false),
    [exportOptions, setExportOptions] = useState<ExportOptions | null>(null),
    [recent, setRecent] = useState<string[]>([]),
    [recovery, setRecovery] = useState<Project | null>(null),
    [key, setKey] = useState(""),
    [hasKey, setHasKey] = useState(false);
  const [leftWidth, setLeftWidth] = useState(360),
    [rightWidth, setRightWidth] = useState(340),
    [leftHidden, setLeftHidden] = useState(false),
    [rightHidden, setRightHidden] = useState(false),
    [timelineHeight, setTimelineHeight] = useState(204),
    [timelineHidden, setTimelineHidden] = useState(false),
    [fontSize, setFontSize] = useState(14),
    [light, setLight] = useState(false);
  const editorRef = useRef<any>(null),
    fullscreenRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const sceneChats = useRef<Record<string, typeof chat>>({}),
    chatScene = useRef(p.workflow?.selectedId ?? "project");
  useEffect(() => {
    const id = p.workflow?.selectedId ?? "project";
    if (id !== chatScene.current) {
      sceneChats.current[chatScene.current] = chat;
      chatScene.current = id;
      setChat(sceneChats.current[id] ?? []);
    }
  }, [p.workflow?.selectedId]);
  const notify = useCallback(
    (error: unknown) =>
      setNotice(error instanceof Error ? error.message : String(error)),
    [],
  );
  const act = useCallback(
    async (fn: () => Promise<any>) => {
      try {
        return await fn();
      } catch (e) {
        notify(e);
        return null;
      }
    },
    [notify],
  );
  useEffect(() => {
    void act(async () => {
      const layout = await bridge.call("settingsGet");
      if (layout.leftWidth) setLeftWidth(layout.leftWidth);
      if (layout.rightWidth) setRightWidth(layout.rightWidth);
      if (layout.fontSize) setFontSize(layout.fontSize);
      if (layout.theme) setLight(layout.theme === "light");
      if (layout.timelineHeight) setTimelineHeight(layout.timelineHeight);
      if (typeof layout.leftHidden === "boolean")
        setLeftHidden(layout.leftHidden);
      if (typeof layout.rightHidden === "boolean")
        setRightHidden(layout.rightHidden);
      if (typeof layout.timelineHidden === "boolean")
        setTimelineHidden(layout.timelineHidden);
      if (layout.provider) setProvider(layout.provider);
      if (layout.model) setModel(layout.model);
      setRecent(await bridge.call("recents"));
      const autosaved = await bridge.call("recover");
      if (autosaved) {
        const acknowledged = await recoveryAcknowledged(autosaved);
        if (acknowledged === "restored") useStudio.getState().load(autosaved);
        else if (!acknowledged) setRecovery(autosaved);
      }
      const keyConfigured = await bridge.call("hasKey");
      setHasKey(keyConfigured);
      if (layout.provider === "openai" && !keyConfigured)
        setProvider("chatgpt");
    });
    return bridge.onProgress((data) => {
      if (data.kind === "ai") setAIProgress(data);
      else setProgress(data);
    });
  }, []);
  useEffect(() => {
    const id = setTimeout(
      () =>
        void act(() =>
          bridge.call("settingsSet", {
            leftWidth,
            rightWidth,
            fontSize,
            theme: light ? "light" : "dark",
            provider,
            model,
            timelineHeight,
            leftHidden,
            rightHidden,
            timelineHidden,
          }),
        ),
      800,
    );
    return () => clearTimeout(id);
  }, [
    leftWidth,
    rightWidth,
    fontSize,
    light,
    provider,
    model,
    timelineHeight,
    leftHidden,
    rightHidden,
    timelineHidden,
  ]);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);
  useEffect(() => setProviderError(""), [provider, hasKey]);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const interval = setInterval(
      () => setGenerationSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [busy]);
  useEffect(() => {
    if (provider !== "chatgpt") return;
    let alive = true,
      inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const state = await bridge.call("chatgptStatus");
        if (alive) setChatgpt(state);
      } catch (error) {
        if (alive) setProviderError((error as Error).message);
      } finally {
        inFlight = false;
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [provider]);
  useEffect(() => {
    if (provider === "chatgpt" && chatgpt.connected && !chatgpt.pending)
      refreshModels();
  }, [provider, chatgpt.connected]);
  const connectChatGPT = async (newAccount = false) => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setProviderError(
        "Your browser blocked the sign-in tab. Allow popups for this local app, then try again.",
      );
      return;
    }
    popup.opener = null;
    setConnecting(true);
    setProviderError("");
    try {
      const { url } = await bridge.call("chatgptConnect", newAccount);
      const auth = new URL(url);
      if (auth.origin !== "https://auth.openai.com")
        throw Error("Invalid sign-in destination");
      popup.location.href = url;
      setChatgpt(await bridge.call("chatgptStatus"));
    } catch (error) {
      popup.close();
      setProviderError((error as Error).message);
    } finally {
      setConnecting(false);
    }
  };
  useEffect(() => {
    if (!s.dirty) return;
    const id = setTimeout(
      () => void act(() => bridge.call("autosave", p)),
      1800,
    );
    return () => clearTimeout(id);
  }, [s.revision]);
  useEffect(() => {
    if (!s.playing) return;
    let id: number,
      last = performance.now();
    const tick = (now: number) => {
      const state = useStudio.getState(),
        duration = masterMode
          ? totalDuration(state.project)
          : state.project.settings.duration;
      let t = state.time + ((now - last) / 1000) * state.project.settings.speed;
      last = now;
      if (t >= duration) {
        if (state.project.settings.loop) t %= duration;
        else {
          t = duration;
          state.setPlaying(false);
        }
      }
      state.setTime(t);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [s.playing, masterMode]);
  const save = useCallback(
    (as = false) =>
      void act(async () => {
        const file = await bridge.call(
          as ? "saveAs" : "save",
          useStudio.getState().project,
        );
        if (file) {
          useStudio.getState().saved();
          setRecent(await bridge.call("recents"));
          setNotice("Saved · " + file);
        }
      }),
    [act],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save(e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        setRun((r) => r + 1);
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "z") {
        e.preventDefault();
        useStudio.getState().undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);
  useEffect(() => {
    if (tab === "all" && !parseError) setCombinedDraft(combined(p));
  }, [tab, s.revision]);
  const changeTab = (next: Tab) => {
    if (parseError && next !== "all") {
      setNotice(
        "Fix or discard the combined document before switching editors.",
      );
      return;
    }
    setTab(next);
  };
  const updateCombined = (text: string) => {
    setCombinedDraft(text);
    try {
      const parsed = parseCombined(text);
      s.change(parsed, "Combined document");
      setParseError("");
    } catch (e) {
      setParseError((e as Error).message);
    }
  };
  const load = (project: Project) => {
    sceneChats.current = {};
    chatScene.current = project.workflow?.selectedId ?? "project";
    setMasterMode(false);
    s.load(structuredClone(project));
    setParseError("");
    setSelection(null);
    setChat([]);
    setNotice("Project opened");
    setModal("");
  };
  const requestLoad = (project: Project) => {
    if (
      s.dirty &&
      !confirm(
        "Replace this workspace? Unsaved changes are available in recovery.",
      )
    )
      return;
    void act(async () => {
      await bridge.call("newSession");
      load(project);
    });
  };
  const importFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!/^image\/(png|jpeg|webp|svg\+xml|gif|avif|bmp)$/.test(file.type)) {
        notify("Unsupported image type");
        continue;
      }
      if (file.size > 15_000_000) {
        notify("Images must be under 15 MB");
        continue;
      }
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const state = useStudio.getState();
      state.change(
        {
          assets: [
            ...state.project.assets,
            { id: crypto.randomUUID(), name: file.name, data },
          ],
        },
        "Import asset",
      );
    }
    setNotice("Assets imported");
  };
  const refreshModels = () =>
    void act(async () => {
      setProviderError("");
      if (provider === "chatgpt" && !chatgpt.connected) {
        setProviderError(
          "Continue with ChatGPT to connect your account and authorize plan usage.",
        );
        return;
      }
      if (provider === "openai" && !hasKey) {
        setProviderError(
          "OpenAI API is not connected. Add an API key in Settings, or choose ChatGPT · account to sign in without one.",
        );
        return;
      }
      setNotice("Connecting to " + provider + "…");
      let list;
      try {
        list = await bridge.call("models", { provider, model });
      } catch (error) {
        setProviderError((error as Error).message);
        throw error;
      }
      setModels(list);
      if (!list.some((m: any) => m.name === model))
        setModel(list[0]?.name ?? "");
      setNotice(
        list.length
          ? `${list.length} models available`
          : "No models installed. In a terminal run: ollama pull qwen2.5-coder:7b",
      );
    });
  const ask = async (fix = false) => {
    if (masterMode || sceneLocked) {
      setNotice(
        masterMode
          ? "Select a scene before asking AI to revise it."
          : "Unlock the selected scene before generating changes.",
      );
      return;
    }
    if (busy) return;
    const text = fix
      ? `Fix this animation error, preserve the intended scene: ${s.error}`
      : prompt;
    if (provider === "chatgpt" && !chatgpt.connected) {
      setProviderError("Connect your ChatGPT account before generating.");
      return;
    }
    if (!text.trim() || !model) {
      setNotice("Enter a prompt and select a model.");
      return;
    }
    setBusy(true);
    setGenerationSeconds(0);
    setAIProgress({ stage: "Waiting for model", characters: 0 });
    setPrompt("");
    setChat((c) => [...c, { role: "user", content: text }]);
    try {
      const response = await bridge.call(
        "generate",
        { provider, model },
        {
          project: p,
          prompt: text,
          history: chat,
          images: p.assets
            .filter((a) => attached.includes(a.id))
            .map((a) => a.data),
          error: s.error,
          selection,
        },
      );
      const updated = applyAI(p, response);
      if (useStudio.getState().revision !== s.revision)
        throw Error(
          "Project changed during generation. Response was not applied; retry with the current project.",
        );
      s.change(updated, "AI · " + response.explanation);
      setChat((c) => [
        ...c,
        { role: "assistant", content: response.explanation, applied: true },
      ]);
      setNotice("AI changes applied · Undo available");
    } catch (e) {
      const message = (e as Error).message;
      setChat((c) => [...c, { role: "assistant", content: message }]);
      notify(e);
    } finally {
      setBusy(false);
    }
  };
  const visualChange = (property: string, value: string) => {
    if (!selection?.id) return;
    const doc = new DOMParser().parseFromString(p.html, "text/html");
    const matches = Array.from(doc.querySelectorAll("[id]")).filter(
      (el) => el.id === selection.id,
    );
    if (matches.length !== 1) {
      setNotice("Visual editing requires a unique ID in the source HTML.");
      return;
    }
    const el = matches[0] as HTMLElement;
    if (property === "text") el.textContent = value;
    else el.style.setProperty(property, value);
    s.change({ html: doc.body.innerHTML }, "Visual · " + property);
    setSelection({ ...selection, [property]: value });
  };
  const resize = (side: "left" | "right", e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = e.clientX,
      initial = side === "left" ? leftWidth : rightWidth;
    const target = e.currentTarget;
    const move = (ev: Event) => {
      const x = (ev as PointerEvent).clientX;
      const value = Math.min(
        650,
        Math.max(240, initial + (side === "left" ? x - start : start - x)),
      );
      (side === "left" ? setLeftWidth : setRightWidth)(value);
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
  };
  const openExport = () => {
    setExportOptions({
      format: "mp4",
      width: p.settings.width,
      height: p.settings.height,
      fps: p.settings.fps,
      duration: playbackDuration,
      speed: p.settings.speed,
      quality: 20,
      fit: "fit",
      transparent: false,
      time: s.time,
    });
    setModal("export");
  };
  const startExport = async () => {
    if (!exportOptions) return;
    try {
      exportSchema.parse(exportOptions);
    } catch (e) {
      notify(e);
      return;
    }
    setExporting(true);
    setProgress(null);
    try {
      const destination = await bridge.call(
        "export",
        viewProject,
        exportOptions,
      );
      if (destination) {
        setNotice("Export verified · " + destination);
        setModal("");
      }
    } catch (e) {
      notify(e);
    } finally {
      setExporting(false);
    }
  };
  const settings = (patch: Partial<Project["settings"]>) => {
    try {
      s.change({ settings: { ...p.settings, ...patch } }, "Project settings");
    } catch (e) {
      notify(e);
    }
  };
  const editor = (language: "html" | "css" | "js", height = "100%") => (
    <Editor
      height={height}
      language={language === "js" ? "javascript" : language}
      path={(p.workflow?.selectedId ?? "project") + "/" + language}
      theme={light ? "framescript-light" : "framescript-dark"}
      value={p[language]}
      onMount={(e) => {
        editorRef.current = e;
      }}
      onChange={(v) => s.change({ [language]: v ?? "" })}
      options={{
        fontSize,
        readOnly: masterMode || sceneLocked,
        fontFamily: "'Cascadia Code', Consolas, monospace",
        lineHeight: 22,
        minimap: { enabled: false },
        padding: { top: 18 },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
        tabSize: 2,
        bracketPairColorization: { enabled: true },
      }}
    />
  );
  return (
    <div
      className={"app " + (light ? "light" : "")}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void act(() => importFiles(e.dataTransfer.files));
      }}
    >
      <header className="toolbar">
        <div className="brand">
          <span className="brand-icon">
            <Code2 size={20} />
          </span>
          <strong>
            FrameScript<span>STUDIO</span>
          </strong>
        </div>
        <span className="toolbar-divider" />
        <input
          className="project-title"
          aria-label="Project name"
          value={p.name}
          onChange={(e) => {
            if (e.target.value)
              s.change({ name: e.target.value }, "Rename project");
          }}
        />
        <span className="dirty">{s.dirty ? "●" : "✓"}</span>
        <div className="toolbar-actions">
          <button
            aria-label="New project"
            title="New project"
            onClick={() => requestLoad(newProject())}
          >
            <FilePlus2 size={17} />
            <span className="action-label">New</span>
          </button>
          <button
            title="Open project"
            aria-label="Open project"
            onClick={() =>
              void act(async () => {
                if (
                  s.dirty &&
                  !confirm("Open another project and replace unsaved changes?")
                )
                  return;
                const project = await bridge.call("open");
                if (project) load(project);
              })
            }
          >
            <FolderOpen size={17} />
            <span className="action-label">Open</span>
          </button>
          <button
            aria-label="Save (Ctrl+S)"
            title="Save (Ctrl+S)"
            onClick={() => save()}
          >
            <Save size={17} />
            <span className="action-label">Save</span>
          </button>
          <button
            title="Undo project change"
            disabled={!s.past.length}
            onClick={s.undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            title="Redo project change"
            disabled={!s.future.length}
            onClick={s.redo}
          >
            <Redo2 size={17} />
          </button>
        </div>
        <div className="toolbar-spacer" />
        <button
          className="text-button"
          onClick={() => {
            if (!p.workflow)
              s.change({ workflow: initialWorkflow(p) }, "Enable storyboard");
            setModal("workflow");
          }}
        >
          Storyboard
        </button>
        <button className="text-button" onClick={() => setModal("examples")}>
          Examples
        </button>
        <button
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          title={light ? "Switch to dark theme" : "Switch to light theme"}
          onClick={() => setLight(!light)}
        >
          {light ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button
          title="Project and provider settings"
          onClick={() => setModal("settings")}
        >
          <Settings2 size={18} />
        </button>
        <button className="primary" onClick={openExport}>
          <ArrowDownToLine size={16} /> Export <ChevronDown size={12} />
        </button>
      </header>
      {recovery && (
        <div
          className="recovery-banner"
          role="region"
          aria-label="Autosave recovery"
        >
          <span>
            Autosaved project <strong>“{recovery.name}”</strong> is available.
          </span>
          <button
            className="primary"
            onClick={() =>
              void act(async () => {
                await bridge.call("newSession");
                await acknowledgeRecovery(recovery, true);
                load(recovery);
                setRecovery(null);
                setNotice("Autosaved workspace restored");
              })
            }
          >
            Restore workspace
          </button>
          <button
            onClick={() =>
              void act(async () => {
                await acknowledgeRecovery(recovery);
                setRecovery(null);
              })
            }
          >
            Dismiss
          </button>
        </div>
      )}
      <div
        className="workspace"
        style={{
          gridTemplateColumns: `${leftHidden ? "0" : leftWidth}px ${leftHidden ? "0" : "5"}px minmax(250px,1fr) ${rightHidden ? "0" : "5"}px ${rightHidden ? "0" : rightWidth}px`,
        }}
      >
        <aside
          className="code-panel"
          style={{ visibility: leftHidden ? "hidden" : "visible" }}
        >
          <SceneRail master={masterMode} onMaster={changeScope} busy={busy} />
          <div className="panel-heading">
            <span>
              <Code2 size={14} /> SOURCE CODE
            </span>
            <div>
              <button
                title="Format document"
                onClick={() =>
                  editorRef.current
                    ?.getAction("editor.action.formatDocument")
                    ?.run()
                }
              >
                Format
              </button>
              <button
                title="Collapse code panel"
                onClick={() => setLeftHidden(true)}
              >
                <Columns2 size={14} />
              </button>
            </div>
          </div>
          <div className="editor-tabs">
            {(["html", "css", "js", "all", "split"] as Tab[]).map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => changeTab(t)}
              >
                {t === "html"
                  ? "< >"
                  : t === "css"
                    ? "#"
                    : t === "js"
                      ? "JS"
                      : t === "all"
                        ? "◈"
                        : "▥"}{" "}
                <span>{t === "js" ? "JavaScript" : t.toUpperCase()}</span>
              </button>
            ))}
          </div>
          <div className="editor-container">
            {tab === "all" ? (
              <>
                <Editor
                  language="html"
                  theme={light ? "framescript-light" : "framescript-dark"}
                  path={(p.workflow?.selectedId ?? "project") + "/all"}
                  value={combinedDraft}
                  onChange={(v) => updateCombined(v ?? "")}
                  options={{
                    fontSize,
                    readOnly: masterMode || sceneLocked,
                    minimap: { enabled: false },
                    wordWrap: "on",
                    automaticLayout: true,
                  }}
                />
                {parseError && (
                  <div className="inline-error">
                    {parseError}
                    <button
                      onClick={() => {
                        setParseError("");
                        setCombinedDraft(combined(p));
                      }}
                    >
                      Discard combined edits
                    </button>
                  </div>
                )}
              </>
            ) : tab === "split" ? (
              <div className="split-editors">
                {(["html", "css", "js"] as const).map((l) => (
                  <div key={l}>
                    <small>{l.toUpperCase()}</small>
                    {editor(l, "calc(100% - 22px)")}
                  </div>
                ))}
              </div>
            ) : (
              editor(tab)
            )}
          </div>
          <div className="assets">
            <div className="panel-heading">
              <span>
                ASSETS <b>{p.assets.length}</b>
              </span>
              <button
                title="Import images"
                onClick={() => fileRef.current?.click()}
              >
                <Plus size={15} />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              hidden
              onChange={(e) => {
                void act(() => importFiles(e.target.files));
                e.target.value = "";
              }}
            />
            {!p.assets.length ? (
              <button
                className="asset-drop"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={22} />
                <span>
                  Drop images here or <em>browse</em>
                </span>
                <small>PNG, JPG, SVG, WebP, GIF</small>
              </button>
            ) : (
              <div className="asset-list">
                {p.assets.map((a) => (
                  <div className="asset" key={a.id}>
                    <img src={a.data} />
                    <input
                      aria-label="Asset name"
                      value={a.name}
                      onChange={(e) =>
                        s.change(
                          {
                            assets: p.assets.map((x) =>
                              x.id === a.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          },
                          "Rename asset",
                        )
                      }
                    />
                    <button
                      title="Insert image into HTML"
                      onClick={() =>
                        s.change(
                          {
                            html:
                              p.html +
                              `\n<img id="image-${a.id}" src="asset://${a.id}" style="width:240px">`,
                          },
                          "Insert asset",
                        )
                      }
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      title="Attach image to AI prompt"
                      className={attached.includes(a.id) ? "accent" : ""}
                      onClick={() =>
                        setAttached((ids) =>
                          ids.includes(a.id)
                            ? ids.filter((i) => i !== a.id)
                            : [...ids, a.id],
                        )
                      }
                    >
                      <Sparkles size={13} />
                    </button>
                    <button
                      title="Delete unused asset"
                      onClick={() => {
                        if (
                          [
                            p.html,
                            p.css,
                            p.js,
                            ...(p.workflow?.scenes.flatMap((scene) => [
                              scene.html,
                              scene.css,
                              scene.js,
                            ]) ?? []),
                          ].some((x) => x.includes("asset://" + a.id)) ||
                          p.workflow?.mascot.references.includes(a.id)
                        ) {
                          setNotice(
                            "Remove references to this asset before deleting it.",
                          );
                          return;
                        }
                        s.change(
                          { assets: p.assets.filter((x) => x.id !== a.id) },
                          "Delete asset",
                        );
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
        <div
          className="resize-handle"
          onPointerDown={(e) => resize("left", e)}
        />
        <main className="center">
          <div className="preview-toolbar">
            <div className="preview-label">
              <span className="live-dot" /> LIVE PREVIEW
            </div>
            <button
              title="Select element"
              className={select ? "accent" : ""}
              onClick={() => {
                setSelect(!select);
                setRightTab("properties");
              }}
            >
              <MousePointer2 size={15} />
            </button>
            <span className="toolbar-spacer" />
            {leftHidden && (
              <button onClick={() => setLeftHidden(false)}>Code</button>
            )}
            <button
              className="text-button"
              onClick={() => {
                setRun((r) => r + 1);
                s.setTime(0);
              }}
            >
              <Play size={13} /> Run
            </button>
            <select
              aria-label="Canvas aspect ratio"
              value=""
              onChange={(e) => {
                const [w, h] = e.target.value.split(":").map(Number);
                if (w)
                  settings({
                    width: Math.round((p.settings.height * w) / h / 2) * 2,
                  });
              }}
            >
              <option value="">
                {p.settings.width} × {p.settings.height}
              </option>
              {["16:9", "9:16", "1:1", "4:3", "21:9"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <button
              title="Full screen preview"
              onClick={() => fullscreenRef.current?.requestFullscreen()}
            >
              <Expand size={15} />
            </button>
            {rightHidden && (
              <button onClick={() => setRightHidden(false)}>AI</button>
            )}
          </div>
          <div className="preview-shell" ref={fullscreenRef}>
            <Preview
              projectOverride={viewProject}
              run={run}
              select={select}
              onSelect={useCallback((value) => setSelection(value), [])}
              onReady={useCallback((value) => setRuntime(value), [])}
              onVisual={useCallback((value) => {
                const state = useStudio.getState();
                if (
                  typeof value?.id !== "string" ||
                  typeof value?.styles !== "object"
                )
                  return;
                const doc = new DOMParser().parseFromString(
                  state.project.html,
                  "text/html",
                );
                const elements = Array.from(
                  doc.querySelectorAll("[id]"),
                ).filter((el) => el.id === value.id);
                if (elements.length !== 1) return;
                const element = elements[0] as HTMLElement;
                for (const [key, v] of Object.entries(value.styles)) {
                  if (
                    ["position", "left", "top", "width", "height"].includes(
                      key,
                    ) &&
                    typeof v === "string"
                  )
                    element.style.setProperty(key, v);
                }
                state.change(
                  { html: doc.body.innerHTML },
                  "Visual drag / resize",
                );
              }, [])}
              zoom={zoom}
            />
            <div className="zoom-controls">
              <button
                title="Zoom out"
                onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
              >
                <ZoomOut size={14} />
              </button>
              <button onClick={() => setZoom(1)}>Fit</button>
              <button
                title="Zoom in"
                onClick={() => setZoom(Math.min(4, zoom + 0.1))}
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>
          {s.error && (
            <div className="preview-error">
              <span>{s.error}</span>
              <button onClick={() => void ask(true)}>Fix with AI</button>
            </div>
          )}
          <div
            className="timeline-resizer"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const start = e.clientY,
                initial = timelineHeight,
                target = e.currentTarget;
              const move = (event: Event) => {
                setTimelineHidden(false);
                setTimelineHeight(
                  Math.max(
                    160,
                    Math.min(
                      450,
                      initial + start - (event as PointerEvent).clientY,
                    ),
                  ),
                );
              };
              const end = () => {
                target.removeEventListener("pointermove", move);
                target.removeEventListener("pointerup", end);
              };
              target.addEventListener("pointermove", move);
              target.addEventListener("pointerup", end);
            }}
          />
          <section
            className="timeline"
            style={{
              height: timelineHidden ? 44 : timelineHeight,
              overflow: "hidden",
            }}
          >
            {" "}
            <div className="timeline-top">
              <button
                className="section-label"
                title="Collapse or expand timeline"
                onClick={() => setTimelineHidden(!timelineHidden)}
              >
                TIMELINE {timelineHidden ? "▴" : "▾"}
              </button>
              <span className="timing-badge">
                {p.settings.timing === "seek" ? "SEEK MODE" : "REPLAY EXPORT"}
              </span>
              <span className="toolbar-spacer" />
              <button
                title="Add timeline marker"
                onClick={() =>
                  s.change(
                    { markers: [...p.markers, s.time].sort((a, b) => a - b) },
                    "Add marker",
                  )
                }
              >
                <Plus size={13} /> Marker
              </button>
              <select
                aria-label="Playback speed"
                value={p.settings.speed}
                onChange={(e) => settings({ speed: Number(e.target.value) })}
              >
                {[
                  0.25,
                  0.5,
                  0.75,
                  1,
                  1.25,
                  1.5,
                  2,
                  3,
                  4,
                  ...(![0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].includes(
                    p.settings.speed,
                  )
                    ? [p.settings.speed]
                    : []),
                ].map((x) => (
                  <option key={x} value={x}>
                    {x}×
                  </option>
                ))}
              </select>
              <select
                aria-label="Frame rate"
                value={p.settings.fps}
                onChange={(e) => settings({ fps: Number(e.target.value) })}
              >
                {[
                  24,
                  25,
                  30,
                  60,
                  ...(![24, 25, 30, 60].includes(p.settings.fps)
                    ? [p.settings.fps]
                    : []),
                ].map((x) => (
                  <option key={x} value={x}>
                    {x} fps
                  </option>
                ))}
              </select>
            </div>
            <div className="ruler">
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i}>{((i * playbackDuration) / 10).toFixed(1)}s</span>
              ))}
            </div>
            <div className="track">
              <div
                className={"track-clip " + (masterMode ? "master-clips" : "")}
              >
                {masterMode && p.workflow ? (
                  p.workflow.scenes.map((scene) => (
                    <div
                      className="master-scene-clip"
                      key={scene.id}
                      style={{
                        width: (scene.duration / playbackDuration) * 100 + "%",
                      }}
                      title={scene.title + " · " + scene.duration + "s"}
                    >
                      {scene.title}
                    </div>
                  ))
                ) : (
                  <>
                    <span>
                      <Code2 size={13} /> {selectedScene(p)?.title ?? p.name}
                    </span>
                    <div className="keyframe-dots">
                      {runtime?.animations?.map((_: any, i: number) => (
                        <i key={i} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              {p.audio
                ?.filter(
                  (a) =>
                    !a.muted &&
                    (!a.sceneId ||
                      masterMode ||
                      a.sceneId === p.workflow?.selectedId),
                )
                .map((clip) => {
                  const offset =
                    !masterMode && p.workflow
                      ? sceneOffset(p, p.workflow.selectedId)
                      : 0;
                  const start =
                    clip.start +
                    (clip.sceneId ? sceneOffset(p, clip.sceneId) : 0) -
                    offset;
                  const left = Math.max(0, start),
                    right = Math.min(playbackDuration, start + clip.length);
                  return right > left ? (
                    <span
                      key={clip.id}
                      className={"audio-cue " + clip.lane}
                      title={`${clip.lane}: ${clip.name}`}
                      style={{
                        left: (left / playbackDuration) * 100 + "%",
                        width: ((right - left) / playbackDuration) * 100 + "%",
                      }}
                    />
                  ) : null;
                })}
              {p.markers.map((m, i) => (
                <button
                  key={i}
                  className="marker"
                  title={`Marker ${m.toFixed(2)}s · click to remove`}
                  style={{ left: (m / playbackDuration) * 100 + "%" }}
                  onClick={() =>
                    s.change(
                      { markers: p.markers.filter((_, j) => i !== j) },
                      "Remove marker",
                    )
                  }
                />
              ))}
              <input
                aria-label="Timeline position"
                className="scrubber"
                type="range"
                min={0}
                max={playbackDuration}
                step={1 / p.settings.fps}
                value={s.time}
                onChange={(e) => {
                  s.setPlaying(false);
                  s.setTime(Number(e.target.value));
                }}
              />
              <div
                className="playhead"
                style={{ left: (s.time / playbackDuration) * 100 + "%" }}
              />
            </div>
            <div className="transport">
              <button title="Restart" onClick={() => s.setTime(0)}>
                <RotateCcw size={15} />
              </button>
              <button
                title="Previous frame"
                onClick={() => {
                  s.setPlaying(false);
                  s.setTime(Math.max(0, s.time - 1 / p.settings.fps));
                }}
              >
                <ArrowLeft size={15} />
              </button>
              <button
                title={s.playing ? "Pause" : "Play"}
                className="play-button"
                onClick={() => s.setPlaying(!s.playing)}
              >
                {s.playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                title="Next frame"
                onClick={() => {
                  s.setPlaying(false);
                  s.setTime(
                    Math.min(playbackDuration, s.time + 1 / p.settings.fps),
                  );
                }}
              >
                <ArrowRight size={15} />
              </button>
              <button
                title="Stop"
                onClick={() => {
                  s.setPlaying(false);
                  s.setTime(0);
                }}
              >
                <Square size={13} />
              </button>
              <code>
                {s.time.toFixed(2)}{" "}
                <span>/ {playbackDuration.toFixed(2)} s</span>
              </code>
              <span className="toolbar-spacer" />
              <button
                className={p.settings.loop ? "accent" : ""}
                onClick={() => settings({ loop: !p.settings.loop })}
              >
                ↻ Loop
              </button>
            </div>
          </section>
        </main>
        <div
          className="resize-handle"
          onPointerDown={(e) => resize("right", e)}
        />
        <aside
          className="assistant-panel"
          style={{ visibility: rightHidden ? "hidden" : "visible" }}
        >
          <div className="right-tabs">
            <button
              className={rightTab === "assistant" ? "active" : ""}
              onClick={() => setRightTab("assistant")}
            >
              <Sparkles size={14} /> Assistant
            </button>
            <button
              className={rightTab === "properties" ? "active" : ""}
              onClick={() => setRightTab("properties")}
            >
              Properties
            </button>
            <button title="History" onClick={() => setRightTab("history")}>
              <History size={14} />
            </button>
            <button
              title="Collapse assistant"
              onClick={() => setRightHidden(true)}
            >
              <X size={13} />
            </button>
          </div>
          {rightTab === "assistant" ? (
            <>
              <div className="provider-row">
                <select
                  aria-label="AI provider"
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setModels([]);
                    setModel("");
                  }}
                >
                  <option value="chatgpt">ChatGPT</option>
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI API</option>
                </select>
                <button title="Refresh models" onClick={refreshModels}>
                  <RotateCcw size={13} />
                </button>
                {provider === "chatgpt" && (
                  <details
                    className="chatgpt-connection"
                    open={
                      !chatgpt.connected || chatgpt.pending || !!chatgpt.error
                    }
                  >
                    <summary
                      title={
                        chatgpt.connected
                          ? "Connected account settings"
                          : "Connect your ChatGPT account"
                      }
                    >
                      <UserRound size={15} />
                      <span
                        className="connection-indicator"
                        style={{
                          background: chatgpt.connected
                            ? "var(--success)"
                            : "var(--muted)",
                        }}
                      />
                      <span className="sr-only">
                        {chatgpt.connected
                          ? "ChatGPT connected"
                          : chatgpt.pending
                            ? "Signing in…"
                            : "Connect ChatGPT"}
                      </span>
                    </summary>
                    <div className="connection-details">
                      {chatgpt.connected ? (
                        <>
                          <strong>
                            Connected{" "}
                            {chatgpt.email ? "· " + chatgpt.email : ""}
                          </strong>
                          <small>
                            ChatGPT plan usage authorized. Your plan limits
                            apply.
                          </small>
                          <div className="connection-actions">
                            <a
                              href="https://chatgpt.com/#settings/Usage"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Manage usage
                            </a>
                            <button
                              disabled={busy || connecting || chatgpt.pending}
                              onClick={() => void connectChatGPT(true)}
                            >
                              Use another account
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <strong>Use your ChatGPT account</strong>
                          <small>
                            No API key required. Eligible plans and
                            authorization are required.
                          </small>
                        </>
                      )}
                      {chatgpt.pending ? (
                        <p role="status">
                          Finish signing in in the opened tab. Waiting for
                          authorization…
                        </p>
                      ) : (
                        !chatgpt.connected && (
                          <button
                            className="primary"
                            disabled={connecting || busy}
                            onClick={() => void connectChatGPT()}
                          >
                            Continue with ChatGPT
                          </button>
                        )
                      )}
                      {(chatgpt.connected || chatgpt.pending) && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void act(async () => {
                              const result =
                                await bridge.call("chatgptDisconnect");
                              setChatgpt(await bridge.call("chatgptStatus"));
                              setModels([]);
                              setModel("");
                              setProviderError(result.warning || "");
                            })
                          }
                        >
                          {chatgpt.pending ? "Cancel sign-in" : "Sign out"}
                        </button>
                      )}
                      {!chatgpt.connected && !chatgpt.pending && (
                        <button
                          disabled={connecting || busy}
                          onClick={() => void connectChatGPT(true)}
                        >
                          Use a different account
                        </button>
                      )}
                      {chatgpt.error && <p role="alert">{chatgpt.error}</p>}
                    </div>
                  </details>
                )}
                <select
                  className="model-select"
                  aria-label="AI model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  <option value="">Select a model…</option>
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.label ?? m.name}
                      {m.vision ? " · vision" : ""}
                    </option>
                  ))}
                  {model && !models.some((m) => m.name === model) && (
                    <option>{model}</option>
                  )}
                </select>
              </div>
              {(providerError || (provider === "openai" && !hasKey)) && (
                <div className="provider-error" role="alert">
                  <p>
                    {providerError ||
                      "OpenAI API is not connected. Add an API key in Settings, or choose ChatGPT · account to sign in without one."}
                  </p>
                  <button
                    disabled={
                      provider === "chatgpt" && (connecting || chatgpt.pending)
                    }
                    onClick={() =>
                      provider === "chatgpt"
                        ? void connectChatGPT()
                        : setModal("settings")
                    }
                  >
                    {provider === "chatgpt"
                      ? "Reconnect ChatGPT"
                      : "Open connection settings"}
                  </button>
                </div>
              )}
              <div className="chat-messages">
                {!chat.length ? (
                  <div className="assistant-welcome">
                    <span className="ai-orb">
                      <Sparkles size={25} />
                    </span>
                    <h2>Animation assistant</h2>
                    <p>
                      Generate a scene, refine your code, or fix an error.
                      Changes apply to{" "}
                      {p.workflow
                        ? "the selected scene"
                        : "your current project"}{" "}
                      and can be undone.
                    </p>
                    <div className="suggestions">
                      {[
                        p.workflow
                          ? "Generate the selected scene using its narration, visual direction, duration and shared style. Preserve other scenes."
                          : "Create a glowing solar system",
                        "Animate an elegant title reveal",
                        "Make this animation slower",
                      ].map((text) => (
                        <button key={text} onClick={() => setPrompt(text)}>
                          {text}
                          <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                    <div className="local-note">
                      <span className="local-dot" />
                      {provider === "ollama"
                        ? "Your code stays local with Ollama."
                        : "Your prompt and project context are sent to OpenAI."}
                      <br />
                      <small>
                        {provider === "ollama"
                          ? "Install Ollama, then pull a code model."
                          : "Review generated changes. Project undo is available."}
                        <br />
                        Vision models can inspect attached images.
                      </small>
                    </div>
                  </div>
                ) : (
                  chat.map((m, i) => (
                    <div key={i} className={"chat-message " + m.role}>
                      <small>{m.role === "user" ? "YOU" : "FRAMESCRIPT"}</small>
                      <p>{m.content}</p>
                      {m.role === "assistant" &&
                        m.applied &&
                        i === chat.length - 1 && (
                          <button onClick={s.undo} disabled={!s.past.length}>
                            <Undo2 size={12} /> Undo last change
                          </button>
                        )}
                    </div>
                  ))
                )}
                {busy && (
                  <GenerationProgress
                    stage={aiProgress.stage}
                    seconds={generationSeconds}
                    characters={aiProgress.characters}
                    model={models.find((m) => m.name === model)?.label ?? model}
                    onCancel={() => void act(() => bridge.call("cancelAI"))}
                  />
                )}
              </div>
              <div className="composer">
                {attached.length > 0 && (
                  <small>{attached.length} reference image(s) attached</small>
                )}
                <textarea
                  aria-label="Animation prompt"
                  placeholder="Describe your animation…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.stopPropagation();
                      void ask();
                    }
                  }}
                />
                <div>
                  <button
                    title="Import an image reference"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus size={17} />
                  </button>
                  <small>
                    {busy
                      ? "Generating · progress in chat above"
                      : "Ctrl + Enter to generate"}
                  </small>
                  {busy ? (
                    <button
                      title="Cancel AI"
                      onClick={() => void bridge.call("cancelAI")}
                    >
                      <Square size={16} />
                    </button>
                  ) : (
                    <button
                      title="Generate animation"
                      className="send-button"
                      onClick={() => void ask()}
                    >
                      <Send size={16} />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : rightTab === "properties" ? (
            <div className="properties">
              <h3>Element inspector</h3>
              {selection ? (
                <>
                  <p className="muted">
                    {selection.tag.toLowerCase()}
                    {selection.id ? " #" + selection.id : " · inspection only"}
                  </p>
                  {!selection.id && (
                    <p>
                      Add a unique ID to this element in the HTML editor to
                      enable safe visual editing.
                    </p>
                  )}
                  {(
                    [
                      "text",
                      "left",
                      "top",
                      "width",
                      "height",
                      "background",
                      "opacity",
                      "font-size",
                      "font-family",
                      "border-radius",
                      "transform",
                    ] as const
                  ).map((prop) => (
                    <Field key={prop} label={prop}>
                      <input
                        disabled={!selection.id}
                        key={selection.id + prop}
                        defaultValue={
                          selection[prop] ??
                          selection[
                            prop.replace(/-([a-z])/g, (_, x) => x.toUpperCase())
                          ] ??
                          ""
                        }
                        onBlur={(e) => visualChange(prop, e.target.value)}
                      />
                    </Field>
                  ))}
                  <small>
                    Drag identified elements to move; Shift + drag to resize.
                    Position requires positioned CSS. Transform accepts
                    rotate(), scale(), and translate(). Text changes replace
                    nested contents.
                  </small>
                </>
              ) : (
                <p className="muted">
                  Activate the selection arrow, then click an element in the
                  preview.
                </p>
              )}
              <h3>Animation inspection</h3>
              {runtime?.animations?.length ? (
                runtime.animations.map((a: any, i: number) => (
                  <p className="animation-row" key={i}>
                    <span>{a.name}</span>
                    <code>{a.duration} ms</code>
                  </p>
                ))
              ) : (
                <p className="muted">No Web Animations detected.</p>
              )}
              <p className="muted">
                {runtime?.contract
                  ? "renderFrame(time) contract detected."
                  : "CSS and Web Animations are seekable. Arbitrary timers, GIFs, media, and libraries may require replay export and cannot scrub accurately."}
              </p>
            </div>
          ) : (
            <div className="properties">
              <h3>Change history</h3>
              {s.past
                .slice()
                .reverse()
                .map((h, i) => (
                  <div className="history-row" key={i}>
                    <span>{h.label}</span>
                    {i === 0 && <button onClick={s.undo}>Undo</button>}
                  </div>
                ))}
              {!s.past.length && (
                <p className="muted">Edits and AI snapshots appear here.</p>
              )}
            </div>
          )}
        </aside>
      </div>
      <footer className="status-bar">
        <span className="live-dot" />
        <span role="status">{notice}</span>
        <span className="toolbar-spacer" />
        <span>LOCAL WEB APP</span>
        <span>UTF-8</span>
        <span>{p.settings.fps} FPS</span>
        <button onClick={() => setModal("settings")}>⚙</button>
      </footer>
      <AudioPlayback
        project={p}
        time={s.time}
        playing={s.playing}
        master={masterMode}
        onError={setNotice}
      />
      <Workflow
        open={modal === "workflow"}
        onClose={() => setModal("")}
        provider={provider}
        model={model}
        busy={busy}
        onMaster={changeScope}
        onNotice={setNotice}
      />
      <Modal
        title="Project & application settings"
        open={modal === "settings"}
        onClose={() => setModal("")}
      >
        <div className="settings-grid">
          <Field label="Canvas width">
            <input
              type="number"
              value={p.settings.width}
              onChange={(e) => settings({ width: +e.target.value })}
            />
          </Field>
          <Field label="Canvas height">
            <input
              type="number"
              value={p.settings.height}
              onChange={(e) => settings({ height: +e.target.value })}
            />
          </Field>
          <Field label="Duration (seconds)">
            <input
              type="number"
              step=".1"
              value={p.settings.duration}
              onChange={(e) => settings({ duration: +e.target.value })}
            />
          </Field>
          <Field label="Frame rate">
            <input
              type="number"
              value={p.settings.fps}
              onChange={(e) => settings({ fps: +e.target.value })}
            />
          </Field>
          <Field label="Playback speed">
            <input
              type="number"
              step=".1"
              value={p.settings.speed}
              onChange={(e) => settings({ speed: +e.target.value })}
            />
          </Field>
          <Field label="Background (CSS color or transparent)">
            <input
              value={p.settings.background}
              onChange={(e) => settings({ background: e.target.value })}
            />
          </Field>
          <Field label="Export timing">
            <select
              value={p.settings.timing}
              onChange={(e) => settings({ timing: e.target.value as any })}
            >
              <option value="seek">Seek CSS / renderFrame(time)</option>
              <option value="replay">
                Replay browser timers (export only)
              </option>
            </select>
          </Field>
          <Field label="Editor font size">
            <input
              type="number"
              min="10"
              max="28"
              value={fontSize}
              onChange={(e) =>
                setFontSize(Math.min(28, Math.max(10, +e.target.value)))
              }
            />
          </Field>
          <Field label="Allow animation network access">
            <input
              type="checkbox"
              checked={p.settings.network}
              onChange={(e) => settings({ network: e.target.checked })}
            />
          </Field>
          <Field label="Light workspace theme">
            <input
              type="checkbox"
              checked={light}
              onChange={(e) => setLight(e.target.checked)}
            />
          </Field>
        </div>
        <div className="settings-section">
          <h3>Optional OpenAI API</h3>
          <p className="muted">
            {hasKey
              ? "An API key is set for this server session."
              : "No API key configured."}{" "}
            Keys stay in Node server memory until restart. API usage is billed
            by OpenAI.
          </p>
          <div className="key-row">
            <input
              type="password"
              autoComplete="off"
              aria-label="OpenAI API key"
              placeholder="API key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <button
              onClick={() =>
                void act(async () => {
                  await bridge.call("credentials", key);
                  setKey("");
                  setHasKey(!!key);
                  setNotice("API key held in server memory until restart");
                })
              }
            >
              Use key
            </button>
            <button
              onClick={() =>
                void act(async () => {
                  const list = await bridge.call("models", {
                    provider: "openai",
                    model: "",
                  });
                  setNotice(`OpenAI connected · ${list.length} models`);
                })
              }
            >
              Test
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={() => save(true)}>Save as / duplicate</button>
          <button
            onClick={() =>
              void act(async () => {
                const file = await bridge.call("source", viewProject);
                if (file) setNotice("Source exported · " + file);
              })
            }
          >
            Export HTML source
          </button>
          <button
            onClick={() =>
              void act(async () => {
                if (await bridge.call("deleteProject")) {
                  load(newProject());
                  setNotice("Project moved to local trash");
                }
              })
            }
          >
            Move saved project to trash
          </button>
          <button className="primary" onClick={() => setModal("")}>
            Done
          </button>
        </div>
      </Modal>
      <Modal
        title="Example gallery & recent projects"
        open={modal === "examples"}
        onClose={() => setModal("")}
      >
        <div className="example-grid">
          {examples.map((example, i) => (
            <button key={example.name} onClick={() => requestLoad(example)}>
              <span className={"example-art art-" + i}>
                {["●", "Aa", "◌", "✧", "☀", "✦", "▥", "F", "◎", "▣"][i]}
              </span>
              <strong>{example.name}</strong>
              <small>Editable · export ready</small>
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="recent-list">
            <h3>Recent projects</h3>
            {recent.map((file) => (
              <button
                key={file}
                onClick={() =>
                  void act(async () => {
                    if (s.dirty && !confirm("Replace unsaved changes?")) return;
                    const project = await bridge.call("openRecent", file);
                    load(project);
                  })
                }
              >
                {file}
              </button>
            ))}
          </div>
        )}
      </Modal>
      <Modal
        title="Export animation"
        open={modal === "export"}
        onClose={() => {
          if (!exporting) setModal("");
        }}
      >
        {exportOptions && (
          <>
            <div className="settings-grid">
              <Field label="Format">
                <select
                  disabled={exporting}
                  value={exportOptions.format}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      format: e.target.value as any,
                      transparent: false,
                    })
                  }
                >
                  {["mp4", "mkv", "webm", "gif", "sequence", "png"].map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <Field label="Resolution preset">
                <select
                  defaultValue="custom"
                  onChange={(e) => {
                    const h = +e.target.value;
                    if (h)
                      setExportOptions({
                        ...exportOptions,
                        height: h,
                        width:
                          Math.round(
                            (h * p.settings.width) / p.settings.height / 2,
                          ) * 2,
                      });
                  }}
                >
                  <option value="custom">Custom</option>
                  {[720, 1080, 1440, 2160].map((h) => (
                    <option key={h} value={h}>
                      {h === 2160 ? "4K" : h + "p"}
                    </option>
                  ))}
                </select>
              </Field>
              {(
                [
                  "width",
                  "height",
                  "duration",
                  "fps",
                  "speed",
                  "quality",
                ] as const
              ).map((k) => (
                <Field
                  key={k}
                  label={k === "quality" ? "Quality CRF (lower is better)" : k}
                >
                  <input
                    disabled={exporting}
                    type="number"
                    step={k === "speed" || k === "duration" ? ".1" : "1"}
                    value={exportOptions[k]}
                    onChange={(e) =>
                      setExportOptions({
                        ...exportOptions,
                        [k]: +e.target.value,
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="Canvas fitting">
                <select
                  value={exportOptions.fit}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      fit: e.target.value as any,
                    })
                  }
                >
                  <option value="fit">Fit (letterbox)</option>
                  <option value="fill">Fill / crop</option>
                  <option value="stretch">Stretch</option>
                </select>
              </Field>
              <Field label="Preserve transparency">
                <input
                  type="checkbox"
                  disabled={
                    !["webm", "sequence", "png"].includes(exportOptions.format)
                  }
                  checked={exportOptions.transparent}
                  onChange={(e) =>
                    setExportOptions({
                      ...exportOptions,
                      transparent: e.target.checked,
                    })
                  }
                />
              </Field>
            </div>
            <p className="muted">
              {masterMode ? "Master composition" : "Selected scene"} · Output
              duration:{" "}
              {(exportOptions.duration / exportOptions.speed).toFixed(2)} s ·{" "}
              {Math.ceil(
                (exportOptions.duration / exportOptions.speed) *
                  exportOptions.fps,
              )}{" "}
              frames. Single PNG uses the current timeline position. H.264
              MP4/MKV cannot preserve transparency. Audio is mixed into MP4, MKV
              and WebM; GIF and PNG outputs are silent.
            </p>
            {progress && (
              <div className="export-progress">
                <progress max={progress.total} value={progress.done} />
                <p>
                  {progress.stage} · {progress.done} / {progress.total} frames ·{" "}
                  {Math.round((progress.done / progress.total) * 100)}%
                </p>
                <small>{progress.destination}</small>
              </div>
            )}
            <div className="modal-actions">
              {exporting ? (
                <button onClick={() => void bridge.call("cancelExport")}>
                  Cancel export
                </button>
              ) : (
                <button className="primary" onClick={() => void startExport()}>
                  <ArrowDownToLine size={15} /> Render & download
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
