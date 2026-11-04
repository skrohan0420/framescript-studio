import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense,
} from "react";
import Editor, { LazyChangesEditor } from "./LazyEditor";
import type { CodeSnapshot } from "../shared/rpc";
import type { editor as Monaco } from "monaco-editor";
import { PromptTemplates } from "./PromptTemplates";
import { PromptDrawer } from "./PromptDrawer";
import { readEditorTabs, saveEditorTabs } from "./editor-tabs";
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
  Palette,
  Braces,
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
  Ellipsis,
  GitCompare,
  Minus,
  MousePointer2,
  Moon,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Send,
  Settings2,
  Sparkles,
  Square,
  SquareTerminal,
  Search,
  Replace,
  ListEnd,
  Command,
  WrapText,
  Sun,
  Undo2,
  UserRound,
  X,
  TriangleAlert,
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
import { Timeline, type TimelineActions } from "./Timeline";
import { StructuredEditPanel } from "./StructuredEditPanel";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import {
  formatShortcut,
  keyboardChord,
  previewShortcutIds,
  readShortcutOverrides,
  shortcutBinding,
  shortcutIds,
  shortcuts,
  type ShortcutId,
  type ShortcutOverrides,
} from "./shortcuts";
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
import { CodeHistory } from "./CodeHistory";
import { PreviewConsole } from "./PreviewConsole";
import { TerminalPanel } from "./TerminalPanel";
import type { PreviewConsoleEntry } from "./preview-document";
import {
  CodeProblems,
  useCodeSyntax,
  type ProblemLanguage,
} from "./CodeProblems";
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
  const [shortcutOverrides, setShortcutOverrides] = useState<ShortcutOverrides>(
    {},
  );
  const timelineActions = useRef<TimelineActions>(null);
  const [structuredEditClip, setStructuredEditClip] = useState<string>();
  const shortcutHandler = useRef<
    (event: KeyboardEvent, capture: boolean) => void
  >(() => {});
  const iframeShortcut = useRef<
    (chord: string, repeat: boolean, text: boolean) => void
  >(() => {});
  const handlePreviewShortcut = useCallback(
    (chord: string, repeat: boolean) =>
      iframeShortcut.current(chord, repeat, false),
    [],
  );
  const handleTextShortcut = useCallback(
    (key: string) =>
      iframeShortcut.current(
        key.toLowerCase() === "w" ? "KeyW" : key,
        false,
        true,
      ),
    [],
  );
  const bindings = useMemo(() => {
    const map = new Map<string, ShortcutId>();
    for (const id of shortcutIds) {
      const key = shortcutBinding(id, shortcutOverrides);
      if (key) map.set(key, id);
    }
    if (shortcutOverrides.deleteText === undefined && !map.has("Backspace"))
      map.set("Backspace", "deleteText");
    return map;
  }, [shortcutOverrides]);
  const previewKeys = useMemo(
    () =>
      [...bindings]
        .filter(([, action]) => previewShortcutIds.has(action))
        .map(([key]) => key),
    [bindings],
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
  const [promptsOpen, setPromptsOpen] = useState(false);
  const [previewRulers, setPreviewRulers] = useState(() => {
    try {
      return localStorage.getItem("framescript.preview-rulers.v1") !== "false";
    } catch {
      return true;
    }
  });
  const [previewQuality, setPreviewQuality] = useState<
    "auto" | "1080" | "full"
  >(() => {
    try {
      const saved = localStorage.getItem("framescript.preview-quality.v1");
      return saved === "1080" || saved === "full" ? saved : "auto";
    } catch {
      return "auto";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("framescript.preview-quality.v1", previewQuality);
    } catch {}
  }, [previewQuality]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "framescript.preview-rulers.v1",
        String(previewRulers),
      );
    } catch {}
  }, [previewRulers]);
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
  const [assetsCollapsed, setAssetsCollapsed] = useState(true);
  const [compactInspector, setCompactInspector] = useState(false);
  const [exportStorage, setExportStorage] = useState<{
    files: number;
    bytes: number;
    retentionDays: number;
  } | null>(null);
  const [pasteDocument, setPasteDocument] = useState("");
  const [pasteError, setPasteError] = useState("");
  const jumpLine = useRef<{
    language: ProblemLanguage;
    line: number;
    column: number;
  } | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalId] = useState(() => crypto.randomUUID());
  const terminalUsed = useRef(false);
  useEffect(() => {
    const closeTerminal = () => {
      if (!terminalUsed.current) return;
      void fetch("/api/terminalStop", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "Content-Type": "application/json", "X-FrameScript": "1" },
        body: JSON.stringify({ args: [terminalId, true] }),
      }).catch(() => {});
    };
    window.addEventListener("pagehide", closeTerminal);
    return () => window.removeEventListener("pagehide", closeTerminal);
  }, [terminalId]);
  const [outputHeight, setOutputHeight] = useState(170);
  const outputDrag = useRef<{ y: number; height: number; max: number } | null>(
    null,
  );
  const [consoleEntries, setConsoleEntries] = useState<PreviewConsoleEntry[]>(
    [],
  );
  const consoleCommandRef = useRef<((command: string) => void) | null>(null);
  const appendConsole = useCallback((entries: PreviewConsoleEntry[]) => {
    setConsoleEntries((previous) => [...previous, ...entries].slice(-300));
  }, []);
  useEffect(() => setConsoleEntries([]), [s.session]);
  const [reviewAI, setReviewAI] = useState(false);
  const [pendingAI, setPendingAI] = useState<{
    before: Project;
    after: Project;
    revision: number;
    explanation: string;
  } | null>(null);
  const playbackDuration = masterMode ? totalDuration(p) : p.settings.duration;
  const sceneLocked = !!selectedScene(p)?.locked;
  const changeScope = (master: boolean) => {
    setMasterMode(master);
    s.setTime(0);
    s.setPlaying(false);
    setSelect(false);
  };
  const [tab, setTab] = useState<Tab>(() => {
      const saved = readEditorTabs().codeTab;
      return ["all", "html", "css", "js", "split"].includes(saved ?? "")
        ? (saved as Tab)
        : "html";
    }),
    [combinedDraft, setCombinedDraft] = useState(""),
    [parseError, setParseError] = useState("");
  const combinedEditRevision = useRef<number | null>(null);
  const syntax = useCodeSyntax(
    p,
    !showHome,
    tab === "all" ? combinedDraft : undefined,
  );
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
  const [editorExpanded, setEditorExpanded] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const [appliedCode, setAppliedCode] = useState<{
    session: number;
    project: Project;
  } | null>(null);
  const [savedCode, setSavedCode] = useState<{
    session: number;
    project: Project;
  } | null>(null);
  const executionProject = useMemo(() => {
    if (autosave || appliedCode?.session !== s.session) return p;
    const saved = appliedCode.project;
    const savedScenes = new Map(
      saved.workflow?.scenes.map((scene) => [scene.id, scene]),
    );
    const empty: CodeSnapshot = { html: "", css: "", js: "" };
    const source = (id?: string): CodeSnapshot => {
      const code = id
        ? (savedScenes.get(id) ??
          (!saved.workflow && id === p.workflow?.scenes[0]?.id ? saved : empty))
        : saved;
      return { html: code.html, css: code.css, js: code.js };
    };
    return {
      ...p,
      ...source(p.workflow?.selectedId),
      workflow: p.workflow && {
        ...p.workflow,
        scenes: p.workflow.scenes.map((scene) => ({
          ...scene,
          ...source(scene.id),
        })),
      },
    };
  }, [autosave, appliedCode, s.session, p]);
  const viewProject = useMemo(
    () => (masterMode ? composeProject(executionProject) : executionProject),
    [masterMode, executionProject],
  );
  const previewLocation =
    !masterMode && s.errorCode === p.js ? s.errorLocation : undefined;
  const problemCount =
    syntax.problems.length + Number(!!parseError) + Number(!!s.error);
  const hasProblems = problemCount > 0;
  useEffect(() => setShowProblems(hasProblems), [hasProblems]);
  const codeUnsaved = useMemo(() => {
    if (parseError) return true;
    if (savedCode?.session !== s.session) return false;
    const differs = (code: CodeSnapshot, saved?: CodeSnapshot) =>
      !saved ||
      code.html !== saved.html ||
      code.css !== saved.css ||
      code.js !== saved.js;
    const saved = savedCode.project;
    if (!p.workflow) return differs(p, saved);
    const savedScenes = new Map(
      saved.workflow?.scenes.map((scene) => [scene.id, scene]),
    );
    return p.workflow.scenes.some((scene) =>
      differs(scene, savedScenes.get(scene.id)),
    );
  }, [parseError, p, s.session, savedCode]);
  const [expandedWrap, setExpandedWrap] = useState(false);
  const [compactWrap, setCompactWrap] = useState(true);
  const [formatError, setFormatError] = useState("");
  const [changes, setChanges] = useState<{
    session: number;
    scene: string | null;
    code?: CodeSnapshot;
  } | null>(null);
  const [codeBaseline, setCodeBaseline] = useState<{
    anchor: typeof appliedCode;
    scene: string | null;
    code: CodeSnapshot;
  } | null>(null);
  const expandEditorRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<Monaco.IStandaloneCodeEditor | null>(null),
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
  const workspaceSavedRevision = useRef<number | null>(null);
  useEffect(() => {
    const current = useStudio.getState();
    setSavedCode({ session: current.session, project: current.project });
  }, [s.session]);
  useEffect(() => {
    const current = useStudio.getState();
    setAppliedCode({ session: current.session, project: current.project });
  }, [autosave, s.session]);
  useEffect(() => {
    void act(async () => {
      const layout = await bridge.call("settingsGet");
      setShortcutOverrides(readShortcutOverrides(layout.shortcuts));
      const rememberedTabs = readEditorTabs();
      const savedLeftView = rememberedTabs.leftView ?? layout.leftView;
      const savedRightTab = rememberedTabs.rightTab ?? layout.rightTab;
      if (layout.leftWidth) setLeftWidth(layout.leftWidth);
      if (layout.rightWidth) setRightWidth(layout.rightWidth);
      if (layout.fontSize) setFontSize(layout.fontSize);
      setAutosave(layout.autosave !== false);
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
        savedLeftView &&
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
        ].includes(savedLeftView) &&
        (!manualMode ||
          ["media", "audio", "code", "clips", "typography"].includes(
            savedLeftView,
          ))
      ) {
        setLeftView(savedLeftView);
        setProductionMode(savedLeftView !== "code");
        if (!["media", "audio", "code"].includes(savedLeftView)) {
          setLibraryTool(savedLeftView);
          setLibraryToolLoaded(true);
        }
      }
      if (layout.layoutVersion !== 2) {
        setLeftHidden(false);
        setTimelineHeight(320);
      }
      if (
        ["project", "assistant", "properties", "history"].includes(
          savedRightTab,
        )
      )
        setRightTab(savedRightTab);
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
        setProductionMode(false);
        setLeftHidden(false);
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
    saveEditorTabs(leftView, rightTab, tab);
  }, [storageReady, leftView, rightTab, tab]);
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
            autosave,
            shortcuts: shortcutOverrides,
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
    autosave,
    shortcutOverrides,
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
    if (!storageReady || !autosave) return;
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
              if (useStudio.getState().session === s.session)
                setSavedCode({ session: s.session, project: p });
              workspaceSavedRevision.current = s.revision;
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
  }, [s.revision, storageReady, chat, saveAttempt, autosave]);
  const manualUnsaved =
    !autosave && s.dirty && workspaceSavedRevision.current !== s.revision;
  useEffect(() => {
    if (!manualUnsaved && !parseError) return;
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [manualUnsaved, parseError]);
  const save = useCallback(
    (as = false) =>
      void act(async () => {
        if (parseError) throw Error("Fix the combined document before saving.");
        const submitted = useStudio.getState();
        const result = as
          ? await bridge.call("saveAs", submitted.project)
          : await bridge.call("projectSave", submitted.project);
        if (result && useStudio.getState().session === submitted.session) {
          setAppliedCode({
            session: submitted.session,
            project: submitted.project,
          });
          setSavedCode({
            session: submitted.session,
            project: submitted.project,
          });
          useStudio.getState().saved(submitted.revision);
          setStorageSaveState("saved");
          setNotice(
            as ? "Saved · " + result : "Code saved and applied locally",
          );
        }
      }),
    [act, parseError],
  );
  useEffect(() => {
    const capture = (event: KeyboardEvent) =>
      shortcutHandler.current(event, true);
    const bubble = (event: KeyboardEvent) =>
      shortcutHandler.current(event, false);
    window.addEventListener("keydown", capture, true);
    window.addEventListener("keydown", bubble);
    return () => {
      window.removeEventListener("keydown", capture, true);
      window.removeEventListener("keydown", bubble);
    };
  }, []);
  useEffect(() => {
    if (!editorExpanded || showHome || leftView !== "code" || modal) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || event.isComposing) return;
      const widgets = document.querySelectorAll(
        '[role="dialog"]:not([aria-hidden="true"]), [role="alertdialog"], .quick-input-widget, .monaco-menu-container, .code-workbench-expanded .suggest-widget.visible, .code-workbench-expanded .parameter-hints-widget.visible, .code-editor-menu:popover-open',
      );
      if (
        [...widgets].some((widget) =>
          widget.checkVisibility({ visibilityProperty: true }),
        )
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setEditorExpanded(false);
      expandEditorRef.current?.focus();
    };
    // Monaco can consume Escape before it bubbles, even for a plain selection.
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [editorExpanded, showHome, leftView, modal]);
  useEffect(() => {
    if (
      tab === "all" &&
      !parseError &&
      combinedEditRevision.current !== s.revision
    )
      setCombinedDraft(combined(p));
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
      combinedEditRevision.current = useStudio.getState().revision;
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
    const editor = {
      sceneChats: { ...sceneChats.current, [chatScene.current]: chat },
    };
    if (autosave) {
      await bridge.call("autosave", state.project, editor);
      await bridge.call("checkpoint", reason);
    } else {
      await bridge.call("checkpoint", reason, state.project, editor);
    }
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
    const session = useStudio.getState().session;
    let imported = 0;
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
      if (state.session !== session)
        throw Error(
          "Project changed during image import. Import the images again in the intended project.",
        );
      const id = crypto.randomUUID();
      state.change(
        {
          assets: [...state.project.assets, { id, name: file.name, data }],
        },
        "Import asset",
      );
      if (!useStudio.getState().project.assets.some((asset) => asset.id === id))
        throw Error(
          useStudio.getState().error || "Image could not be imported.",
        );
      imported++;
      setAssetsCollapsed(false);
      setSelectedAsset(id);
      setSelectedAudio(undefined);
      setRightTab("project");
    }
    if (imported) setNotice("Assets imported");
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
      quality: 18,
      captureMode: "lossless",
      graphics: "auto",
      acceleration: "auto",
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
  const revealCodeLocation = (
    instance: Monaco.IStandaloneCodeEditor,
    location: { line: number; column: number },
  ) => {
    instance.setPosition({
      lineNumber: location.line,
      column: location.column,
    });
    instance.revealLineInCenter(
      instance.getPosition()?.lineNumber ?? location.line,
    );
    instance.focus();
  };
  const jumpToProblem = (
    language: ProblemLanguage,
    location: { line: number; column: number },
  ) => {
    if (tab === "all" && parseError && language !== "all") {
      setFormatError(
        "Fix or discard the combined edits before jumping to a language tab.",
      );
      return;
    }
    setLeftView("code");
    setLeftHidden(false);
    if (tab === language && editorRef.current?.getModel()) {
      revealCodeLocation(editorRef.current, location);
    } else {
      jumpLine.current = { language, ...location };
      setTab(language);
    }
  };
  const trackEditor = (
    instance: Monaco.IStandaloneCodeEditor,
    language?: ProblemLanguage | "all",
  ) => {
    editorRef.current = instance;
    instance.onDidFocusEditorWidget(() => {
      editorRef.current = instance;
    });
    instance.onDidDispose(() => {
      if (editorRef.current === instance) editorRef.current = null;
    });
    if (jumpLine.current && jumpLine.current.language === language) {
      revealCodeLocation(instance, jumpLine.current);
      jumpLine.current = null;
    }
  };
  const runEditorAction = (id: string) => {
    const instance = editorRef.current;
    instance?.focus();
    void instance?.getAction(id)?.run();
  };
  const formatSelectedJson = async () => {
    const instance = editorRef.current;
    const model = instance?.getModel();
    const selection = instance?.getSelection();
    if (!instance || !model || !selection || selection.isEmpty()) {
      setFormatError("Select the JSON you want to format first.");
      return;
    }
    const source = model.getValueInRange(selection);
    const version = model.getVersionId();
    try {
      JSON.parse(source);
    } catch {
      setFormatError("The selection isn’t valid JSON.");
      return;
    }
    try {
      const [{ format }, { default: babel }, { default: estree }] =
        await Promise.all([
          import("prettier/standalone"),
          import("prettier/plugins/babel"),
          import("prettier/plugins/estree"),
        ]);
      const formatted = (
        await format(source, { parser: "json", plugins: [babel, estree] })
      )
        .trimEnd()
        .replace(/<(?=\/script\b)/gi, "\\u003c");
      if (
        editorRef.current !== instance ||
        instance.getModel() !== model ||
        instance.getRawOptions().readOnly ||
        model.getVersionId() !== version
      )
        return;
      instance.pushUndoStop();
      instance.executeEdits("format-json", [
        { range: selection, text: formatted },
      ]);
      instance.pushUndoStop();
      instance.focus();
    } catch {
      setFormatError("Couldn’t format the selected JSON.");
    }
  };
  const editorDisplay = {
    minimap: { enabled: editorExpanded && tab !== "split" },
    wordWrap: ((editorExpanded ? expandedWrap : compactWrap) ? "on" : "off") as
      "on" | "off",
  };
  const codeScene = p.workflow?.selectedId ?? null;
  useEffect(() => {
    if (!storageReady) return;
    let active = true;
    void bridge
      .call("codeBaseline", codeScene)
      .then((code) => {
        if (active && code)
          setCodeBaseline({ anchor: appliedCode, scene: codeScene, code });
      })
      .catch(() => {
        // The opened code is also a baseline for unsaved projects.
      });
    return () => {
      active = false;
    };
  }, [storageReady, s.session, codeScene, appliedCode]);
  const gutterProject =
    appliedCode?.session === s.session ? appliedCode.project : undefined;
  const gutterCode = codeScene
    ? (gutterProject?.workflow?.scenes.find(
        (scene) => scene.id === codeScene,
      ) ??
      (!gutterProject?.workflow && codeScene === p.workflow?.scenes[0]?.id
        ? gutterProject
        : undefined))
    : gutterProject;
  const workingBase =
    codeBaseline?.anchor === appliedCode && codeBaseline.scene === codeScene
      ? codeBaseline.code
      : (gutterCode ?? { html: "", css: "", js: "" });
  const showChanges =
    changes?.session === s.session && changes.scene === codeScene;
  const changesBase = showChanges ? (changes.code ?? workingBase) : null;
  const renderChanges = (
    language: "html" | "css" | "js" | "all",
    original: string,
    modified: string,
    onChange: (value: string) => void,
    height = "100%",
  ) => (
    <LazyChangesEditor
      key={language}
      height={height}
      language={
        language === "js"
          ? "javascript"
          : language === "all"
            ? "html"
            : language
      }
      original={original}
      modified={modified}
      modifiedModelPath={(codeScene ?? "project") + "/" + language}
      keepCurrentModifiedModel
      theme={light ? "framescript-light" : "framescript-dark"}
      onMount={(diff) => trackEditor(diff.getModifiedEditor(), language)}
      onChange={onChange}
      options={{
        ...editorDisplay,
        fontSize,
        automaticLayout: true,
        renderSideBySide: false,
        ignoreTrimWhitespace: false,
        readOnly: masterMode || sceneLocked,
        originalEditable: false,
      }}
    />
  );
  const editor = (language: "html" | "css" | "js", height = "100%") =>
    changesBase ? (
      renderChanges(
        language,
        changesBase[language],
        p[language],
        (value) => s.change({ [language]: value }),
        height,
      )
    ) : (
      <Editor
        key={language}
        height={height}
        language={language === "js" ? "javascript" : language}
        path={(p.workflow?.selectedId ?? "project") + "/" + language}
        keepCurrentModel
        theme={light ? "framescript-light" : "framescript-dark"}
        value={p[language]}
        gutterBaseline={
          masterMode || !gutterProject ? undefined : workingBase[language]
        }
        onMount={(e) => trackEditor(e, language)}
        onChange={(v) => s.change({ [language]: v ?? "" })}
        options={{
          fontSize,
          readOnly: masterMode || sceneLocked,
          fontFamily: "'Cascadia Code', Consolas, monospace",
          lineHeight: Math.round(fontSize * 1.57),
          ...editorDisplay,
          padding: { top: 18 },
          scrollBeyondLastLine: false,
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
    if (view === "prompts") {
      setPromptsOpen((value) => !value);
      return;
    }
    setPromptsOpen(false);
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
  const openProject = () =>
    void act(async () => {
      if (
        s.dirty &&
        !confirm("Open another project and replace unsaved changes?")
      )
        return;
      await checkpointCurrent("Before opening a project file");
      const project = await bridge.call("open");
      if (project) load(project);
    });
  const returnHome = () =>
    void act(async () => {
      if (parseError) throw Error("Fix the combined document before saving.");
      useStudio.getState().setPlaying(false);
      await checkpointCurrent("Return to project home");
      const submitted = useStudio.getState();
      await bridge.call("projectSave", submitted.project, {
        thumbnail: runtime?.thumbnail,
      });
      useStudio.getState().saved(submitted.revision);
      setAppliedCode({
        session: submitted.session,
        project: submitted.project,
      });
      setSavedCode({ session: submitted.session, project: submitted.project });
      window.location.hash = "home";
      setShowHome(true);
    });
  const runPreview = () => {
    setRun((value) => value + 1);
    s.setTime(0);
  };
  const toggleFullscreen = () => {
    const target = fullscreenRef.current;
    const request = document.fullscreenElement
      ? document.exitFullscreen()
      : target?.requestFullscreen();
    void request?.catch((error: Error) => setNotice(error.message));
  };
  const stepFrame = (direction: number) => {
    const state = useStudio.getState();
    state.setPlaying(false);
    state.setTime(
      Math.max(
        0,
        Math.min(playbackDuration, state.time + direction / p.settings.fps),
      ),
    );
  };
  const showCodeTab = (next: Tab) => {
    selectLeftView("code");
    changeTab(next);
  };
  const toggleEditor = () => {
    if (!editorExpanded) {
      selectLeftView("code");
      setCompactInspector(false);
    }
    setEditorExpanded((value) => !value);
  };
  const toggleProblems = () => {
    setShowProblems(showTerminal || showConsole || !showProblems);
    setShowConsole(false);
    setShowTerminal(false);
  };
  const toggleConsole = () => {
    setShowTerminal(false);
    setShowConsole((visible) => !visible);
  };
  const openTerminal = () => {
    terminalUsed.current = true;
    setShowConsole(false);
    setShowTerminal(true);
  };
  const toggleTerminal = () => {
    if (showTerminal) setShowTerminal(false);
    else openTerminal();
  };
  const toggleDiff = () =>
    setChanges(showChanges ? null : { session: s.session, scene: codeScene });
  const openPaste = () => {
    setPasteError("");
    setModal("paste-code");
  };
  const shortcutTitle = (id: ShortcutId, label: string = shortcuts[id][1]) => {
    const chord = shortcutBinding(id, shortcutOverrides);
    return chord ? `${label} (${formatShortcut(chord)})` : label;
  };
  const editorActions: Partial<Record<ShortcutId, string>> = {
    find: "actions.find",
    replace: "editor.action.startFindReplaceAction",
    goToLine: "editor.action.gotoLine",
    commands: "editor.action.quickCommand",
    format: "editor.action.formatDocument",
  };
  const actions: Record<ShortcutId, () => void> = {
    save: () => save(),
    saveCopy: () => save(true),
    newProject: () => requestLoad(newProject()),
    openProject,
    home: returnHome,
    export: openExport,
    settings: () => setModal("settings"),
    shortcuts: () => setModal("keyboard-shortcuts"),
    undo: s.undo,
    redo: s.redo,
    recovery: () => setModal("recovery-history"),
    play: () => {
      const state = useStudio.getState();
      if (!state.playing && state.time >= playbackDuration) state.setTime(0);
      state.setPlaying(!state.playing);
    },
    run: runPreview,
    previousFrame: () => stepFrame(-1),
    nextFrame: () => stepFrame(1),
    stop: () => {
      s.setPlaying(false);
      s.setTime(0);
    },
    fullscreen: toggleFullscreen,
    split: () => timelineActions.current?.split(),
    deleteText: () => timelineActions.current?.deleteText(),
    snapping: () => timelineActions.current?.toggleSnapping(),
    timeline: () => setTimelineHidden((value) => !value),
    rulers: () => setPreviewRulers((value) => !value),
    fit: () => setZoom(1),
    zoomIn: () => setZoom((value) => Math.min(4, value + 0.1)),
    zoomOut: () => setZoom((value) => Math.max(0.1, value - 0.1)),
    combinedPreview: () => changeScope(!masterMode),
    code: () => selectLeftView("code"),
    media: () => selectLeftView("media"),
    importMedia: () => fileRef.current?.click(),
    audio: () => selectLeftView("audio"),
    prompts: () => selectLeftView("prompts"),
    typography: () => selectLeftView("typography"),
    theme: () => setLight((value) => !value),
    expand: toggleEditor,
    all: () => showCodeTab("all"),
    html: () => showCodeTab("html"),
    css: () => showCodeTab("css"),
    js: () => showCodeTab("js"),
    splitCode: () => showCodeTab("split"),
    find: () => runEditorAction(editorActions.find!),
    replace: () => runEditorAction(editorActions.replace!),
    goToLine: () => runEditorAction(editorActions.goToLine!),
    commands: () => runEditorAction(editorActions.commands!),
    format: () => runEditorAction(editorActions.format!),
    diff: () => {
      selectLeftView("code");
      toggleDiff();
    },
    history: () => {
      selectLeftView("code");
      setModal("code-history");
    },
    problems: () => {
      selectLeftView("code");
      toggleProblems();
    },
    console: () => {
      selectLeftView("code");
      toggleConsole();
    },
    terminal: () => {
      selectLeftView("code");
      toggleTerminal();
    },
    wrap: () =>
      (editorExpanded ? setExpandedWrap : setCompactWrap)((value) => !value),
    pasteDocument: () => {
      selectLeftView("code");
      openPaste();
    },
  };
  shortcutHandler.current = (event, capture) => {
    if (
      showHome ||
      !storageReady ||
      modal ||
      event.defaultPrevented ||
      event.getModifierState("AltGraph") ||
      document.querySelector(
        '[role="dialog"]:not(.find-widget):not([aria-hidden="true"]), [role="alertdialog"], .code-editor-menu:popover-open',
      )
    )
      return;
    const target = event.target instanceof Element ? event.target : null;
    const inMonaco = !!target?.closest(".monaco-editor");
    const editing =
      inMonaco ||
      !!target?.closest("input, textarea, select, [contenteditable]");
    if (capture !== editing) return;
    const chord = keyboardChord(event);
    if (!chord) return;
    const id = bindings.get(chord);
    if (
      inMonaco &&
      (!id || !editorActions[id]) &&
      shortcutIds.some(
        (action) =>
          editorActions[action] &&
          shortcutOverrides[action] !== undefined &&
          shortcuts[action][2] === chord &&
          shortcutOverrides[action] !== chord,
      )
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (!id) return;
    }
    if (!id) return;
    if (
      editorActions[id] &&
      !inMonaco &&
      (editing || leftView !== "code" || leftHidden || !editorRef.current)
    )
      return;
    if (
      editing &&
      (!/^(?:Mod\+|Alt\+|F\d+$)/.test(chord) ||
        (!inMonaco && !["save", "saveCopy", "run"].includes(id)))
    )
      return;
    if (
      (id === "format" || id === "replace" || id === "pasteDocument") &&
      (masterMode || sceneLocked)
    )
      return;
    if (id === "deleteText" && !useStudio.getState().selectedText) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat || id === "previousFrame" || id === "nextFrame")
      actions[id]();
  };
  iframeShortcut.current = (chord, repeat, text) => {
    if (modal || showHome) return;
    const id = bindings.get(chord);
    if (
      !id ||
      !(text
        ? id === "split" || id === "deleteText"
        : previewShortcutIds.has(id))
    )
      return;
    if (!repeat || id === "previousFrame" || id === "nextFrame") actions[id]();
  };
  const previewControls = (
    <div className="transport-preview-controls">
      <button
        className="ruler-control"
        aria-label="Show preview rulers"
        aria-pressed={previewRulers}
        title="Show or hide pixel rulers"
        onClick={() => setPreviewRulers((value) => !value)}
      >
        <Ruler size={14} />
        <span>Rulers</span>
      </button>
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
      <button title="Zoom in" onClick={() => setZoom(Math.min(4, zoom + 0.1))}>
        <ZoomIn size={14} />
      </button>
    </div>
  );
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
          onRenameCurrent={async (name) => {
            useStudio.getState().change({ name }, "Rename project");
            if (autosave)
              await bridge.call("autosave", useStudio.getState().project);
          }}
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
      data-compact-inspector={compactInspector}
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
          className="compact-inspector-toggle"
          aria-label={compactInspector ? "Show library" : "Show inspector"}
          title={compactInspector ? "Show library" : "Show inspector"}
          onClick={() => setCompactInspector((value) => !value)}
        >
          <Settings2 size={17} />
        </button>
        <button
          aria-label="Project home"
          title={shortcutTitle("home")}
          onClick={returnHome}
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
            title={shortcutTitle("newProject")}
            onClick={() => requestLoad(newProject())}
          >
            <FilePlus2 size={17} />
            <span className="action-label">New</span>
          </button>
          <button
            title={shortcutTitle("openProject")}
            aria-label="Open project"
            onClick={openProject}
          >
            <FolderOpen size={17} />
            <span className="action-label">Open</span>
          </button>
          <button
            aria-label={shortcutTitle("save", "Save")}
            title={shortcutTitle("save", "Save")}
            onClick={() => save()}
          >
            <Save size={17} />
            <span className="action-label">Save</span>
          </button>
          <button
            aria-label="Undo project change"
            title={shortcutTitle("undo")}
            disabled={!s.past.length}
            onClick={s.undo}
          >
            <Undo2 size={17} />
          </button>
          <button
            aria-label="Redo project change"
            title={shortcutTitle("redo")}
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
          className={
            promptsOpen
              ? "prompt-toolbar-toggle active"
              : "prompt-toolbar-toggle"
          }
          aria-label="Prompts panel"
          aria-expanded={promptsOpen}
          aria-controls="prompt-builder-panel"
          title="Prompt builder"
          onClick={() => setPromptsOpen((value) => !value)}
        >
          <Sparkles size={17} />
        </button>
        <button
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          title={light ? "Switch to dark theme" : "Switch to light theme"}
          onClick={() => setLight(!light)}
        >
          {light ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button
          title={shortcutTitle("settings", "Project settings")}
          aria-label="Project settings"
          onClick={() => setModal("settings")}
        >
          <Settings2 size={18} />
        </button>
        <button
          className="primary"
          title={shortcutTitle("export", "Export")}
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
        <PromptDrawer open={promptsOpen} onClose={() => setPromptsOpen(false)}>
          <PromptTemplates
            master={masterMode}
            onClose={() => setPromptsOpen(false)}
            onPaste={() => {
              selectLeftView("code");
              setPasteError("");
              setModal("paste-code");
            }}
          />
        </PromptDrawer>
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
                    (id === "prompts" ? promptsOpen : id === leftView) ||
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
            className={
              "code-workbench" +
              (editorExpanded ? " code-workbench-expanded" : "")
            }
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
                    <Code2 size={14} />{" "}
                    {editorExpanded ? "CODE EDITOR" : "SOURCE CODE"}
                    {codeUnsaved && (
                      <span className="unsaved-code-badge" role="status">
                        Unsaved code
                      </span>
                    )}
                  </span>
                  <div>
                    <button
                      className="code-editor-menu-trigger"
                      title="Code editor options"
                      aria-label="Code editor options"
                      popoverTarget="code-editor-menu"
                    >
                      <Ellipsis size={18} />
                      {!!problemCount && (
                        <span
                          className="code-problem-dot"
                          role="status"
                          aria-label={`${problemCount} code problems`}
                        />
                      )}
                    </button>
                    <div
                      id="code-editor-menu"
                      popover="auto"
                      className="code-editor-menu"
                      role="group"
                      aria-label="Code editor actions"
                      onClickCapture={(event) => {
                        if ((event.target as Element).closest("button"))
                          event.currentTarget.hidePopover();
                      }}
                    >
                      <button
                        title="Code problems"
                        aria-label="Code problems"
                        aria-pressed={
                          showProblems && !showConsole && !showTerminal
                        }
                        onClick={toggleProblems}
                      >
                        <TriangleAlert size={16} aria-hidden="true" />
                        Code problems{problemCount ? ` (${problemCount})` : ""}
                      </button>
                      <button
                        aria-label="Preview console"
                        aria-pressed={showConsole}
                        onClick={toggleConsole}
                      >
                        <Braces size={16} aria-hidden="true" /> Console
                      </button>
                      <button
                        aria-label="PowerShell terminal"
                        aria-pressed={showTerminal}
                        onClick={toggleTerminal}
                      >
                        <SquareTerminal size={16} aria-hidden="true" /> Terminal
                      </button>
                      <button
                        title="Show code changes"
                        aria-label="Show code changes"
                        aria-pressed={!!changesBase}
                        onClick={() =>
                          setChanges(
                            showChanges
                              ? null
                              : { session: s.session, scene: codeScene },
                          )
                        }
                      >
                        <GitCompare size={16} aria-hidden="true" />
                        Show code changes
                      </button>
                      <button
                        title="Code history"
                        aria-label="Code history"
                        onClick={() => setModal("code-history")}
                      >
                        <History size={16} />
                        Code history
                      </button>
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
                        Paste full HTML document
                      </button>
                      <button
                        title="Format document"
                        disabled={masterMode || sceneLocked}
                        onClick={() =>
                          runEditorAction("editor.action.formatDocument")
                        }
                      >
                        <Code2 size={16} />
                        Format document
                      </button>
                      {!editorExpanded && (
                        <button
                          title="Collapse code panel"
                          onClick={() => setLeftHidden(true)}
                        >
                          <Columns2 size={16} aria-hidden="true" /> Collapse
                          code panel
                        </button>
                      )}
                    </div>
                    {editorExpanded && (
                      <button
                        title={shortcutTitle("save", "Save")}
                        aria-label={shortcutTitle("save", "Save code")}
                        onClick={() => save()}
                      >
                        <Save size={16} />
                      </button>
                    )}
                    <button
                      ref={expandEditorRef}
                      title={
                        editorExpanded
                          ? "Close expanded editor"
                          : "Expand editor"
                      }
                      aria-label={
                        editorExpanded
                          ? "Close expanded editor"
                          : "Expand editor"
                      }
                      aria-expanded={editorExpanded}
                      onClick={toggleEditor}
                    >
                      {editorExpanded ? (
                        <X size={16} />
                      ) : (
                        <Maximize2 size={15} />
                      )}
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
                <div className="code-editor-controls">
                  <div
                    className="editor-tabs"
                    role="group"
                    aria-label="Code views"
                  >
                    {(["all", "html", "css", "js", "split"] as Tab[]).map(
                      (t) => (
                        <button
                          key={t}
                          aria-label={
                            t === "js" ? "JavaScript" : t.toUpperCase()
                          }
                          title={
                            t === "js"
                              ? "JavaScript"
                              : t === "all"
                                ? "Complete document"
                                : t === "split"
                                  ? "Split editors"
                                  : t.toUpperCase()
                          }
                          className={tab === t ? "active" : ""}
                          aria-pressed={tab === t}
                          onClick={() => changeTab(t)}
                        >
                          {t === "html" ? (
                            <Code2 size={13} />
                          ) : t === "css" ? (
                            <Palette size={13} />
                          ) : t === "js" ? (
                            <Braces size={13} />
                          ) : t === "all" ? (
                            <Layers size={13} />
                          ) : (
                            <Columns2 size={13} />
                          )}
                          <span>
                            {t === "all"
                              ? "All"
                              : t === "split"
                                ? "Split"
                                : t.toUpperCase()}
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                  {editorExpanded && (
                    <div
                      className="expanded-editor-tools"
                      role="group"
                      aria-label="Code tools"
                    >
                      <select
                        className="editor-save-mode"
                        aria-label="Workspace save mode"
                        title="Workspace save mode"
                        value={autosave ? "auto" : "manual"}
                        onChange={(event) =>
                          setAutosave(event.target.value === "auto")
                        }
                      >
                        <option value="auto">Autosave</option>
                        <option value="manual">Manual save</option>
                      </select>
                      <div
                        className="editor-action-group"
                        role="group"
                        aria-label="Search and navigation"
                      >
                        <button
                          aria-label="Find"
                          title={shortcutTitle("find", "Find")}
                          onClick={() => runEditorAction("actions.find")}
                        >
                          <Search size={14} aria-hidden="true" />
                        </button>
                        <button
                          aria-label="Replace"
                          title={shortcutTitle("replace", "Replace")}
                          disabled={masterMode || sceneLocked}
                          onClick={() =>
                            runEditorAction(
                              "editor.action.startFindReplaceAction",
                            )
                          }
                        >
                          <Replace size={14} aria-hidden="true" />
                        </button>
                        <button
                          aria-label="Go to line"
                          title={shortcutTitle("goToLine")}
                          onClick={() =>
                            runEditorAction("editor.action.gotoLine")
                          }
                        >
                          <ListEnd size={14} aria-hidden="true" />
                        </button>
                        <button
                          aria-label="Command palette"
                          title={shortcutTitle("commands", "Command palette")}
                          onClick={() =>
                            runEditorAction("editor.action.quickCommand")
                          }
                        >
                          <Command size={14} aria-hidden="true" />
                        </button>
                        <button
                          aria-label="Word wrap"
                          title="Word wrap"
                          aria-pressed={expandedWrap}
                          onClick={() => setExpandedWrap((wrap) => !wrap)}
                        >
                          <WrapText size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <select
                        className="editor-format-menu"
                        aria-label="Format code"
                        value=""
                        disabled={masterMode || sceneLocked}
                        onChange={(event) => {
                          setFormatError("");
                          const action = event.target.value;
                          if (action === "json") void formatSelectedJson();
                          else runEditorAction(action);
                        }}
                      >
                        <option value="" disabled>
                          Format
                        </option>
                        <option value="editor.action.formatDocument">
                          Format document
                        </option>
                        <option value="editor.action.formatSelection">
                          Format selection
                        </option>
                        <option value="json">Format selected JSON</option>
                      </select>
                      <div
                        className="editor-font-controls"
                        role="group"
                        aria-label="Code text size"
                      >
                        <button
                          aria-label="Decrease code text size"
                          disabled={fontSize <= 10}
                          onClick={() =>
                            setFontSize((size) => Math.max(10, size - 1))
                          }
                        >
                          <Minus size={13} />
                        </button>
                        <output aria-label="Code text size in pixels">
                          {fontSize}px
                        </output>
                        <button
                          aria-label="Increase code text size"
                          disabled={fontSize >= 28}
                          onClick={() =>
                            setFontSize((size) => Math.min(28, size + 1))
                          }
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {formatError && (
                  <div className="code-readonly-notice" role="status">
                    <span>{formatError}</span>
                    <button
                      aria-label="Dismiss format message"
                      onClick={() => setFormatError("")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {changesBase && (
                  <div className="code-changes-legend">
                    <span>
                      {changes?.code
                        ? "Compared with a history version"
                        : "Changes since the baseline save"}
                    </span>
                    <span className="code-change-removed">− Removed</span>
                    <span className="code-change-added">+ Added</span>
                  </div>
                )}
                <div className="editor-container">
                  {tab === "all" ? (
                    <>
                      {changesBase ? (
                        renderChanges(
                          "all",
                          combined({ ...p, ...changesBase }),
                          combinedDraft,
                          updateCombined,
                        )
                      ) : (
                        <Editor
                          language="html"
                          theme={
                            light ? "framescript-light" : "framescript-dark"
                          }
                          path={(p.workflow?.selectedId ?? "project") + "/all"}
                          keepCurrentModel
                          value={combinedDraft}
                          gutterBaseline={
                            masterMode || !gutterProject
                              ? undefined
                              : combined({ ...p, ...workingBase })
                          }
                          onChange={(v) => updateCombined(v ?? "")}
                          onMount={(instance) => trackEditor(instance, "all")}
                          options={{
                            fontSize,
                            readOnly: masterMode || sceneLocked,
                            ...editorDisplay,
                            automaticLayout: true,
                          }}
                        />
                      )}
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
                {(showProblems || showConsole || showTerminal) && (
                  <div
                    className="code-bottom-panel"
                    style={{ height: outputHeight }}
                  >
                    <div
                      className="code-bottom-resizer"
                      role="separator"
                      aria-label="Resize code output panel"
                      aria-orientation="horizontal"
                      tabIndex={0}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        const panel = event.currentTarget.parentElement!;
                        outputDrag.current = {
                          y: event.clientY,
                          height: panel.offsetHeight,
                          max: Math.max(
                            100,
                            (panel.parentElement?.clientHeight ?? 400) * 0.75,
                          ),
                        };
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        const drag = outputDrag.current;
                        if (
                          drag &&
                          event.currentTarget.hasPointerCapture(event.pointerId)
                        )
                          setOutputHeight(
                            Math.max(
                              100,
                              Math.min(
                                drag.max,
                                drag.height + drag.y - event.clientY,
                              ),
                            ),
                          );
                      }}
                      onLostPointerCapture={() => {
                        outputDrag.current = null;
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key !== "ArrowUp" &&
                          event.key !== "ArrowDown"
                        )
                          return;
                        event.preventDefault();
                        const panel = event.currentTarget.parentElement!;
                        const max = Math.max(
                          100,
                          (panel.parentElement?.clientHeight ?? 400) * 0.75,
                        );
                        setOutputHeight(
                          Math.max(
                            100,
                            Math.min(
                              max,
                              panel.offsetHeight +
                                (event.key === "ArrowUp" ? 20 : -20),
                            ),
                          ),
                        );
                      }}
                      onDoubleClick={() => setOutputHeight(170)}
                    />
                    <div
                      className="code-bottom-tabs"
                      role="group"
                      aria-label="Code output panels"
                    >
                      <button
                        aria-pressed={!showConsole && !showTerminal}
                        onClick={() => {
                          setShowProblems(true);
                          setShowConsole(false);
                          setShowTerminal(false);
                        }}
                      >
                        Problems{problemCount ? ` (${problemCount})` : ""}
                      </button>
                      <button
                        aria-pressed={showConsole}
                        onClick={() => {
                          setShowTerminal(false);
                          setShowConsole(true);
                        }}
                      >
                        Console
                      </button>
                      <button
                        aria-pressed={showTerminal}
                        onClick={openTerminal}
                      >
                        Terminal
                      </button>
                      <button
                        className="code-bottom-close"
                        aria-label="Close code output panel"
                        onClick={() => {
                          setShowProblems(false);
                          setShowConsole(false);
                          setShowTerminal(false);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {showTerminal ? (
                      <TerminalPanel id={terminalId} />
                    ) : showConsole ? (
                      <PreviewConsole
                        entries={consoleEntries}
                        onClear={() => setConsoleEntries([])}
                        onCommand={(command) => {
                          appendConsole([{ level: "command", text: command }]);
                          consoleCommandRef.current?.(command);
                        }}
                      />
                    ) : (
                      <CodeProblems
                        syntax={syntax}
                        parseError={parseError}
                        previewError={s.errorCode !== undefined ? s.error : ""}
                        previewLocation={previewLocation ?? undefined}
                        projectError={s.errorCode === undefined ? s.error : ""}
                        onJump={jumpToProblem}
                      />
                    )}
                  </div>
                )}
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
              title={shortcutTitle("run")}
              onClick={runPreview}
            >
              <Play size={16} />
            </button>
            <select
              aria-label="Preview quality"
              title="3D preview quality only. Auto matches the panel up to 1080p; export resolution and FPS are unchanged. HTML and 2D canvases keep their original coordinates."
              value={previewQuality}
              onChange={(event) =>
                setPreviewQuality(
                  event.target.value as "auto" | "1080" | "full",
                )
              }
            >
              <option value="auto">Preview · Auto</option>
              <option value="1080">Preview · 1080p</option>
              <option value="full">Preview · Full</option>
            </select>
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
              title={shortcutTitle("fullscreen", "Full screen preview")}
              onClick={toggleFullscreen}
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
              quality={previewQuality}
              compositionProject={masterMode ? executionProject : undefined}
              textEditing={!masterMode}
              projectOverride={viewProject}
              run={run}
              select={select}
              onSelect={handleSelect}
              onReady={handleReady}
              onVisual={handleVisual}
              onConsole={appendConsole}
              consoleCommandRef={consoleCommandRef}
              shortcutKeys={previewKeys}
              onPreviewShortcut={handlePreviewShortcut}
              onTextShortcut={handleTextShortcut}
              zoom={zoom}
              rulers={previewRulers}
            />
            <div className="fullscreen-controls">
              <PlayerTransport
                masterMode={masterMode}
                fullscreen
                previewControls={previewControls}
              />
            </div>
          </div>
          <PlayerTransport
            masterMode={masterMode}
            previewControls={previewControls}
          />
          {s.error && (
            <div className="preview-error" role="alert">
              <span>
                {previewLocation
                  ? `JavaScript · line ${previewLocation.line}, column ${previewLocation.column}: `
                  : s.errorCode !== undefined
                    ? "Preview error: "
                    : "Project error: "}
                {s.error}
              </span>
              {previewLocation && (
                <button
                  title="Jump to error"
                  aria-label="Jump to error"
                  onClick={() => jumpToProblem("js", previewLocation)}
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
          actionsRef={timelineActions}
          onStructuredEdit={setStructuredEditClip}
          splitHint={shortcutTitle("split")}
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
          {!autosave
            ? manualUnsaved
              ? "Manual save · Unsaved changes"
              : "Manual save"
            : storageSaveState === "saved"
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
      {modal === "code-history" && (
        <CodeHistory
          scene={p.workflow?.selectedId ?? null}
          readOnly={masterMode || sceneLocked}
          onClose={() => setModal("")}
          onCompare={(code, language) => {
            changeTab(language);
            setChanges({ session: s.session, scene: codeScene, code });
            setModal("");
          }}
          onRestore={(code) => {
            setParseError("");
            setCombinedDraft(combined({ ...p, ...code }));
            s.change(code, "Restore code version");
            setModal("");
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
      {modal === "keyboard-shortcuts" && (
        <KeyboardShortcuts
          overrides={shortcutOverrides}
          onChange={setShortcutOverrides}
          onClose={() => setModal("")}
        />
      )}
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
      {structuredEditClip && (
        <StructuredEditPanel
          key={s.session + ":" + structuredEditClip}
          clipId={structuredEditClip}
          project={p}
          appliedProject={executionProject}
          onClose={() => setStructuredEditClip(undefined)}
        />
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
          <h3>Rendered files</h3>
          <p>
            Local render copies expire after 7 days. Clearing them removes
            completed download links; files saved to your chosen destination
            stay intact.
          </p>
          <button
            onClick={() =>
              void act(async () =>
                setExportStorage(await bridge.call("exportStorage")),
              )
            }
          >
            Check retained renders
          </button>
          {exportStorage && (
            <p role="status">
              {exportStorage.files} files ·{" "}
              {(exportStorage.bytes / 1_000_000).toFixed(1)} MB retained
            </p>
          )}
          <button
            onClick={() => {
              if (
                confirm(
                  "Clear completed local render copies? Their download links will stop working. Active renders and downloads will be kept.",
                )
              )
                void act(async () => {
                  setExportStorage(await bridge.call("clearExportFiles"));
                  for (const job of exports.jobs)
                    if (job.status === "completed") exports.dismiss(job.id);
                });
            }}
          >
            Clear completed renders
          </button>
        </div>
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
          <Field label="Workspace save mode">
            <select
              value={autosave ? "auto" : "manual"}
              onChange={(event) => setAutosave(event.target.value === "auto")}
            >
              <option value="auto">Autosave</option>
              <option value="manual">Manual save</option>
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
          <button onClick={() => setModal("keyboard-shortcuts")}>
            Keyboard shortcuts
          </button>
          <button onClick={() => setModal("recovery-history")}>
            Recovery history
          </button>
          <button onClick={downloadRecoveryCopy}>Download recovery copy</button>
          <button onClick={() => save(true)}>Save copy as .frame</button>
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
              <label
                className="prompt-check"
                title="Choose a folder before rendering, or leave unchecked to use Downloads."
              >
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
              frames ·{" "}
              {["mp4", "mkv", "webm"].includes(exportOptions.format)
                ? "Audio included"
                : "Silent output"}
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
