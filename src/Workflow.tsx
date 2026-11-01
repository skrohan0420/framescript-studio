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
import { useStudio } from "./store";
import { bridge } from "./bridge";
import { Modal, Field } from "./components";
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
} from "../shared/workflow";
import type { Project, Scene, AudioClip } from "../shared/project";
import { builtinSounds, synthesizeSound } from "../shared/audio";
import { readData, audioDetails, clipFromAudio } from "./audio";

export function SceneRail({
  master,
  onMaster,
  busy,
}: {
  master: boolean;
  onMaster: (value: boolean) => void;
  busy: boolean;
}) {
  const s = useStudio(),
    w = s.project.workflow;
  if (!w) return null;
  return (
    <div className="scene-rail">
      <div className="scene-rail-heading">
        <strong>SCENES · {w.scenes.length}</strong>
        <button
          disabled={busy}
          className={master ? "accent" : ""}
          onClick={() => onMaster(!master)}
        >
          {master ? "Edit scene" : "Master preview"}
        </button>
      </div>
      <div className="scene-rail-list">
        {w.scenes.map((scene, i) => (
          <button
            key={scene.id}
            disabled={busy}
            className={!master && scene.id === w.selectedId ? "active" : ""}
            onClick={() => {
              s.change(activateScene(s.project, scene.id), "Select scene");
              s.setTime(0);
              s.setPlaying(false);
              onMaster(false);
            }}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <strong>{scene.title}</strong>
            <small>
              {scene.duration.toFixed(1)}s {scene.locked ? "🔒" : ""}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Workflow({
  open,
  onClose,
  provider,
  model,
  busy,
  onMaster,
  onNotice,
}: {
  open: boolean;
  onClose: () => void;
  provider: string;
  model: string;
  busy: boolean;
  onMaster: (value: boolean) => void;
  onNotice: (message: string) => void;
}) {
  const s = useStudio(),
    p = s.project,
    w = p.workflow ?? initialWorkflow(p),
    scene = selectedScene(p) ?? w.scenes[0];
  const [tab, setTab] = useState("script"),
    [script, setScript] = useState(w.script),
    [working, setWorking] = useState(""),
    [error, setError] = useState("");
  const [component, setComponent] = useState("headline"),
    [text, setText] = useState("A clear idea. Beautifully explained."),
    [color, setColor] = useState("#67b4ff"),
    [font, setFont] = useState("Segoe UI");
  const [variation, setVariation] = useState(
      "Happy expression, waving hello, facing the viewer",
    ),
    [imageKey, setImageKey] = useState(""),
    [imageModel, setImageModel] = useState(""),
    [imageModels, setImageModels] = useState<any[]>([]),
    [status, setStatus] = useState({ gemini: false, eleven: false });
  const [elevenKey, setElevenKey] = useState(""),
    [voice, setVoice] = useState(""),
    [voiceModel, setVoiceModel] = useState("eleven_v4"),
    [voices, setVoices] = useState<any[]>([]),
    [voiceModels, setVoiceModels] = useState<any[]>([]),
    [sfxPrompt, setSFXPrompt] = useState("A soft, short cinematic whoosh");
  const [audioLane, setAudioLane] = useState<AudioClip["lane"]>("voice");
  const imagesRef = useRef<HTMLInputElement>(null),
    audioRef = useRef<HTMLInputElement>(null);
  const importKind = useRef<"reference" | "variant">("reference");
  useEffect(() => {
    if (open) {
      setScript(p.workflow?.script ?? "");
      void bridge
        .call("mediaStatus")
        .then(setStatus)
        .catch((e) => setError(e.message));
    }
  }, [open]);
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
  const setPlan = (plan: unknown) => {
    const p = current(),
      scenes = scenesFromPlan(script, plan, p);
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
    setTab("scenes");
  };
  const addAudio = (clip: AudioClip) => {
    const p = current();
    if (clip.sceneId && !p.workflow?.scenes.some((s) => s.id === clip.sceneId))
      throw Error("The target scene changed. Select a scene and try again.");
    s.change(
      {
        audio: [
          ...(p.audio ?? []).map((a) =>
            clip.lane === "voice" &&
            a.lane === "voice" &&
            a.sceneId === clip.sceneId
              ? { ...a, muted: true }
              : a,
          ),
          clip,
        ],
      },
      "Add audio",
    );
  };
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
    <Modal
      title="Storyboard & production workflow"
      wide
      open={open}
      onClose={onClose}
    >
      <nav className="workflow-tabs">
        {["script", "scenes", "components", "audio", "mascot"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t === "mascot"
              ? "Mascot & images"
              : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
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
                      setPlan(result);
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
                Suggested sequence: plan scenes → choose typography → add
                narration → fit scene durations → add mascot variants and sound
                → preview/export master.
              </p>
              <button
                onClick={() => {
                  if (!p.workflow)
                    s.change({ workflow: initialWorkflow(p) }, "Enable scenes");
                  setTab("scenes");
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
                      onClose();
                    }}
                  >
                    Edit this scene
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
                <Field label="Gemini API key (server session only)">
                  <input
                    type="password"
                    value={imageKey}
                    onChange={(e) => setImageKey(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <button
                  onClick={() =>
                    void task("Connecting Gemini", async () => {
                      if (imageKey) {
                        await bridge.call(
                          "mediaCredentials",
                          "gemini",
                          imageKey,
                        );
                        setImageKey("");
                      }
                      setStatus(await bridge.call("mediaStatus"));
                      const models = await bridge.call("imageModels");
                      setImageModels(models);
                      setImageModel(models[0]?.id ?? "");
                    })
                  }
                >
                  Connect / load image models
                </button>
                <Field label="Image model">
                  <select
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
        {tab === "audio" && (
          <div>
            <div className="workflow-two-columns">
              <div>
                <h3>Voice, SFX & background music</h3>
                <p className="muted">
                  Imported and built-in audio stays local. Music is ducked while
                  narration plays. Attach clips to a scene or keep them on the
                  master timeline.
                </p>
                <div className="workflow-actions">
                  <select
                    aria-label="Audio import category"
                    value={audioLane}
                    onChange={(e) =>
                      setAudioLane(e.target.value as AudioClip["lane"])
                    }
                  >
                    <option value="voice">Narration</option>
                    <option value="sfx">Sound effect</option>
                    <option value="music">Background music</option>
                  </select>
                  <button onClick={() => audioRef.current?.click()}>
                    Import audio
                  </button>
                </div>
                <input
                  ref={audioRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  hidden
                  onChange={(e) =>
                    void task("Importing audio", async () => {
                      if (!e.target.files) return;
                      for (const file of Array.from(e.target.files)) {
                        const data = await readData(file),
                          details = await audioDetails(data);
                        addAudio(
                          clipFromAudio(
                            { name: file.name, data, ...details },
                            audioLane,
                            audioLane === "music" ? undefined : w.selectedId,
                          ),
                        );
                      }
                      e.target.value = "";
                    })
                  }
                />
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
              </div>
              <div>
                <details className="media-configuration">
                  <summary>ElevenLabs voice & sound generation</summary>
                  <p className="muted">
                    Uses your ElevenLabs API credits. The key stays in Node
                    memory until restart. Generate a take only when needed;
                    changing visuals does not regenerate audio.
                  </p>
                  <Field label="ElevenLabs API key">
                    <input
                      type="password"
                      value={elevenKey}
                      onChange={(e) => setElevenKey(e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                  <button
                    onClick={() =>
                      void task("Connecting ElevenLabs", async () => {
                        if (elevenKey) {
                          await bridge.call(
                            "mediaCredentials",
                            "eleven",
                            elevenKey,
                          );
                          setElevenKey("");
                        }
                        setStatus(await bridge.call("mediaStatus"));
                        const catalog = await bridge.call("elevenCatalog");
                        setVoices(catalog.voices);
                        setVoiceModels(catalog.models);
                        setVoice(catalog.voices[0]?.id ?? "");
                      })
                    }
                  >
                    Connect / load voices
                  </button>
                  <Field label="Voice">
                    <select
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
                      value={voiceModel}
                      onChange={(e) => setVoiceModel(e.target.value)}
                    >
                      <option value="eleven_v4">Eleven v4</option>
                      {voiceModels
                        .filter((m) => m.id !== "eleven_v4")
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <p className="muted">
                    Selected scene narration:{" "}
                    {scene.narration ||
                      "Add narration in the Scenes tab first."}
                  </p>
                  <button
                    className="primary"
                    disabled={!status.eleven || !voice || !scene.narration}
                    onClick={() =>
                      void task("Generating narration…", async () => {
                        const result = await bridge.call("generateAudio", {
                          type: "voice",
                          voice,
                          model: voiceModel,
                          text: scene.narration,
                        });
                        const details = await audioDetails(result.data);
                        addAudio(
                          clipFromAudio(
                            {
                              name: scene.title + " — narration take",
                              data: result.data,
                              ...details,
                            },
                            "voice",
                            scene.id,
                          ),
                        );
                      })
                    }
                  >
                    Generate narration take
                  </button>
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
                        const result = await bridge.call("generateAudio", {
                          type: "sfx",
                          text: sfxPrompt,
                          duration: 2,
                        });
                        const details = await audioDetails(result.data);
                        addAudio(
                          clipFromAudio(
                            {
                              name: sfxPrompt.slice(0, 100),
                              data: result.data,
                              ...details,
                            },
                            "sfx",
                            scene.id,
                          ),
                        );
                      })
                    }
                  >
                    Generate SFX
                  </button>
                </details>
              </div>
            </div>
            <div className="audio-clips">
              {(p.audio ?? []).map((clip) => (
                <article key={clip.id} className="audio-clip">
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
                        w.scenes.find((a) => a.id === clip.sceneId)?.locked
                      }
                      onClick={() =>
                        updateScene(clip.sceneId!, {
                          duration: Math.max(0.1, clip.start + clip.length),
                        })
                      }
                    >
                      Fit scene to this narration take
                    </button>
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
    </Modal>
  );
}
