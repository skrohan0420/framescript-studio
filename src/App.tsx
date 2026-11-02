import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense,
} from "react";
import Editor from "./LazyEditor";
import { PromptTemplates } from "./PromptTemplates";
import { ClipsPanel } from "./ClipsPanel";
import { TypographyPanel } from "./TypographyPanel";
import { ProjectHome } from "./ProjectHome";
import { chooseExportFile, supportsExportPicker } from "./bridge";
import { ExportSettings } from "./ExportSettings";
import { ExportDock } from "./ExportDock";
import { TabIdentity } from "./TabIdentity";
import { useExports } from "./useExports";
import {
  imageMarkup,
  sizeError,
  type ImagePlacement,
} from "../shared/media-layout";
import {
  FileText,
  Home,
  CaseSensitive,
  Music,
  Film,
  Library,
  Layers,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  ClipboardPaste,
  Columns2,
  Expand,
  FilePlus2,
  FolderOpen,
  History,
  ImagePlus,
  Maximize2,
  Minus,
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
  projectSchema,
  applyAI,
  exportSchema,
  newProject,
  type Project,
  type ExportOptions,
} from "../shared/project";
import { useStudio, useProjectState } from "./store";
import { Timeline } from "./Timeline";
import { PlayerTransport } from "./PlayerTransport";
import { MediaLibrary } from "./MediaLibrary";
import { ProjectInspector } from "./ProjectInspector";
import { bridge } from "./bridge";
import { Preview } from "./Preview";
import { Field, Modal } from "./components";
import { GenerationProgress } from "./GenerationProgress";
import { SceneRail, SceneInspector, ManualTimelines } from "./ScenePanels";
import { AudioPlayback } from "./AudioPlayback";
import {
  initialWorkflow,
  activateScene,
  selectedScene,
  totalDuration,
  sceneOffset,
} from "../shared/workflow";
import { composeProject } from "../shared/composition";
import { acknowledgeRecovery, recoveryAcknowledged } from "./recovery";
import { RecoveryHistory, downloadRecoveryCopy } from "./RecoveryHistory";
import { SceneReview } from "./SceneReview";
const Services = lazy(() =>
  import("./Services").then((module) => ({ default: module.Services })),
);
const Workflow = lazy(() =>
  import("./Workflow").then((module) => ({ default: module.Workflow })),
);

