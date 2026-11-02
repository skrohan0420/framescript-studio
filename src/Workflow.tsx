import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  FilePlus2,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useStudio, useProjectState } from "./store";
import { bridge } from "./bridge";
import { WorkflowSurface, Field } from "./components";
import {
  initialWorkflow,
  activateScene,
  selectedScene,
  localStoryboard,
  scenesFromPlan,
  totalDuration,
  templateIds,
  templateCode,
  mascotPrompt,
  sceneOffset,
} from "../shared/workflow";
import {
  timeScenesToNarration,
  withAudioClip,
  narrationLength,
} from "../shared/narration";
import type { Project, Scene, AudioClip } from "../shared/project";
import { builtinSounds, synthesizeSound } from "../shared/audio";
import { readData, audioDetails, clipFromAudio } from "./audio";

export function Workflow({
  open,
  onClose,
  provider,
  model,
  busy,
  onMaster,
  onNotice,
  onServices,
  onEditScene,
  onGenerateScene,
  requestedTab,
  masterMode = false,
  embedded = false,
  onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  provider: string;
  model: string;
  busy: boolean;
  onMaster: (value: boolean) => void;
  onNotice: (message: string) => void;
  onServices: () => void;
  onEditScene: () => void;
  onGenerateScene: (id: string) => void;
  requestedTab?: string;
  masterMode?: boolean;
  embedded?: boolean;
  onTabChange?: (tab: string) => void;
}) {
  const s = useProjectState(),
    p = s.project,
    w = p.workflow ?? initialWorkflow(p),
    scene = selectedScene(p) ?? w.scenes[0];
  const [tab, setTab] = useState("script"),
    [script, setScript] = useState(w.script),
    [working, setWorking] = useState(""),
    [error, setError] = useState("");
  const [component, setComponent] = useState("headline"),
    [text, setText] = useState("A clear idea. Beautifully explained."),
    [color, setColor] = useState(p.brand?.primary ?? "#67b4ff"),
    [font, setFont] = useState(p.brand?.font ?? "Segoe UI");
  const [variation, setVariation] = useState(
      "Happy expression, waving hello, facing the viewer",
    ),
    [imageModel, setImageModel] = useState(""),
    [imageModels, setImageModels] = useState<any[]>([]),
    [status, setStatus] = useState({ gemini: false, eleven: false });
  const [voice, setVoice] = useState(""),
    [voiceModel, setVoiceModel] = useState("eleven_v4"),
    [voices, setVoices] = useState<any[]>([]),
    [voiceModels, setVoiceModels] = useState<any[]>([]),
    [sfxPrompt, setSFXPrompt] = useState("A soft, short cinematic whoosh");
  const [audioLane, setAudioLane] = useState<AudioClip["lane"]>("voice");
  const [audioDragging, setAudioDragging] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [voiceScope, setVoiceScope] = useState<"auto" | "script" | "scene">(
    "auto",
  );
  const fullScript =
    voiceScope === "script" ||
    (voiceScope === "auto" &&
      !!w.script.trim() &&
      (!scene.narration.trim() ||
        p.audio?.some(
          (clip) => clip.lane === "voice" && !clip.sceneId && !clip.muted,
        )));
  const narrationText = fullScript ? w.script : scene.narration;
  const voiceBlocked =
    !fullScript &&
    (scene.locked ||
      p.audio?.some(
        (clip) => clip.lane === "voice" && !clip.sceneId && !clip.muted,
      ));
  const imagesRef = useRef<HTMLInputElement>(null),
    audioRef = useRef<HTMLInputElement>(null);
  const importKind = useRef<"reference" | "variant">("reference");
  const goToTab = (value: string) => {
    setTab(value);
    onTabChange?.(value);
  };
  useEffect(() => {
    if (open && requestedTab) setTab(requestedTab);
  }, [open, requestedTab]);
  useEffect(() => {
    if (open) {
      setScript(p.workflow?.script ?? "");
      void bridge
        .call("mediaStatus")
        .then(setStatus)
        .catch((e) => setError(e.message));
    }
  }, [open]);
  const [preferencesReady, setPreferencesReady] = useState(false);
  useEffect(() => {
    void bridge
      .call("settingsGet")
      .then((settings) => {
        const v = settings.mediaPreferences;
        if (v) {
          setVoice(v.voice ?? "");
          setVoiceModel(v.voiceModel ?? "eleven_v4");
          setImageModel(v.imageModel ?? "");
          setFont(v.font ?? "Segoe UI");
          setColor(v.color ?? "#67b4ff");
        }
        setPreferencesReady(true);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!preferencesReady) return;
    const timer = setTimeout(() => {
      void bridge
        .call("settingsSet", {
          mediaPreferences: { voice, voiceModel, imageModel, font, color },
        })
        .catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [preferencesReady, voice, voiceModel, imageModel, font, color]);
  useEffect(() => {
    if (!open || tab !== "voice" || !preferencesReady) return;
    let cancelled = false;
    void (async () => {
      const connected = await bridge.call("mediaStatus");
      if (cancelled) return;
      setStatus(connected);
      if (!connected.eleven) return;
      const catalog = await bridge.call("elevenCatalog");
      if (cancelled) return;
      setVoices(catalog.voices);
      setVoiceModels(catalog.models);
      setVoice((current) =>
        catalog.voices.some((v: any) => v.id === current)
          ? current
          : (catalog.voices[0]?.id ?? ""),
      );
      setVoiceModel((current) =>
        catalog.models.some((v: any) => v.id === current)
          ? current
          : (catalog.models.find((v: any) => v.id === "eleven_v4")?.id ??
            catalog.models[0]?.id ??
            ""),
      );
    })().catch((e) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [open, tab, preferencesReady]);
  const task = async (label: string, fn: () => Promise<void>) => {
    if (working || busy) return;
    setWorking(label);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking("");
    }
  };
  const current = () => useStudio.getState().project;
  const changeWorkflow = (
    patch: Partial<NonNullable<Project["workflow"]>>,
    label = "Storyboard edit",
  ) => {
    const p = current();
    s.change(
      { workflow: { ...(p.workflow ?? initialWorkflow(p)), ...patch } },
      label,
    );
  };
  const updateScene = (id: string, patch: Partial<Scene>) => {
    const p = current(),
      w = p.workflow ?? initialWorkflow(p);
    const edits: Partial<Project> = {
      workflow: {
        ...w,
        scenes: w.scenes.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      },
    };
    if (id === w.selectedId && patch.duration !== undefined)
      edits.settings = { ...p.settings, duration: patch.duration };
    s.change(edits, "Edit scene");
  };
  const setPlan = async (plan: unknown, narration?: AudioClip) => {
    const p = current();
    const take =
      narration ??
      [...(p.audio ?? [])]
        .reverse()
        .find((clip) => clip.lane === "voice" && !clip.sceneId && !clip.muted);
    let scenes = scenesFromPlan(script, plan, p);
    if (take) scenes = timeScenesToNarration(scenes, take, script);
    if (
      p.workflow?.scenes.length &&
      !confirm(
        "Replace the storyboard and its scene audio with this plan? Master audio is kept. Project Undo can restore the previous scenes.",
      )
    )
      return;
    const workflow = {
      ...(p.workflow ?? initialWorkflow(p)),
      script,
      scenes,
      selectedId: scenes[0].id,
    };
    const revision = useStudio.getState().revision;
    await bridge.call("checkpoint", "Before replacing storyboard", p);
    if (useStudio.getState().revision !== revision)
      throw Error("Project changed before replacing storyboard. Try again.");
    s.change(
      {
        ...activateScene({ ...p, workflow }, workflow.selectedId),
        workflow,
        audio: p.audio?.filter((a) => !a.sceneId),
      },
      "Create storyboard",
    );
    s.setTime(0);
    s.setPlaying(false);
    onMaster(false);
    goToTab("scenes");
  };
  const addAudio = (clip: AudioClip) => {
    s.change(withAudioClip(current(), clip), "Add audio and narration timing");
  };
  const soundStart = () =>
    Math.max(
      0,
      Math.min(
        scene.duration - 0.01,
        useStudio.getState().time -
          (masterMode ? sceneOffset(current(), scene.id) : 0),
      ),
    );
  const importImages = async (files: FileList | null) => {
    if (!files) return;
    const p = current(),
      assets = [...p.assets],
      refs = [...w.mascot.references];
    for (const file of Array.from(files)) {
      if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type))
        throw Error("Use PNG, JPEG, WebP or SVG images");
      const id = crypto.randomUUID();
      assets.push({
        id,
        name: file.name,
        data: await readData(file),
        kind: importKind.current,
        mascot: w.mascot.name,
      });
      if (importKind.current === "reference") refs.push(id);
    }
    s.change(
      {
        assets,
        workflow: {
          ...(p.workflow ?? initialWorkflow(p)),
          mascot: { ...w.mascot, references: refs.slice(0, 10) },
        },
      },
      "Import mascot images",
    );
  };
  const importAudioFiles = async (files: File[], lane: AudioClip["lane"]) => {
    setImportNotice("");
    for (const file of files) {
      if (
        !file.type.startsWith("audio/") &&
        !/\.(mp3|wav|m4a|ogg|flac|aac|opus|aiff?|webm)$/i.test(file.name)
      )
        throw Error("Choose an audio file such as MP3 or WAV.");
      if (lane === "voice" && voiceBlocked)
        throw Error(
          "Unlock the scene or mute the full-script take before importing scene narration.",
        );
      const targetScope =
        lane === "music" || (lane === "voice" && fullScript)
          ? undefined
          : w.selectedId;
      const expectedText = narrationText,
        placement = soundStart(),
        revision = useStudio.getState().revision;
      const data = await readData(file),
        details = await audioDetails(data);
      if (useStudio.getState().revision !== revision)
        throw Error(
          "Project changed while importing audio. Import the file again.",
        );
      if (
        lane === "voice" &&
        (fullScript
          ? current().workflow?.script
          : current().workflow?.scenes.find((item) => item.id === targetScope)
              ?.narration) !== expectedText
      )
        throw Error(
          "Narration text changed while importing. Import the take again.",
        );
      addAudio({
        ...clipFromAudio(
          { name: file.name, data, ...details },
          lane,
          targetScope,
        ),
        ...(lane === "voice" && expectedText.trim()
          ? { transcript: expectedText }
          : {}),
        ...(lane === "sfx" ? { start: placement } : {}),
      });
      setImportNotice(`${file.name} · ${details.duration.toFixed(2)}s loaded`);
      onNotice(`Imported audio · ${file.name}`);
    }
  };
  const insertAsset = (id: string) => {
    const p = current();
    if (selectedScene(p)?.locked) throw Error("Unlock the scene first");
    s.change(
      {
        html:
          p.html +
          `\n<img id="mascot-${crypto.randomUUID()}" src="asset://${id}" style="position:absolute;left:120px;top:240px;height:520px;object-fit:contain">`,
      },
      "Insert mascot variant",
    );
    onNotice("Image inserted into the selected scene");
  };
  return (
    <WorkflowSurface
      embedded={embedded}
      title="Storyboard & production workflow"
      wide
      open={open}
      onClose={onClose}
    >
      <nav className="workflow-tabs">
        {["script", "scenes", "components", "voice", "sound", "mascot"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => goToTab(t)}
            >
              {t === "sound"
                ? "SFX & Music"
                : t === "mascot"
                  ? "Mascot & images"
                  : t[0].toUpperCase() + t.slice(1)}
            </button>
          ),
        )}
      </nav>
      <div className="workflow-context">
        <span>
          Selected: <strong>{scene.title}</strong>
        </span>
        <span>
          {w.scenes.length} scenes ·{" "}
          {totalDuration({ ...p, workflow: w }).toFixed(1)}s total · hard cuts
        </span>
      </div>
      {(working || error) && (
        <div
          className={error ? "workflow-error" : "workflow-working"}
          role={error ? "alert" : "status"}
        >
          {error || working}
          {working && (
            <button
              onClick={() =>
                void bridge.call(
                  working.startsWith("Planning") ? "cancelAI" : "cancelMedia",
                )
              }
            >
              Cancel request
            </button>
          )}
        </div>
      )}
      <fieldset className="workflow-fields" disabled={!!working || busy}>
        {tab === "script" && (
          <div className="workflow-two-columns">
            <div>
              <h3>1. Start with your narration</h3>
              <p className="muted">
                Paste the script. Review the scene plan before generating custom
                animations. Local splitting is available without AI.
              </p>
              <textarea
                aria-label="Video script"
                className="script-input"
                value={script}
                placeholder="Paste your script here…"
                onChange={(e) => {
                  setScript(e.target.value);
                  changeWorkflow({ script: e.target.value }, "Edit script");
                }}
              />
              <small>
                {script.trim() ? script.trim().split(/\s+/).length : 0} words ·
                durations are estimates until narration is generated
              </small>
              <div className="workflow-actions">
                <button
                  disabled={!script.trim()}
                  onClick={() => {
                    setVoiceScope("script");
                    setAudioLane("voice");
                    goToTab("voice");
                  }}
                >
                  Generate narration first
                </button>
                <button
                  className="primary"
                  onClick={() =>
                    void task("Splitting script", async () =>
                      setPlan(localStoryboard(script)),
                    )
                  }
                >
                  Split locally
                </button>
                <button
                  onClick={() =>
                    void task("Planning scenes with AI…", async () => {
                      if (!model)
                        throw Error(
                          "Connect an AI provider and select a model in the assistant first",
                        );
                      const revision = useStudio.getState().revision;
                      const result = await bridge.call(
                        "plan",
                        { provider, model },
                        {
                          project: { ...p, workflow: { ...w, script } },
                          prompt: script,
                          history: [],
                          images: [],
                        },
                      );
                      if (useStudio.getState().revision !== revision)
                        throw Error(
                          "The project changed while planning. Try again with the current script.",
                        );
                      await setPlan(result);
                    })
                  }
                >
                  Suggest scenes with AI
                </button>
                <button
                  onClick={() => changeWorkflow({ script }, "Save script")}
                >
                  Save script
                </button>
              </div>
            </div>
            <div>
              <h3>2. Shared creative direction</h3>
              <Field label="Visual style across every scene">
                <textarea
                  rows={7}
                  value={w.style}
                  onChange={(e) => changeWorkflow({ style: e.target.value })}
                />
              </Field>
              <p className="muted">
                AI scene generation receives this direction, the selected
                narration and mascot identity notes. Each scene retains its own
                editable HTML, CSS and JavaScript.
              </p>
              <p className="muted">
                Suggested sequence: script → generate or import full narration →
                compose scenes to its measured length → create visuals → add
                SFX/music → preview/export master. Scene boundaries are
                approximate until reviewed; audio length alone does not identify
                spoken-word timestamps.
              </p>
              <button
                onClick={() => {
                  if (!p.workflow)
                    s.change({ workflow: initialWorkflow(p) }, "Enable scenes");
                  goToTab("scenes");
                }}
              >
                Keep the current animation as Scene 1
              </button>
            </div>
          </div>
        )}
        {tab === "scenes" && (
          <div className="storyboard-list">
            {w.scenes.map((item, i) => (
              <article
                className={
                  "storyboard-card " +
                  (item.id === w.selectedId ? "selected" : "")
                }
                key={item.id}
              >
                <div className="storyboard-card-title">
                  <b>{String(i + 1).padStart(2, "0")}</b>
                  <input
                    aria-label={`Scene ${i + 1} title`}
                    disabled={item.locked}
                    value={item.title}
                    onChange={(e) =>
                      updateScene(item.id, {
                        title: e.target.value || "Untitled scene",
                      })
                    }
                  />
                  <button
                    title="Move scene up"
                    disabled={i === 0}
                    onClick={() => {
                      const scenes = [...w.scenes];
                      [scenes[i - 1], scenes[i]] = [scenes[i], scenes[i - 1]];
                      changeWorkflow({ scenes }, "Reorder scenes");
                    }}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    title="Move scene down"
                    disabled={i === w.scenes.length - 1}
                    onClick={() => {
                      const scenes = [...w.scenes];
                      [scenes[i + 1], scenes[i]] = [scenes[i], scenes[i + 1]];
                      changeWorkflow({ scenes }, "Reorder scenes");
                    }}
                  >
                    <ArrowDown size={15} />
                  </button>
                </div>
                <div className="storyboard-card-grid">
                  <Field label="Narration">
                    <textarea
                      disabled={item.locked}
                      rows={3}
                      value={item.narration}
                      onChange={(e) =>
                        updateScene(item.id, { narration: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Visual direction">
                    <textarea
                      disabled={item.locked}
                      rows={3}
                      value={item.visual}
                      onChange={(e) =>
                        updateScene(item.id, { visual: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Duration (seconds)">
                    <input
                      disabled={item.locked}
                      type="number"
                      min=".1"
                      step=".1"
                      value={item.duration}
                      onChange={(e) => {
                        const n = +e.target.value;
                        if (n >= 0.1) updateScene(item.id, { duration: n });
                      }}
                    />
                  </Field>
                </div>
                <div className="workflow-actions">
                  <button
                    className="primary"
                    onClick={() => {
                      const project = { ...current(), workflow: w };
                      s.change(activateScene(project, item.id), "Select scene");
                      s.setPlaying(false);
                      s.setTime(0);
                      onMaster(false);
                      onEditScene();
                      onClose();
                    }}
                  >
                    Edit this scene
                  </button>
                  <button
                    className="primary"
                    disabled={busy || item.locked}
                    onClick={() => {
                      s.change(
                        activateScene(current(), item.id),
                        "Select scene for generation",
                      );
                      s.setPlaying(false);
                      s.setTime(0);
                      onMaster(false);
                      onEditScene();
                      onClose();
                      onGenerateScene(item.id);
                    }}
                  >
                    Generate scene
                  </button>
                  <button
                    disabled={item.locked}
                    onClick={() => {
                      const doc = new DOMParser().parseFromString(
                        item.html,
                        "text/html",
                      );
                      const walker = doc.createTreeWalker(
                        doc.body,
                        NodeFilter.SHOW_TEXT,
                      );
                      const nodes: Text[] = [];
                      while (walker.nextNode()) {
                        const node = walker.currentNode as Text;
                        if (!node.parentElement?.closest("script,style"))
                          nodes.push(node);
                      }
                      nodes.forEach((node) => (node.textContent = ""));
                      if (item.id === w.selectedId)
                        s.change(
                          { html: doc.body.innerHTML },
                          "Remove scene text",
                        );
                      else updateScene(item.id, { html: doc.body.innerHTML });
                    }}
                  >
                    Remove scene text
                  </button>
                  <button
                    onClick={() => {
                      const copy = {
                        ...item,
                        id: crypto.randomUUID(),
                        title: item.title + " copy",
                        locked: false,
                      };
                      changeWorkflow(
                        {
                          scenes: [
                            ...w.scenes.slice(0, i + 1),
                            copy,
                            ...w.scenes.slice(i + 1),
                          ],
                        },
                        "Duplicate scene",
                      );
                    }}
                  >
                    <Copy size={13} />
                    Duplicate
                  </button>
                  <button
                    onClick={() =>
                      updateScene(item.id, { locked: !item.locked })
                    }
                  >
                    {item.locked ? <Unlock size={13} /> : <Lock size={13} />}{" "}
                    {item.locked ? "Unlock" : "Approve & lock"}
                  </button>
                  <button
                    disabled={w.scenes.length === 1}
                    onClick={() => {
                      if (!confirm("Remove this scene? Undo can restore it."))
                        return;
                      const scenes = w.scenes.filter((a) => a.id !== item.id),
                        workflow = {
                          ...w,
                          scenes,
                          selectedId:
                            w.selectedId === item.id
                              ? scenes[0].id
                              : w.selectedId,
                        };
                      s.change(
                        {
                          ...activateScene(
                            { ...p, workflow },
                            workflow.selectedId,
                          ),
                          workflow,
                          audio: p.audio?.filter((a) => a.sceneId !== item.id),
                        },
                        "Remove scene",
                      );
                    }}
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </article>
            ))}
            <div className="workflow-actions">
              <button
                onClick={() => {
                  const code = templateCode("headline", "New scene"),
                    item: Scene = {
                      id: crypto.randomUUID(),
                      title: "New scene",
                      narration: "",
                      visual: "",
                      duration: 5,
                      locked: false,
                      template: "headline",
                      ...code,
                    };
                  changeWorkflow({ scenes: [...w.scenes, item] }, "Add scene");
                }}
              >
                <Plus size={14} />
                Add scene
              </button>
              <button
                onClick={() => {
                  onMaster(true);
                  s.setPlaying(false);
                  s.setTime(0);
                  onClose();
                }}
              >
                Preview master composition
              </button>
            </div>
          </div>
        )}
        {tab === "components" && (
          <div className="workflow-two-columns">
            <div>
              <h3>Reusable typography</h3>
              <p className="muted">
                Apply a local component instantly. No AI request is made.
                Components replace the selected scene's code; Undo restores it.
              </p>
              <div className="template-picker">
                {templateIds.map((id) => (
                  <button
                    key={id}
                    className={component === id ? "active" : ""}
                    onClick={() => setComponent(id)}
                  >
                    <span>
                      {id === "headline"
                        ? "Aa"
                        : id === "quote"
                          ? "“ ”"
                          : id === "bullets"
                            ? "☷"
                            : id === "stat"
                              ? "100%"
                              : "◉"}
                    </span>
                    {id}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Field label="Component text">
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
              <div className="settings-grid">
                <Field label="Accent color">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </Field>
                <Field label="Font">
                  <select
                    value={font}
                    onChange={(e) => setFont(e.target.value)}
                  >
                    {[
                      "Segoe UI",
                      "Arial",
                      "Georgia",
                      "Consolas",
                      "Verdana",
                    ].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <button
                className="primary"
                disabled={scene.locked}
                onClick={() => {
                  const code = templateCode(
                    component,
                    text,
                    color,
                    font,
                    w.mascot.references[0],
                    p.brand?.background,
                  );
                  s.change(
                    {
                      workflow: {
                        ...w,
                        scenes: w.scenes.map((a) =>
                          a.id === w.selectedId
                            ? { ...a, template: component }
                            : a,
                        ),
                      },
                      ...code,
                    },
                    "Apply typography component",
                  );
                  onMaster(false);
                  onNotice("Component applied locally");
                }}
              >
                Apply to selected scene
              </button>
            </div>
          </div>
        )}
        {tab === "mascot" && (
          <div className="workflow-two-columns">
            <div>
              <h3>Reusable mascot identity</h3>
              <Field label="Mascot name">
                <input
                  value={w.mascot.name}
                  onChange={(e) =>
                    changeWorkflow({
                      mascot: { ...w.mascot, name: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Identity and consistency rules">
                <textarea
                  rows={5}
                  value={w.mascot.rules}
                  onChange={(e) =>
                    changeWorkflow({
                      mascot: { ...w.mascot, rules: e.target.value },
                    })
                  }
                />
              </Field>
              <div className="workflow-actions">
                <button
                  onClick={() => {
                    importKind.current = "reference";
                    imagesRef.current?.click();
                  }}
                >
                  Upload references
                </button>
                <button
                  onClick={() => {
                    importKind.current = "variant";
                    imagesRef.current?.click();
                  }}
                >
                  Import variants from Flow
                </button>
              </div>
              <input
                ref={imagesRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                multiple
                hidden
                onChange={(e) =>
                  void task("Importing mascot assets", () =>
                    importImages(e.target.files),
                  )
                }
              />
              <div className="mascot-assets">
                {p.assets.map((a) => (
                  <div key={a.id}>
                    <img src={a.data} alt={a.name} />
                    <small>{a.name}</small>
                    <label>
                      <input
                        type="checkbox"
                        checked={w.mascot.references.includes(a.id)}
                        onChange={(e) =>
                          changeWorkflow({
                            mascot: {
                              ...w.mascot,
                              references: e.target.checked
                                ? [...w.mascot.references, a.id].slice(0, 10)
                                : w.mascot.references.filter(
                                    (id) => id !== a.id,
                                  ),
                            },
                          })
                        }
                      />
                      Reference
                    </label>
                    <button
                      disabled={scene.locked}
                      onClick={() => {
                        try {
                          insertAsset(a.id);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Use in scene
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3>Generate a pose or expression</h3>
              <Field label="Variant direction">
                <textarea
                  rows={3}
                  value={variation}
                  onChange={(e) => setVariation(e.target.value)}
                />
              </Field>
              <div className="variation-presets">
                {[
                  "Waving hello",
                  "Thinking, hand on chin",
                  "Excited, pointing right",
                  "Confused, shrugging",
                  "Running, side view",
                  "Celebrating a success",
                ].map((v) => (
                  <button key={v} onClick={() => setVariation(v)}>
                    {v}
                  </button>
                ))}
              </div>
              <h4>Google Flow handoff</h4>
              <p className="muted">
                Flow opens separately. Copy the prompt, upload these same mascot
                references in Flow, then import the downloaded variants here.
                This does not connect a Flow account or use private Flow APIs.
              </p>
              <div className="workflow-actions">
                <button
                  onClick={() =>
                    void task("Copying prompt", async () => {
                      await navigator.clipboard.writeText(
                        mascotPrompt(p, variation),
                      );
                      onNotice(
                        "Mascot prompt copied. Attach your references in Flow.",
                      );
                    })
                  }
                >
                  Copy Flow prompt
                </button>
                <a
                  className="external-button"
                  href="https://labs.google/fx/tools/flow"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Google Flow ↗
                </a>
              </div>
              <details className="media-configuration">
                <summary>Optional in-app generation · Gemini API</summary>
                <p className="muted">
                  Requires a Gemini API key; billing is separate from your
                  Google Flow subscription. References improve consistency but
                  do not guarantee it.
                </p>
                <button onClick={onServices}>
                  Manage image connection in Services
                </button>
                <button
                  onClick={() =>
                    void task("Loading image models", async () => {
                      setStatus(await bridge.call("mediaStatus"));
                      const models = await bridge.call("imageModels");
                      setImageModels(models);
                      setImageModel(models[0]?.id ?? "");
                    })
                  }
                >
                  Load image models
                </button>
                <Field label="Image model">
                  <select
                    aria-label="Image model"
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                  >
                    <option value="">Select an available model</option>
                    {imageModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  className="primary"
                  disabled={
                    !status.gemini || !imageModel || !w.mascot.references.length
                  }
                  onClick={() =>
                    void task("Generating mascot variant…", async () => {
                      const result = await bridge.call("generateImage", {
                        model: imageModel,
                        prompt: mascotPrompt(p, variation),
                        references: w.mascot.references,
                        project: p,
                      });
                      const project = current();
                      s.change(
                        {
                          assets: [
                            ...project.assets,
                            {
                              id: crypto.randomUUID(),
                              name:
                                w.mascot.name + " — " + variation.slice(0, 50),
                              data: result.data,
                              kind: "variant",
                              mascot: w.mascot.name,
                            },
                          ],
                        },
                        "Generate mascot variant",
                      );
                    })
                  }
                >
                  Generate variant with Gemini
                </button>
              </details>
            </div>
          </div>
        )}
        {(tab === "voice" || tab === "sound") && (
          <div>
            <input
              ref={audioRef}
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.currentTarget.files ?? []);
                e.currentTarget.value = "";
                void task("Importing audio", () =>
                  importAudioFiles(files, audioLane),
                );
              }}
            />
            <div className="audio-production-sections">
              <section
                className="audio-production-section"
                hidden={tab !== "voice"}
                aria-label="Voice generation"
              >
                <h3>Voice generation</h3>
                <p className="muted">
                  Generate or import the full script first, then compose scenes
                  using the measured audio length. Scene narration takes
                  automatically fit their scene duration.
                </p>
                <Field label="Narration scope">
                  <select
                    value={fullScript ? "script" : "scene"}
                    onChange={(e) =>
                      setVoiceScope(e.target.value as "script" | "scene")
                    }
                  >
                    <option value="script">
                      Full script · before scene composition
                    </option>
                    <option value="scene">Selected scene</option>
                  </select>
                </Field>
                {voiceBlocked && (
                  <p className="muted">
                    {scene.locked
                      ? "Unlock the selected scene before adding its narration."
                      : "Mute the full-script narration take before adding a separate scene voice track."}
                  </p>
                )}
                <section
                  className="audio-import-section"
                  aria-label="Import audio"
                >
                  <h4>Import audio</h4>
                  <p className="muted">
                    Already have a recording? Import it here without an account
                    or API key. MP3, WAV or other browser-supported audio · up
                    to 30 MB per file.
                  </p>
                  <div
                    className="audio-import-zone"
                    data-dragging={audioDragging}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!voiceBlocked && !working && !busy)
                        setAudioDragging(true);
                    }}
                    onDragLeave={() => setAudioDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAudioDragging(false);
                      if (voiceBlocked || working || busy) return;
                      const files = Array.from(e.dataTransfer.files);
                      void task("Importing audio", () =>
                        importAudioFiles(files, "voice"),
                      );
                    }}
                  >
                    <strong>Drop your audio recording here</strong>
                    <button
                      className="primary"
                      disabled={!!voiceBlocked}
                      onClick={() => {
                        setAudioLane("voice");
                        audioRef.current?.click();
                      }}
                    >
                      Choose audio files
                    </button>
                    <small>
                      {fullScript
                        ? "Imports as full-script narration; compose scenes from its measured length."
                        : "Imports into the selected scene and fits its duration automatically."}
                    </small>
                  </div>
                  {importNotice && (
                    <p role="status" className="audio-import-status">
                      {importNotice}
                    </p>
                  )}
                </section>
                <details className="media-configuration" open>
                  <summary>ElevenLabs voice generation</summary>{" "}
                  <p className="muted">
                    Uses your ElevenLabs API credits. Manage the connection and
                    protected credential storage in Services. Generate a take
                    only when needed; changing visuals does not regenerate
                    audio.
                  </p>
                  <button onClick={onServices}>
                    Manage voice connection in Services
                  </button>
                  <button
                    onClick={() =>
                      void task("Loading ElevenLabs voices", async () => {
                        setStatus(await bridge.call("mediaStatus"));
                        const catalog = await bridge.call("elevenCatalog");
                        setVoices(catalog.voices);
                        setVoiceModels(catalog.models);
                        setVoiceModel((current) =>
                          catalog.models.some((m: any) => m.id === current)
                            ? current
                            : catalog.models.some(
                                  (m: any) => m.id === "eleven_v4",
                                )
                              ? "eleven_v4"
                              : (catalog.models[0]?.id ?? ""),
                        );
                        setVoice((v) =>
                          catalog.voices.some((a: any) => a.id === v)
                            ? v
                            : (catalog.voices[0]?.id ?? ""),
                        );
                      })
                    }
                  >
                    Load voices & models
                  </button>
                  <Field label="Voice">
                    <select
                      aria-label="Voice"
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                    >
                      <option value="">Select voice</option>
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Speech model">
                    <select
                      aria-label="Speech model"
                      value={voiceModel}
                      onChange={(e) => setVoiceModel(e.target.value)}
                    >
                      <option value="">Select a speech model</option>
                      {voiceModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="muted">
                    {fullScript
                      ? "Full script narration: "
                      : "Selected scene narration: "}
                    {narrationText || "Add narration text first."}
                  </p>
                  <button
                    className="primary"
                    disabled={
                      !status.eleven ||
                      !voice ||
                      !voiceModel ||
                      !narrationText.trim() ||
                      !!voiceBlocked
                    }
                    onClick={() =>
                      void task("Generating narration…", async () => {
                        const revision = useStudio.getState().revision;
                        if (narrationText.length > 10000)
                          throw Error(
                            "This voice provider supports up to 10,000 characters per take. Shorten the script or use scene narration takes.",
                          );
                        const result = await bridge.call("generateAudio", {
                          type: "voice",
                          voice,
                          model: voiceModel,
                          text: narrationText,
                        });
                        const details = await audioDetails(result.data);
                        const latest = current();
                        if (useStudio.getState().revision !== revision)
                          throw Error(
                            "Project changed while generating narration. The take was not applied; try again with the current project.",
                          );
                        if (
                          (fullScript
                            ? latest.workflow?.script
                            : latest.workflow?.scenes.find(
                                (item) => item.id === scene.id,
                              )?.narration) !== narrationText
                        )
                          throw Error(
                            "Narration text changed while generating. The take was not applied; generate again from the current text.",
                          );
                        addAudio({
                          ...clipFromAudio(
                            {
                              name:
                                (fullScript ? "Full script" : scene.title) +
                                " — narration take",
                              data: result.data,
                              ...details,
                            },
                            "voice",
                            fullScript ? undefined : scene.id,
                          ),
                          transcript: narrationText,
                        });
                      })
                    }
                  >
                    Generate narration take
                  </button>
                </details>
              </section>
              <section
                className="audio-production-section"
                hidden={tab !== "sound"}
                aria-label="SFX & background music"
              >
                <h3>SFX & background music</h3>
                <p className="muted">
                  Add sound effects and music separately. Background music ducks
                  beneath narration.
                </p>
                <div className="workflow-actions">
                  <select
                    aria-label="Audio import category"
                    value={audioLane === "voice" ? "sfx" : audioLane}
                    onChange={(e) =>
                      setAudioLane(e.target.value as AudioClip["lane"])
                    }
                  >
                    <option value="sfx">Sound effect</option>
                    <option value="music">Background music</option>
                  </select>
                  <button
                    onClick={() => {
                      if (audioLane === "voice") setAudioLane("sfx");
                      audioRef.current?.click();
                    }}
                  >
                    Import audio
                  </button>
                </div>

                <h4>Built-in synthesized sounds · no API</h4>
                <div className="sound-presets">
                  {builtinSounds.map((sound) => (
                    <button
                      key={sound.name}
                      onClick={() => {
                        const value = synthesizeSound(sound.name),
                          clip = clipFromAudio(
                            value,
                            value.lane,
                            value.lane === "music" ? undefined : w.selectedId,
                          );
                        clip.license = value.license;
                        if (clip.lane === "music")
                          clip.length = totalDuration({ ...p, workflow: w });
                        if (clip.lane === "sfx") clip.start = soundStart();
                        addAudio(clip);
                      }}
                    >
                      {sound.name}
                      <small>
                        {sound.lane === "music" ? "Music loop" : "SFX"}
                      </small>
                    </button>
                  ))}
                </div>

                <details className="media-configuration" open>
                  <summary>ElevenLabs sound effects</summary>
                  <button onClick={onServices}>
                    Manage sound connection in Services
                  </button>{" "}
                  <Field label="Custom sound effect">
                    <textarea
                      value={sfxPrompt}
                      onChange={(e) => setSFXPrompt(e.target.value)}
                    />
                  </Field>
                  <button
                    disabled={!status.eleven}
                    onClick={() =>
                      void task("Generating sound effect…", async () => {
                        const placement = soundStart();
                        const result = await bridge.call("generateAudio", {
                          type: "sfx",
                          text: sfxPrompt,
                          duration: 2,
                        });
                        const details = await audioDetails(result.data);
                        addAudio({
                          ...clipFromAudio(
                            {
                              name: sfxPrompt.slice(0, 100),
                              data: result.data,
                              ...details,
                            },
                            "sfx",
                            scene.id,
                          ),
                          start: placement,
                        });
                      })
                    }
                  >
                    Generate SFX
                  </button>
                </details>
              </section>
            </div>
            <div className="audio-clips">
              {[...(p.audio ?? [])]
                .filter((clip) =>
                  tab === "voice"
                    ? clip.lane === "voice"
                    : clip.lane !== "voice",
                )
                .sort(
                  (a, b) =>
                    Number(a.lane !== "voice") - Number(b.lane !== "voice"),
                )
                .map((clip, index, clips) => (
                  <article key={clip.id} className="audio-clip">
                    {(index === 0 ||
                      (clip.lane === "voice") !==
                        (clips[index - 1].lane === "voice")) && (
                      <h3>
                        {clip.lane === "voice"
                          ? "Narration takes"
                          : "Sound effects & music clips"}
                      </h3>
                    )}
                    <div className="audio-clip-heading">
                      <strong>{clip.name}</strong>
                      <span>
                        {clip.lane} · {clip.duration.toFixed(2)}s source
                      </span>
                      <button
                        title="Delete audio clip"
                        onClick={() =>
                          s.change(
                            { audio: p.audio?.filter((a) => a.id !== clip.id) },
                            "Remove audio",
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <audio controls src={clip.data} preload="metadata" />
                    <div className="audio-waveform" aria-label="Audio waveform">
                      {clip.peaks?.map((peak, i) => (
                        <i key={i} style={{ height: Math.max(2, peak * 40) }} />
                      ))}
                    </div>
                    <div className="audio-clip-controls">
                      {(
                        [
                          "start",
                          "trimIn",
                          "length",
                          "volume",
                          "fadeIn",
                          "fadeOut",
                        ] as const
                      ).map((key) => (
                        <Field key={key} label={key}>
                          <input
                            type="number"
                            min="0"
                            max={key === "volume" ? 1 : 600}
                            step=".1"
                            value={clip[key]}
                            onChange={(e) => {
                              const n = +e.target.value;
                              if (
                                n < 0 ||
                                (key === "length" && n <= 0) ||
                                (key === "volume" && n > 1) ||
                                (key === "trimIn" && n >= clip.duration) ||
                                ((key === "fadeIn" || key === "fadeOut") &&
                                  n > 60) ||
                                n > 600
                              )
                                return;
                              s.change(
                                {
                                  audio: p.audio?.map((a) =>
                                    a.id === clip.id ? { ...a, [key]: n } : a,
                                  ),
                                },
                                "Edit audio clip",
                              );
                            }}
                          />
                        </Field>
                      ))}
                      <Field label="Timeline scope">
                        <select
                          value={clip.sceneId ?? ""}
                          onChange={(e) =>
                            s.change(
                              {
                                audio: p.audio?.map((a) =>
                                  a.id === clip.id
                                    ? {
                                        ...a,
                                        sceneId: e.target.value || undefined,
                                      }
                                    : a,
                                ),
                              },
                              "Move audio scope",
                            )
                          }
                        >
                          <option value="">Master timeline</option>
                          {w.scenes.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <label>
                        <input
                          type="checkbox"
                          checked={clip.loop}
                          onChange={(e) =>
                            s.change(
                              {
                                audio: p.audio?.map((a) =>
                                  a.id === clip.id
                                    ? { ...a, loop: e.target.checked }
                                    : a,
                                ),
                              },
                              "Loop audio",
                            )
                          }
                        />{" "}
                        Loop
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={clip.muted}
                          onChange={(e) =>
                            s.change(
                              {
                                audio: p.audio?.map((a) =>
                                  a.id === clip.id
                                    ? { ...a, muted: e.target.checked }
                                    : a,
                                ),
                              },
                              "Mute audio",
                            )
                          }
                        />{" "}
                        Mute
                      </label>
                    </div>
                    <Field label="Source / license note">
                      <input
                        value={clip.license}
                        onChange={(e) =>
                          s.change(
                            {
                              audio: p.audio?.map((a) =>
                                a.id === clip.id
                                  ? { ...a, license: e.target.value }
                                  : a,
                              ),
                            },
                            "Edit audio attribution",
                          )
                        }
                      />
                    </Field>
                    {clip.lane === "voice" && clip.sceneId && (
                      <button
                        disabled={
                          clip.muted ||
                          clip.loop ||
                          w.scenes.find((a) => a.id === clip.sceneId)?.locked
                        }
                        onClick={() =>
                          updateScene(clip.sceneId!, {
                            duration: Math.max(
                              0.1,
                              clip.start + narrationLength(clip),
                            ),
                          })
                        }
                      >
                        Fit scene to this narration take
                      </button>
                    )}
                    {clip.lane === "voice" && !clip.sceneId && !clip.muted && (
                      <>
                        <button
                          onClick={() =>
                            void task(
                              "Composing scenes from narration",
                              async () =>
                                setPlan(localStoryboard(script), clip),
                            )
                          }
                        >
                          Compose scenes from this narration
                        </button>
                        {w.scenes.some((item) => item.narration.trim()) && (
                          <button
                            onClick={() =>
                              void task(
                                "Fitting scenes to narration",
                                async () => {
                                  const latest = current();
                                  const workflow = latest.workflow!;
                                  const scenes = timeScenesToNarration(
                                    workflow.scenes,
                                    clip,
                                    workflow.script,
                                  );
                                  s.change(
                                    {
                                      workflow: { ...workflow, scenes },
                                      settings: {
                                        ...latest.settings,
                                        duration: scenes.find(
                                          (item) =>
                                            item.id === workflow.selectedId,
                                        )!.duration,
                                      },
                                    },
                                    "Fit existing visuals to narration",
                                  );
                                  onNotice(
                                    "Existing scene visuals preserved; timing fitted to narration",
                                  );
                                },
                              )
                            }
                          >
                            Fit existing scenes to this narration
                          </button>
                        )}
                      </>
                    )}
                  </article>
                ))}
            </div>
            {!p.audio?.length && (
              <p className="muted">
                No audio yet. Import a recording, add a built-in sound, or
                connect ElevenLabs.
              </p>
            )}
          </div>
        )}
      </fieldset>
    </WorkflowSurface>
  );
}