type Tab = "html" | "css" | "js" | "all" | "split";
export function App() {
  const s = useProjectState(),
    p = s.project;
  const manualMode = true;
  const [showHome, setShowHome] = useState(
    () => window.location.hash !== "#editor",
  );
  useEffect(() => {
    const route = () => setShowHome(window.location.hash !== "#editor");
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  const enterEditor = () => {
    window.location.hash = "editor";
    setShowHome(false);
  };
  const [masterMode, setMasterMode] = useState(false);
  const [productionMode, setProductionMode] = useState(true);
  const [leftView, setLeftView] = useState("code");
  const [libraryTool, setLibraryTool] = useState("script");
  const [libraryToolLoaded, setLibraryToolLoaded] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<string>();
  const [selectedAsset, setSelectedAsset] = useState<string>();
  const [followFrame, setFollowFrame] = useState(true);
  const [imagePlacement, setImagePlacement] = useState<ImagePlacement>({
    width: 1920,
    height: 1080,
    fit: "contain",
  });
  const placement = followFrame
    ? { ...imagePlacement, width: p.settings.width, height: p.settings.height }
    : imagePlacement;
  const [assetsCollapsed, setAssetsCollapsed] = useState(false);
  const [pasteDocument, setPasteDocument] = useState("");
  const [pasteError, setPasteError] = useState("");
  const jumpLine = useRef<{ line: number; column: number } | null>(null);
  const [reviewAI, setReviewAI] = useState(false);
  const [pendingAI, setPendingAI] = useState<{
    before: Project;
    after: Project;
    revision: number;
    explanation: string;
  } | null>(null);
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
  const [servicesReturn, setServicesReturn] = useState("");
  const openServices = (back = "") => {
    setServicesReturn(back);
    setModal("services");
  };
  const [workflowTab, setWorkflowTab] = useState<string | undefined>();
  const [modal, setModal] = useState(""),
    [rightTab, setRightTab] = useState("project"),
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
    [selectingExportFile, setSelectingExportFile] = useState(false),
    [exportFormError, setExportError] = useState(""),
    [exportOptions, setExportOptions] = useState<ExportOptions | null>(null),
    [recovery, setRecovery] = useState<Project | null>(null),
    [hasKey, setHasKey] = useState(false);
  const exports = useExports();
  const [selectedExportId, setSelectedExportId] = useState<string | null>(null);
  const selectedExportRef = useRef<string | null>(null);
  selectedExportRef.current = selectedExportId;
  const selectedExport = exports.jobs.find(
    (job) => job.id === selectedExportId,
  );
  const exporting = selectingExportFile || selectedExport?.status === "running";
  const exportError = exportFormError || selectedExport?.error || "";
  const progress = selectedExport?.progress;
  const [chooseExportLocation, setChooseExportLocation] = useState(false);
  const [leftWidth, setLeftWidth] = useState(340),
    [rightWidth, setRightWidth] = useState(340),
    [leftHidden, setLeftHidden] = useState(false),
    [rightHidden, setRightHidden] = useState(false),
    [timelineHeight, setTimelineHeight] = useState(320),
    [timelineHidden, setTimelineHidden] = useState(false),
    [fontSize, setFontSize] = useState(14),
    [light, setLight] = useState(false);
  const editorRef = useRef<any>(null),
    workspaceRef = useRef<HTMLDivElement>(null),
    fullscreenRef = useRef<HTMLDivElement>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const [workspaceSize, setWorkspaceSize] = useState({
    width: Math.max(980, window.innerWidth) - 12,
    height: window.innerHeight - 66,
  });
  const panelBudget = Math.max(
    0,
    workspaceSize.width - 250 - (leftHidden ? 0 : 5) - (rightHidden ? 0 : 5),
  );
  const panelScale = Math.min(
    1,
    panelBudget /
      Math.max(
        1,
        (leftHidden ? 0 : leftWidth) + (rightHidden ? 0 : rightWidth),
      ),
  );
  const visibleLeftWidth = leftHidden ? 0 : Math.floor(leftWidth * panelScale);
  const visibleRightWidth = rightHidden
    ? 0
    : Math.floor(rightWidth * panelScale);
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
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => {
    const element = workspaceRef.current;
    if (!storageReady || !element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWorkspaceSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [storageReady, showHome]);
  const [workflowLoaded, setWorkflowLoaded] = useState(false);
  const [editorLoaded, setEditorLoaded] = useState(false);
  useEffect(() => {
    if (modal === "workflow") setWorkflowLoaded(true);
  }, [modal]);
  useEffect(() => {
    if (storageReady && !leftHidden && leftView === "code")
      setEditorLoaded(true);
  }, [storageReady, leftHidden, leftView]);
  const [storageSaveState, setStorageSaveState] = useState("saving");
  const [storageSaveError, setStorageSaveError] = useState("");
  const [saveAttempt, setSaveAttempt] = useState(0);
  const autosaveGeneration = useRef(0);
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
      if (
        layout.leftView &&
        [
          "media",
          "clips",
          "typography",
          "prompts",
          "audio",
          "script",
          "scenes",
          "components",
          "code",
          "voice",
          "sound",
          "mascot",
        ].includes(layout.leftView)
      ) {
        setLeftView(layout.leftView);
        setProductionMode(layout.leftView !== "code");
        if (!["media", "audio", "code"].includes(layout.leftView)) {
          setLibraryTool(layout.leftView);
          setLibraryToolLoaded(true);
        }
      }
      if (layout.layoutVersion !== 2) {
        setLeftHidden(false);
        setTimelineHeight(320);
      }
      if (
        ["project", "assistant", "properties", "history"].includes(
          layout.rightTab,
        )
      )
        setRightTab(layout.rightTab);
      if (typeof layout.reviewAI === "boolean") setReviewAI(layout.reviewAI);
      const workspace = await bridge.call("workspaceGet");
      if (workspace) {
        useStudio.getState().load(workspace);
        if (workspace.workflow && !manualMode) setMasterMode(true);
        setNotice("Workspace restored from SQLite");
      }
      const autosaved = workspace ? null : await bridge.call("recover");
      if (autosaved) {
        const acknowledged = await recoveryAcknowledged(autosaved);
        if (acknowledged === "restored") useStudio.getState().load(autosaved);
        else if (!acknowledged) setRecovery(autosaved);
      }
      const editor = await bridge.call("workspaceEditorGet");
      if (workspace && editor.sceneChats) {
        sceneChats.current = editor.sceneChats;
        chatScene.current = workspace.workflow?.selectedId ?? "project";
        setChat(editor.sceneChats[chatScene.current] ?? []);
      }
      if (manualMode) {
        setLeftView("code");
        setProductionMode(false);
        setLeftHidden(false);
        setRightTab("project");
      }
      setStorageReady(true);
      const keyConfigured = await bridge.call("hasKey");
      setHasKey(keyConfigured);
      if (layout.provider === "openai" && !keyConfigured)
        setProvider("chatgpt");
    });
    return bridge.onProgress((data) => {
      if (data.kind === "ai") setAIProgress(data);
      else exports.onProgress(data);
    });
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    const id = setTimeout(
      () =>
        void act(() =>
          bridge.call("settingsSet", {
            leftView,
            rightTab,
            layoutVersion: 2,
            reviewAI,
            productionMode,
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
    storageReady,
    productionMode,
    leftView,
    rightTab,
    reviewAI,
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
    if (provider !== "chatgpt" && modal !== "services") return;
    if (manualMode) return;
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
  }, [provider, modal]);
  useEffect(() => {
    if (manualMode) return;
    if (provider === "chatgpt" && chatgpt.connected && !chatgpt.pending)
      refreshModels();
  }, [provider, chatgpt.connected]);
  const connectChatGPT = async (
    newAccount = false,
    remember = localStorage.getItem("framescript.remember-connections") !==
      "false",
  ) => {
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
      const { url } = await bridge.call("chatgptConnect", newAccount, remember);
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
    if (!storageReady) return;
    const generation = ++autosaveGeneration.current;
    setStorageSaveState("saving");
    setStorageSaveError("");
    const id = setTimeout(
      () =>
        void act(() =>
          bridge
            .call("autosave", p, {
              sceneChats: { ...sceneChats.current, [chatScene.current]: chat },
            })
            .then(() => {
              if (generation === autosaveGeneration.current)
                setStorageSaveState("saved");
            })
            .catch((error) => {
              if (generation === autosaveGeneration.current) {
                setStorageSaveState("error");
                setStorageSaveError(
                  error instanceof Error ? error.message : String(error),
                );
              }
              throw error;
            }),
        ),
      300,
    );
    return () => {
      clearTimeout(id);
      if (generation === autosaveGeneration.current)
        autosaveGeneration.current++;
    };
  }, [s.revision, storageReady, chat, saveAttempt]);
  const save = useCallback(
    (as = false) =>
      void act(async () => {
        const submitted = useStudio.getState();
        const file = await bridge.call(
          as ? "saveAs" : "save",
          submitted.project,
        );
        if (file) {
          useStudio.getState().saved(submitted.revision);
          setNotice("Saved · " + file);
        }
      }),
    [act],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showHome) return;
      if (
        (e.code === "Space" || e.key === " ") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const target = e.target as HTMLElement;
        if (
          target.closest(
            "input, textarea, select, [contenteditable], .monaco-editor, [role=dialog]",
          ) ||
          document.querySelector('[role="dialog"]')
        )
          return;
        e.preventDefault();
        if (!e.repeat) {
          const state = useStudio.getState();
          if (
            !state.playing &&
            state.time >=
              (masterMode
                ? totalDuration(state.project)
                : state.project.settings.duration)
          )
            state.setTime(0);
          state.setPlaying(!state.playing);
        }
      }
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
  }, [save, masterMode, showHome]);
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
  const importDocument = (text: string) => {
    try {
      const current = useStudio.getState();
      if (masterMode)
        throw Error("Switch to editing a timeline before applying code.");
      if (selectedScene(current.project)?.locked)
        throw Error("Unlock this timeline before applying code.");
      const source = text
        .trim()
        .replace(/^```(?:html)?\s*\n/i, "")
        .replace(/\n```\s*$/, "");
      if (!source.trim()) throw Error("Paste an HTML document first.");
      const parsed = parseCombined(source);
      const validated = projectSchema.safeParse({
        ...current.project,
        ...parsed,
      });
      if (!validated.success)
        throw Error(
          validated.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        );
      current.change(parsed, "Paste full HTML document");
      const result = useStudio.getState();
      if (
        result.project.html !== parsed.html ||
        result.project.css !== parsed.css ||
        result.project.js !== parsed.js
      )
        throw Error(
          result.error ||
            "The code could not be applied. Your pasted draft is preserved.",
        );
      setParseError("");
      setPasteError("");
      setModal("");
      setTab("html");
      setNotice(
        "Document split into HTML, CSS and JavaScript · Undo available",
      );
    } catch (error) {
      setPasteDocument(text);
      setPasteError((error as Error).message);
      setModal("paste-code");
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
  const checkpointCurrent = async (reason: string) => {
    const state = useStudio.getState();
    await bridge.call("autosave", state.project, {
      sceneChats: { ...sceneChats.current, [chatScene.current]: chat },
    });
    await bridge.call("checkpoint", reason);
    if (state.revision !== useStudio.getState().revision)
      throw Error("Project changed while preparing recovery. Try again.");
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
      await checkpointCurrent("Before replacing project");
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
          "OpenAI API is not connected. Add an API key in Services, or choose ChatGPT · account to sign in without one.",
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
  const [queuedSceneGeneration, setQueuedSceneGeneration] = useState<
    string | null
  >(null);
  const sceneGenerationPrompt =
    "Generate a complete visual animation for the SELECTED scene using its narration as voice-over context, its visual subject, duration and shared style. Replace HTML, CSS and JavaScript as needed to build real animated imagery, not a typography layout or placeholder. NO on-screen text, labels, headlines or captions, even if old visual direction asks for them. Keep visual content visible at time zero. Preserve every other scene and all narration/audio.";
  const ask = async (fix = false, promptOverride?: string) => {
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
      : (promptOverride ?? prompt);
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
      if (reviewAI) {
        setPendingAI({
          before: p,
          after: updated,
          revision: s.revision,
          explanation: response.explanation,
        });
        setNotice("AI scene ready for review");
        return;
      }
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
      initial = side === "left" ? visibleLeftWidth : visibleRightWidth;
    const other = side === "left" ? visibleRightWidth : visibleLeftWidth;
    const maximum = Math.min(650, Math.max(200, panelBudget - other));
    setLeftWidth(visibleLeftWidth || leftWidth);
    setRightWidth(visibleRightWidth || rightWidth);
    const target = e.currentTarget;
    const move = (ev: Event) => {
      const x = (ev as PointerEvent).clientX;
      const value = Math.min(
        maximum,
        Math.max(200, initial + (side === "left" ? x - start : start - x)),
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
    setSelectedExportId(null);
    setExportError("");
    setExportOptions({
      fileName: masterMode
        ? p.name
        : `${p.name} - ${selectedScene(p)?.title || "Timeline"}`,
      format: "mp4",
      width: p.settings.width,
      height: p.settings.height,
      fps: p.settings.fps,
      duration: playbackDuration,
      speed: p.settings.speed,
      quality: 20,
      fit: "fit",
      transparent: false,
      time: useStudio.getState().time,
    });
    setModal("export");
  };
  const startExport = async () => {
    if (!exportOptions) return;
    setExportError("");
    let jobId: string | undefined;
    const options = { ...exportOptions };
    const snapshot = viewProject;
    const timeline = masterMode
      ? "Combined timelines"
      : selectedScene(p)?.title || "Active timeline";
    try {
      exportSchema.parse(options);
      setSelectingExportFile(true);
      const handle = chooseExportLocation
        ? await chooseExportFile(options.fileName || p.name, options.format)
        : undefined;
      const job = exports.start(snapshot, options, timeline, handle);
      jobId = job.id;
      setSelectedExportId(job.id);
      setSelectingExportFile(false);
      const destination = await job.finished;
      if (destination) {
        setNotice("Export verified · " + destination);
        if (selectedExportRef.current === job.id)
          setModal((current) => (current === "export" ? "" : current));
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        if (!jobId) setExportError((error as Error).message);
        notify(error);
      }
    } finally {
      setSelectingExportFile(false);
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
        if (language === "js" && jumpLine.current) {
          e.setPosition({
            lineNumber: jumpLine.current.line,
            column: jumpLine.current.column,
          });
          e.revealLineInCenter(jumpLine.current.line);
          e.focus();
          jumpLine.current = null;
        }
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
  const handleSelect = useCallback((value: any) => setSelection(value), []);
  const handleReady = useCallback((value: any) => setRuntime(value), []);
  const handleVisual = useCallback((value: any) => {
    const state = useStudio.getState();
    if (typeof value?.id !== "string" || typeof value?.styles !== "object")
      return;
    const doc = new DOMParser().parseFromString(
      state.project.html,
      "text/html",
    );
    const elements = Array.from(doc.querySelectorAll("[id]")).filter(
      (el) => el.id === value.id,
    );
    if (elements.length !== 1) return;
    const element = elements[0] as HTMLElement;
    for (const [key, v] of Object.entries(value.styles)) {
      if (
        ["position", "left", "top", "width", "height"].includes(key) &&
        typeof v === "string"
      )
        element.style.setProperty(key, v);
    }
    state.change({ html: doc.body.innerHTML }, "Visual drag / resize");
  }, []);
  useEffect(() => {
    if (
      queuedSceneGeneration &&
      p.workflow?.selectedId === queuedSceneGeneration &&
      !busy
    ) {
      setQueuedSceneGeneration(null);
      void ask(false, sceneGenerationPrompt);
    }
  }, [queuedSceneGeneration, p.workflow?.selectedId, busy]);
  const selectLeftView = (view: string) => {
    setLeftView(view);
    setProductionMode(view !== "code");
    setLeftHidden(false);
  };
  const selectedText = useStudio((state) => state.selectedText);
  useEffect(() => {
    if (selectedText) selectLeftView("typography");
  }, [selectedText]);
  const openLibraryTool = (view: string) => {
    const current = useStudio.getState().project;
    if (!current.workflow)
      s.change(
        { workflow: initialWorkflow(current) },
        "Enable production workflow",
      );
    selectLeftView(view);
    setLibraryTool(view);
    setLibraryToolLoaded(true);
    setSelectedAudio(undefined);
    setSelectedAsset(undefined);
  };
  const insertLibraryAsset = (id: string) => {
    const current = useStudio.getState().project;
    if (selectedScene(current)?.locked) {
      setNotice("Unlock the selected scene before inserting media.");
      return;
    }
    if (!current.assets.some((asset) => asset.id === id)) return;
    const placementError = sizeError(placement);
    if (placementError) {
      setNotice(placementError);
      return;
    }
    if (masterMode) changeScope(false);
    s.change(
      {
        html: current.html + imageMarkup(id, current.settings, placement),
      },
      "Insert library asset",
    );
    setNotice(
      `Image inserted · ${placement.width} × ${placement.height} · ${placement.fit}`,
    );
  };
  const removeLibraryAsset = (id: string) => {
    const current = useStudio.getState().project;
    if (
      [
        current.html,
        current.css,
        current.js,
        ...(current.workflow?.scenes.flatMap((scene) => [
          scene.html,
          scene.css,
          scene.js,
        ]) ?? []),
      ].some((source) => source.includes("asset://" + id)) ||
      current.workflow?.mascot.references.includes(id)
    ) {
      setNotice("Remove references to this asset before deleting it.");
      return;
    }
    s.change(
      { assets: current.assets.filter((asset) => asset.id !== id) },
      "Delete asset",
    );
  };
  const openSceneEditor = () => {
    setLeftView("code");
    setProductionMode(false);
    setSelectedAudio(undefined);
    setSelectedAsset(undefined);
    setLeftHidden(false);
    setRightHidden(false);
    setRightTab("project");
    setTab("html");
    setParseError("");
    setSelection(null);
    setRun((value) => value + 1);
    setNotice(
      `Editing scene: ${selectedScene(useStudio.getState().project)?.title ?? "Selected scene"}`,
    );
  };
  const exportDock =
    exports.jobs.length > 0 && (showHome || modal !== "export") ? (
      <ExportDock
        jobs={exports.jobs}
        onRestore={(id) => {
          const job = exports.jobs.find((item) => item.id === id);
          if (!job) return;
          setSelectedExportId(id);
          setExportOptions(job.options);
          setExportError("");
          enterEditor();
          setModal("export");
        }}
        onCancel={exports.cancel}
        onDismiss={exports.dismiss}
        onNew={() => {
          enterEditor();
          openExport();
        }}
      />
    ) : null;
  if (!storageReady)
    return (
      <main className="modal" role="status">
        <h2>Opening your workspace…</h2>
        <p>
          {notice === "Ready" ? "Reading the local SQLite database." : notice}
        </p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </main>
    );
  if (showHome)
    return (
      <>
        <TabIdentity name={p.name} home />
        <ProjectHome
          onRenameCurrent={(name) => s.change({ name }, "Rename project")}
          workspace={p}
          onContinue={enterEditor}
          onCreate={async (options) => {
            await checkpointCurrent("Before creating project");
            const current = useStudio.getState().project,
              blank = newProject();
            if (
              current.name !== blank.name ||
              current.html !== blank.html ||
              current.css !== blank.css ||
              current.js !== blank.js ||
              current.audio?.length ||
              current.assets.length
            )
              await bridge.call("projectSave", current, {
                thumbnail: runtime?.thumbnail,
              });
            const project = {
              ...newProject(),
              name: options.name,
              html: "",
              css: "",
              js: "window.renderFrame = (timeInSeconds) => {};",
              settings: {
                ...newProject().settings,
                width: options.width,
                height: options.height,
                fps: options.fps,
                duration: options.duration,
              },
            };
            await bridge.call("projectSave", project, { create: true });
            load(project);
            selectLeftView(options.tool);
            enterEditor();
          }}
          onOpen={async (id) => {
            await checkpointCurrent("Before opening project");
            load(await bridge.call("openRecent", id));
            enterEditor();
          }}
          onImport={async () => {
            await checkpointCurrent("Before importing project");
            const project = await bridge.call("open");
            if (project) {
              await bridge.call("projectSave", project, { create: true });
              load(project);
              enterEditor();
            }
          }}
        />
        {exportDock}
      </>
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
      <TabIdentity name={p.name} />
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*"
        hidden
        onChange={(e) => {
          const files = e.target.files;
          void act(() => importFiles(files));
          e.target.value = "";
        }}
      />
      <header className="toolbar">
        <button
          aria-label="Project home"
          title="Save and return to project home"
          onClick={() =>
            void act(async () => {
              useStudio.getState().setPlaying(false);
              await checkpointCurrent("Return to project home");
              await bridge.call("projectSave", useStudio.getState().project, {
                thumbnail: runtime?.thumbnail,
              });
              window.location.hash = "home";
              setShowHome(true);
            })
          }
        >
          <Home size={17} />
        </button>
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
                await checkpointCurrent("Before opening a project file");
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
        {!manualMode && (
          <>
            <button
              className="text-button"
              onClick={() => {
                if (!p.workflow)
                  s.change(
                    { workflow: initialWorkflow(p) },
                    "Enable storyboard",
                  );
                setModal("workflow");
              }}
            >
              Storyboard
            </button>
            <button className="text-button" onClick={() => openServices()}>
              Services
            </button>
            <button
              className="text-button"
              aria-pressed={productionMode}
              onClick={() => {
                const next = !productionMode;
                setProductionMode(next);
                setLeftHidden(false);
                setLeftView(next ? "media" : "code");
                if (next) {
                  if (!p.workflow)
                    s.change(
                      { workflow: initialWorkflow(p) },
                      "Enable production workspace",
                    );
                  setTimelineHidden(false);
                  setTimelineHeight(Math.max(timelineHeight, 300));
                }
              }}
            >
              {productionMode ? "Code workspace" : "Production workspace"}
            </button>
          </>
        )}
        <button
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          title={light ? "Switch to dark theme" : "Switch to light theme"}
          onClick={() => setLight(!light)}
        >
          {light ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button
          title="Project settings"
          aria-label="Project settings"
          onClick={() => setModal("settings")}
        >
          <Settings2 size={18} />
        </button>
        <button
          className="primary"
          title="Export"
          aria-label="Export"
          onClick={openExport}
        >
          <ArrowDownToLine size={16} />
        </button>
      </header>
      {storageSaveState === "error" && (
        <div className="recovery-banner" role="alert">
          <span>
            Workspace could not be saved. Keep a recovery copy before reloading.
            {storageSaveError && (
              <small className="save-error-reason">{storageSaveError}</small>
            )}
          </span>
          <button
            title="Retry workspace save"
            aria-label="Retry workspace save"
            onClick={() => setSaveAttempt((value) => value + 1)}
          >
            <RotateCcw size={16} />
          </button>
          <button onClick={downloadRecoveryCopy}>
            Download this workspace
          </button>
        </div>
      )}
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
        ref={workspaceRef}
        style={{
          gridTemplateColumns: `${visibleLeftWidth}px ${leftHidden ? "0" : "5"}px minmax(250px,1fr) ${rightHidden ? "0" : "5"}px ${visibleRightWidth}px`,
        }}
      >
        <aside
          className="code-panel"
          style={{ visibility: leftHidden ? "hidden" : "visible" }}
        >
          <nav className="library-tabs" aria-label="Editor tools">
            {[
              { id: "media", label: "Media", icon: Library },
              { id: "audio", label: "Audio", icon: Music },
              { id: "clips", label: "Clips", icon: Film },
              { id: "typography", label: "Typography", icon: CaseSensitive },
              { id: "script", label: "Script", icon: FileText },
              { id: "scenes", label: "Scenes", icon: Film },
              { id: "components", label: "Layouts", icon: Layers },
              { id: "code", label: "Code", icon: Code2 },
              { id: "prompts", label: "Prompts", icon: FileText },
            ]
              .filter(
                ({ id }) =>
                  !manualMode ||
                  [
                    "media",
                    "audio",
                    "code",
                    "prompts",
                    "clips",
                    "typography",
                  ].includes(id),
              )
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={
                    id === leftView ||
                    (id === "audio" && ["voice", "sound"].includes(leftView))
                      ? "active"
                      : ""
                  }
                  aria-label={label + " panel"}
                  title={label}
                  onClick={() =>
                    [
                      "media",
                      "audio",
                      "code",
                      "prompts",
                      "clips",
                      "typography",
                    ].includes(id)
                      ? selectLeftView(id)
                      : openLibraryTool(id)
                  }
                >
                  <Icon size={17} />
                </button>
              ))}
          </nav>
          {leftView === "typography" && <TypographyPanel master={masterMode} />}
          {leftView === "clips" && (
            <ClipsPanel
              onSelect={() => setMasterMode(false)}
              onEdit={() => selectLeftView("code")}
            />
          )}
          {leftView === "prompts" && (
            <PromptTemplates
              master={masterMode}
              onPaste={() => {
                selectLeftView("code");
                setPasteError("");
                setModal("paste-code");
              }}
            />
          )}
          {(leftView === "media" || leftView === "audio") && (
            <MediaLibrary
              placement={placement}
              onPlacement={setImagePlacement}
              followFrame={followFrame}
              onFollowFrame={(value) => {
                if (!value) setImagePlacement(placement);
                setFollowFrame(value);
              }}
              onFrameSize={(size) => {
                settings(size);
                setZoom(1);
              }}
              manual={manualMode}
              mode={leftView}
              master={masterMode}
              selectedAudio={selectedAudio}
              onSelectAudio={(id) => {
                setSelectedAudio(id);
                setSelectedAsset(undefined);
                setRightTab("project");
                setRightHidden(false);
              }}
              onSelectAsset={(id) => {
                setSelectedAsset(id);
                setSelectedAudio(undefined);
                setRightTab("project");
              }}
              onImportImages={() => fileRef.current?.click()}
              onUseAsset={insertLibraryAsset}
              onAttach={(id) => {
                setAttached((ids) =>
                  ids.includes(id)
                    ? ids.filter((value) => value !== id)
                    : [...ids, id],
                );
                setRightTab("assistant");
              }}
              onRemoveAsset={removeLibraryAsset}
              onTool={openLibraryTool}
              onError={setNotice}
            />
          )}
          {!manualMode &&
            (libraryToolLoaded ||
              !["media", "audio", "code"].includes(leftView)) && (
              <div
                className="library-workflow"
                hidden={["media", "audio", "code"].includes(leftView)}
              >
                <Suspense fallback={<p>Loading production tools…</p>}>
                  <Workflow
                    embedded
                    open={
                      !["media", "audio", "code"].includes(leftView) &&
                      modal !== "workflow"
                    }
                    requestedTab={libraryToolLoaded ? libraryTool : leftView}
                    onTabChange={(value) => {
                      setLibraryTool(value);
                      setLibraryToolLoaded(true);
                      setLeftView(value);
                    }}
                    masterMode={masterMode}
                    provider={provider}
                    model={model}
                    busy={busy}
                    onClose={() => selectLeftView("media")}
                    onEditScene={openSceneEditor}
                    onGenerateScene={(id) => setQueuedSceneGeneration(id)}
                    onServices={() => openServices()}
                    onMaster={changeScope}
                    onNotice={setNotice}
                  />
                </Suspense>
              </div>
            )}
          <div
            className="code-workbench"
            hidden={leftView !== "code"}
            onPasteCapture={(event) => {
              const text = event.clipboardData.getData("text/plain");
              if (
                !masterMode &&
                !sceneLocked &&
                /<!doctype\s+html|<html[\s>]/i.test(text)
              ) {
                event.preventDefault();
                event.stopPropagation();
                importDocument(text);
              }
            }}
          >
            {(leftView === "code" || editorLoaded) && (
              <>
                <div className="panel-heading">
                  <span>
                    <Code2 size={14} /> SOURCE CODE
                  </span>
                  <div>
                    <button
                      title="Paste full HTML document"
                      aria-label="Paste full HTML document"
                      disabled={masterMode || sceneLocked}
                      onClick={() => {
                        setPasteError("");
                        setModal("paste-code");
                      }}
                    >
                      <ClipboardPaste size={16} />
                    </button>
                    <button
                      title="Format document"
                      onClick={() =>
                        editorRef.current
                          ?.getAction("editor.action.formatDocument")
                          ?.run()
                      }
                    >
                      <Code2 size={16} />
                    </button>
                    <button
                      title="Collapse code panel"
                      onClick={() => setLeftHidden(true)}
                    >
                      <Columns2 size={14} />
                    </button>
                  </div>
                </div>
                {(masterMode || sceneLocked) && (
                  <div className="code-readonly-notice" role="status">
                    <span>
                      {masterMode
                        ? "Combined preview is read-only. Select a timeline to edit its code."
                        : "This timeline is locked. Unlock it to edit its code."}
                    </span>
                    <button
                      title={
                        masterMode
                          ? "Edit selected timeline"
                          : "Unlock timeline"
                      }
                      aria-label={
                        masterMode
                          ? "Edit selected timeline"
                          : "Unlock timeline"
                      }
                      onClick={() => {
                        if (masterMode) changeScope(false);
                        else {
                          const project = useStudio.getState().project;
                          if (project.workflow)
                            s.change(
                              {
                                workflow: {
                                  ...project.workflow,
                                  scenes: project.workflow.scenes.map(
                                    (scene) =>
                                      scene.id === project.workflow!.selectedId
                                        ? { ...scene, locked: false }
                                        : scene,
                                  ),
                                },
                              },
                              "Unlock scene",
                            );
                        }
                      }}
                    >
                      <Code2 size={16} />
                    </button>
                  </div>
                )}
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
                <div
                  className={"assets" + (assetsCollapsed ? " collapsed" : "")}
                >
                  <div className="panel-heading">
                    <button
                      className="assets-toggle"
                      aria-expanded={!assetsCollapsed}
                      aria-controls="editor-assets-content"
                      onClick={() =>
                        setAssetsCollapsed((collapsed) => !collapsed)
                      }
                    >
                      <ChevronDown
                        size={14}
                        style={{
                          transform: assetsCollapsed
                            ? "rotate(-90deg)"
                            : undefined,
                        }}
                      />
                      ASSETS <b>{p.assets.length}</b>
                    </button>
                    <button
                      title="Import images"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Plus size={15} />
                    </button>
                  </div>

                  <div id="editor-assets-content" hidden={assetsCollapsed}>
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
                            {!manualMode && (
                              <button
                                title="Attach image to AI prompt"
                                className={
                                  attached.includes(a.id) ? "accent" : ""
                                }
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
                            )}
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
                                  ].some((x) =>
                                    x.includes("asset://" + a.id),
                                  ) ||
                                  p.workflow?.mascot.references.includes(a.id)
                                ) {
                                  setNotice(
                                    "Remove references to this asset before deleting it.",
                                  );
                                  return;
                                }
                                s.change(
                                  {
                                    assets: p.assets.filter(
                                      (x) => x.id !== a.id,
                                    ),
                                  },
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
                </div>
              </>
            )}
          </div>
        </aside>
        <div
          className="resize-handle resize-left"
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
              <button
                aria-label="Show code panel"
                title="Show code panel"
                onClick={() => selectLeftView("code")}
              >
                <Code2 size={16} />
              </button>
            )}
            <button
              className="text-button"
              aria-label="Run preview"
              title="Run preview"
              onClick={() => {
                setRun((r) => r + 1);
                s.setTime(0);
              }}
            >
              <Play size={16} />
            </button>
            <select
              aria-label="Canvas aspect ratio"
              value={
                [
                  ["16:9", 1920, 1080],
                  ["9:16", 1080, 1920],
                  ["1:1", 1080, 1080],
                  ["4:3", 1440, 1080],
                  ["21:9", 2520, 1080],
                ].find(
                  ([, width, height]) =>
                    width === p.settings.width && height === p.settings.height,
                )?.[0] ?? ""
              }
              onChange={(e) => {
                const dimensions: Record<string, [number, number]> = {
                  "16:9": [1920, 1080],
                  "9:16": [1080, 1920],
                  "1:1": [1080, 1080],
                  "4:3": [1440, 1080],
                  "21:9": [2520, 1080],
                };
                const size = dimensions[e.target.value];
                if (size) {
                  settings({ width: size[0], height: size[1] });
                  setZoom(1);
                }
              }}
            >
              <option value="">
                {p.settings.width} × {p.settings.height}
              </option>
              {["16:9", "9:16", "1:1", "4:3", "21:9"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
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
          <div
            className="preview-shell"
            ref={fullscreenRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const id = e.dataTransfer.getData(
                "application/x-framescript-asset",
              );
              if (id) {
                e.preventDefault();
                e.stopPropagation();
                insertLibraryAsset(id);
              }
            }}
          >
            <Preview
              textEditing={!masterMode}
              projectOverride={viewProject}
              run={run}
              select={select}
              onSelect={handleSelect}
              onReady={handleReady}
              onVisual={handleVisual}
              zoom={zoom}
            />
            <div className="zoom-controls">
              <button
                title="Zoom out"
                onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
              >
                <ZoomOut size={14} />
              </button>
              <button
                aria-label="Fit preview"
                title="Fit preview"
                onClick={() => setZoom(1)}
              >
                <Maximize2 size={14} />
              </button>
              <button
                title="Zoom in"
                onClick={() => setZoom(Math.min(4, zoom + 0.1))}
              >
                <ZoomIn size={14} />
              </button>
            </div>
            <div className="fullscreen-controls">
              <PlayerTransport masterMode={masterMode} fullscreen />
            </div>
          </div>
          <PlayerTransport masterMode={masterMode} />
          {s.error && (
            <div className="preview-error" role="alert">
              <span>
                {s.errorLocation
                  ? `JavaScript · line ${s.errorLocation.line}, column ${s.errorLocation.column}: `
                  : "Preview error: "}
                {s.error}
              </span>
              {s.errorLocation && !masterMode && (
                <button
                  title="Jump to error"
                  aria-label="Jump to error"
                  onClick={() => {
                    const location = s.errorLocation!;
                    jumpLine.current = location;
                    setLeftView("code");
                    setLeftHidden(false);
                    setTab("js");
                    const model = editorRef.current?.getModel();
                    if (tab === "js" && model) {
                      editorRef.current.setPosition({
                        lineNumber: location.line,
                        column: location.column,
                      });
                      editorRef.current.revealLineInCenter(location.line);
                      editorRef.current.focus();
                      jumpLine.current = null;
                    }
                  }}
                >
                  <Code2 size={16} />
                </button>
              )}
              {!manualMode && (
                <button onClick={() => void ask(true)}>Fix with AI</button>
              )}
            </div>
          )}
        </main>
        <div
          className="resize-handle resize-right"
          onPointerDown={(e) => resize("right", e)}
        />
        <aside
          className="assistant-panel"
          style={{ visibility: rightHidden ? "hidden" : "visible" }}
        >
          <div className="right-tabs">
            <button
              className={rightTab === "project" ? "active" : ""}
              aria-label="Project"
              title="Project"
              onClick={() => {
                setRightTab("project");
                setSelectedAudio(undefined);
                setSelectedAsset(undefined);
              }}
            >
              <Film size={16} />
            </button>
            {!manualMode && (
              <button
                className={rightTab === "assistant" ? "active" : ""}
                onClick={() => setRightTab("assistant")}
              >
                <Sparkles size={14} /> Assistant
              </button>
            )}
            <button
              className={rightTab === "properties" ? "active" : ""}
              aria-label="Properties"
              title="Properties"
              onClick={() => setRightTab("properties")}
            >
              <Settings2 size={16} />
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
          {rightTab === "project" ? (
            <ProjectInspector
              manual={manualMode}
              audioId={selectedAudio}
              assetId={selectedAsset}
              onSettings={() => setModal("settings")}
              onVoice={() => openLibraryTool("voice")}
            >
              {!manualMode && p.workflow && (
                <SceneInspector
                  onEditCode={openSceneEditor}
                  busy={busy}
                  onGenerate={() => {
                    if (masterMode) {
                      changeScope(false);
                      setQueuedSceneGeneration(p.workflow!.selectedId);
                    } else void ask(false, sceneGenerationPrompt);
                  }}
                  onOpen={(tab) => {
                    openLibraryTool(tab);
                  }}
                />
              )}
            </ProjectInspector>
          ) : rightTab === "assistant" ? (
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
                  <option value="gemini">Gemini · free tier available</option>
                  <option value="ollama">Ollama · local / free</option>
                  <option value="openai">OpenAI API</option>
                </select>
                <button title="Refresh models" onClick={refreshModels}>
                  <RotateCcw size={13} />
                </button>
                <button
                  className="chatgpt-connection"
                  title="Manage services"
                  aria-label="Manage services"
                  onClick={() => openServices()}
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
                </button>
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
              {provider === "gemini" && (
                <p>
                  Uses your Google AI Studio key from Services. Free-tier limits
                  depend on the model and Google project; billing-enabled
                  projects may incur charges.{" "}
                  <button onClick={() => openServices()}>Connect Gemini</button>
                </p>
              )}
              {(providerError || (provider === "openai" && !hasKey)) && (
                <div className="provider-error" role="alert">
                  <p>
                    {providerError ||
                      "OpenAI API is not connected. Add an API key in Services, or choose ChatGPT · account to sign in without one."}
                  </p>
                  <button
                    disabled={
                      provider === "chatgpt" && (connecting || chatgpt.pending)
                    }
                    onClick={() =>
                      provider === "chatgpt"
                        ? void connectChatGPT()
                        : openServices()
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
        <Timeline
          onSelectText={(sceneId, textId) => {
            const state = useStudio.getState();
            if (sceneId && state.project.workflow?.selectedId !== sceneId)
              state.change(
                activateScene(state.project, sceneId),
                "Select text scene",
              );
            setMasterMode(false);
            state.setSelectedText(textId);
            selectLeftView("typography");
          }}
          selectedAudio={selectedAudio}
          onSelectAudio={(id) => {
            setSelectedAudio(id);
            setSelectedAsset(undefined);
            setRightTab("project");
            setRightHidden(false);
          }}
          onSelectScene={(id) => {
            s.change(
              activateScene(useStudio.getState().project, id),
              "Select scene",
            );
            setSelectedAudio(undefined);
            setSelectedAsset(undefined);
            setRightTab("project");
          }}
          navigation={
            manualMode ? (
              <ManualTimelines master={masterMode} onMaster={changeScope} />
            ) : (
              <SceneRail
                manual={manualMode}
                master={masterMode}
                onMaster={changeScope}
                busy={busy}
                onEdit={() => {
                  setSelectedAudio(undefined);
                  setSelectedAsset(undefined);
                  setRightTab("project");
                }}
              />
            )
          }
          masterMode={masterMode}
          timelineHidden={timelineHidden}
          timelineHeight={Math.min(
            timelineHeight,
            Math.max(160, workspaceSize.height - 246),
          )}
          setTimelineHidden={setTimelineHidden}
          runtime={runtime}
        />
      </div>
      <footer className="status-bar">
        <span className="live-dot" />
        <span role="status">{notice}</span>
        <span className="toolbar-spacer" />
        <span aria-label="Workspace save status">
          {storageSaveState === "saved"
            ? "Workspace saved locally"
            : storageSaveState === "error"
              ? "Workspace save failed"
              : "Saving workspace…"}
        </span>
        <span>LOCAL WEB APP</span>
        <span>UTF-8</span>
        <span>{p.settings.fps} FPS</span>
        <button
          aria-label="Project settings"
          title="Project settings"
          onClick={() => setModal("settings")}
        >
          <Settings2 size={15} />
        </button>
      </footer>
      <AudioPlayback project={p} master={masterMode} onError={setNotice} />
      {pendingAI && (
        <SceneReview
          before={pendingAI.before}
          after={pendingAI.after}
          explanation={pendingAI.explanation}
          onDiscard={() => {
            setPendingAI(null);
            setNotice("AI changes discarded");
          }}
          onApply={() => {
            if (useStudio.getState().revision !== pendingAI.revision) {
              setNotice(
                "Project changed since generation. Discard this proposal and generate again.",
              );
              return;
            }
            s.change(pendingAI.after, "AI · " + pendingAI.explanation);
            setChat((messages) => [
              ...messages,
              {
                role: "assistant",
                content: pendingAI.explanation,
                applied: true,
              },
            ]);
            setPendingAI(null);
            setNotice("AI changes applied · Undo available");
          }}
        />
      )}
      <RecoveryHistory
        open={modal === "recovery-history"}
        onClose={() => setModal("")}
        onRestore={(project, editor) => {
          load(project);
          sceneChats.current = editor.sceneChats ?? {};
          chatScene.current = project.workflow?.selectedId ?? "project";
          setChat(sceneChats.current[chatScene.current] ?? []);
          setNotice("Recovery version restored");
        }}
      />
      {modal === "services" && (
        <Suspense fallback={<div role="status">Loading services…</div>}>
          <Services
            open={modal === "services"}
            onClose={() => setModal(servicesReturn)}
            busy={busy}
            chatgpt={chatgpt}
            connecting={connecting}
            authError={providerError}
            onConnect={async (fresh, remember) => {
              setProvider("chatgpt");
              await connectChatGPT(fresh, remember);
            }}
            onChanged={async () => {
              setHasKey(await bridge.call("hasKey"));
              setChatgpt(await bridge.call("chatgptStatus"));
            }}
          />
        </Suspense>
      )}
      {(workflowLoaded || modal === "workflow") && (
        <Suspense fallback={<div role="status">Loading workflow…</div>}>
          <Workflow
            masterMode={masterMode}
            onGenerateScene={(id) => setQueuedSceneGeneration(id)}
            requestedTab={workflowTab}
            onEditScene={openSceneEditor}
            onServices={() => openServices("workflow")}
            open={modal === "workflow"}
            onClose={() => setModal("")}
            provider={provider}
            model={model}
            busy={busy}
            onMaster={changeScope}
            onNotice={setNotice}
          />
        </Suspense>
      )}
      <Modal
        title="Paste full HTML document"
        open={modal === "paste-code"}
        onClose={() => setModal("")}
      >
        <p>
          Paste a complete HTML document. Inline styles and scripts move to the
          CSS and JavaScript tabs. This replaces the active timeline's code;
          Undo restores it.
        </p>
        <textarea
          className="paste-document"
          aria-label="HTML document to import"
          value={pasteDocument}
          onChange={(event) => setPasteDocument(event.target.value)}
          spellCheck={false}
        />
        {pasteError && (
          <p className="paste-error" role="alert">
            {pasteError}
          </p>
        )}
        <div className="modal-actions">
          <button onClick={() => setModal("")}>Cancel</button>
          <button
            className="primary"
            aria-label="Apply pasted document"
            title="Apply pasted document"
            disabled={masterMode || sceneLocked}
            onClick={() => importDocument(pasteDocument)}
          >
            <Check size={17} />
          </button>
        </div>
      </Modal>
      <Modal
        title="Project & application settings"
        open={modal === "settings"}
        onClose={() => setModal("")}
      >
        <div className="settings-section">
          <h3>Brand kit</h3>
          {!manualMode && (
            <Field label="Review AI changes before applying">
              <input
                type="checkbox"
                checked={reviewAI}
                onChange={(e) => setReviewAI(e.target.checked)}
              />
            </Field>
          )}
          <p>Saved with this project.</p>
          <div className="settings-grid">
            {(
              ["name", "font", "primary", "secondary", "background"] as const
            ).map((key) => {
              const brand = p.brand ?? {
                name: "My brand",
                font: "Segoe UI",
                primary: "#67b4ff",
                secondary: "#edf3fa",
                background: "#101321",
              };
              return (
                <Field key={key} label={`Brand ${key}`}>
                  <input
                    type={key === "name" || key === "font" ? "text" : "color"}
                    value={brand[key]}
                    onChange={(e) =>
                      s.change(
                        { brand: { ...brand, [key]: e.target.value } },
                        "Edit brand kit",
                      )
                    }
                  />
                </Field>
              );
            })}
          </div>
        </div>
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
          {!manualMode && (
            <>
              <h3>Services</h3>
              <p>
                Manage accounts, API keys, connection status and usage in one
                place.
              </p>
              <button onClick={() => openServices("settings")}>
                Manage services
              </button>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={() => setModal("recovery-history")}>
            Recovery history
          </button>
          <button onClick={downloadRecoveryCopy}>Download recovery copy</button>
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
                await checkpointCurrent("Before moving project to trash");
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
        title="Export animation"
        open={modal === "export"}
        headerAction={
          exporting ? (
            <button
              className="modal-window-action"
              aria-label="Minimize export"
              title="Minimize export"
              onClick={() => setModal("")}
            >
              <Minus size={18} />
            </button>
          ) : undefined
        }
        onClose={() => setModal("")}
      >
        {exportOptions && (
          <>
            <div className="export-save-controls">
              <label className="field">
                <span>File name</span>
                <input
                  aria-label="Export file name"
                  maxLength={150}
                  disabled={exporting || !!selectedExport}
                  value={exportOptions.fileName ?? p.name}
                  onChange={(event) =>
                    setExportOptions({
                      ...exportOptions,
                      fileName: event.target.value,
                    })
                  }
                />
              </label>
              <label className="prompt-check">
                <input
                  type="checkbox"
                  aria-label="Choose where to save export"
                  disabled={
                    exporting || !!selectedExport || !supportsExportPicker()
                  }
                  checked={chooseExportLocation}
                  onChange={(event) =>
                    setChooseExportLocation(event.target.checked)
                  }
                />{" "}
                Choose where to save
              </label>
              <small>
                {supportsExportPicker()
                  ? "Choose a folder and filename before rendering, or use your browser’s download location."
                  : "This browser saves through Downloads. Enable “Ask where to save” in browser settings to choose a folder."}
              </small>
            </div>
            <ExportSettings
              options={exportOptions}
              frame={p.settings}
              disabled={exporting || !!selectedExport}
              onChange={setExportOptions}
            />
            <p className="muted">
              {masterMode ? "All timelines" : "Active timeline"} · Output
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
            {exportError && (
              <p
                role="alert"
                className="export-error"
                style={{ overflowWrap: "anywhere" }}
              >
                Export failed: {exportError}
              </p>
            )}
            {progress && !exportError && (
              <div className="export-progress">
                <progress max={progress.total} value={progress.done} />
                <p>
                  {progress.stage} · {progress.done} / {progress.total} frames ·{" "}
                  {Math.round((progress.done / progress.total) * 100)}%
                </p>
                <small>
                  {exportOptions.fileName || p.name}.
                  {exportOptions.format === "sequence"
                    ? "zip"
                    : exportOptions.format}
                </small>
              </div>
            )}
            <div className="modal-actions">
              {exporting ? (
                <>
                  <button
                    onClick={() =>
                      selectedExportId && exports.cancel(selectedExportId)
                    }
                  >
                    Cancel export
                  </button>
                </>
              ) : (
                <button
                  className="primary"
                  onClick={() =>
                    selectedExport ? openExport() : void startExport()
                  }
                >
                  <ArrowDownToLine size={15} />{" "}
                  {selectedExport
                    ? "Export current timeline"
                    : chooseExportLocation
                      ? "Render & save"
                      : "Render & download"}
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
      {exportDock}
    </div>
  );
}
