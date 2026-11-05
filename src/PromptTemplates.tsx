import { PromptAnimation } from "./PromptAnimation";
import { restoreTechniques } from "../shared/animation-techniques";
import { useEffect, useRef, useState } from "react";
import {
  Clipboard,
  ClipboardPaste,
  RotateCcw,
  Timer,
  Music,
  Sparkles,
  Code2,
  Layers,
  Type,
  Orbit,
  Wrench,
  Check,
  X,
  Palette,
  Fingerprint,
  Cat,
  SlidersHorizontal,
} from "lucide-react";
import { useProjectState } from "./store";
import { sceneOffset } from "../shared/workflow";
import { transcriptSrt, voiceoverWordsForScene } from "../shared/transcript";
import { parseNarrationInput } from "../shared/narration-input";
import { PromptTypography } from "./PromptTypography";
import { PromptMascot } from "./PromptMascot";
import { PromptTemplateChoice } from "./PromptTemplateChoice";
import { PromptDirectionStudio } from "./PromptDirectionStudio";
import { promptTextListSchema } from "../shared/prompt-text";
import {
  buildCodePrompt,
  artStyles,
  promptTemplates,
  type PromptDraft,
} from "../shared/prompt-templates";

const storageKey = "framescript.prompt-draft.v1";
const fieldSuggestions = {
  script: [
    [
      "Hook & reveal",
      "Start with a surprising question, reveal the answer, then finish with a clear takeaway.",
    ],
    [
      "Explainer",
      "Introduce the subject, explain how it works step by step, and summarize the main idea.",
    ],
    [
      "Short story",
      "Introduce a character and a problem, show the turning point, then reveal the outcome.",
    ],
    [
      "Product demo",
      "Show the problem, demonstrate the product in use, and highlight the benefit.",
    ],
  ],
  visuals: [
    [
      "Smooth transitions",
      "Connect visual beats with smooth, motivated transitions.",
    ],
    [
      "Particles",
      "Use purposeful particles to show energy, movement, or scale.",
    ],
    [
      "Diagram",
      "Build a clear diagram step by step to support the explanation.",
    ],
    [
      "Before / after",
      "Show a visually consistent before-and-after transformation.",
    ],
    [
      "Layers & depth",
      "Create foreground, subject and background layers with subtle depth.",
    ],
    [
      "Match narration",
      "Reveal each subject or action exactly when the narration introduces it.",
    ],
  ],
  camera: [
    ["Slow push-in", "Use a slow, smooth push-in toward the main subject."],
    [
      "Wide shot",
      "Use a wide establishing shot with clear subject separation.",
    ],
    ["Close-up", "Use a close-up to emphasize the important detail."],
    [
      "Follow subject",
      "Track the main subject smoothly while keeping it clearly framed.",
    ],
    [
      "Parallax",
      "Use subtle parallax between foreground and background layers.",
    ],
    [
      "Static",
      "Keep the camera fixed and let the subject animation carry the scene.",
    ],
  ],
  screenText: [
    ["No text", ""],
    ["Headline", "YOUR HEADLINE"],
    ["Key number", "42%"],
    ["Call to action", "Learn more"],
  ],
  notes: [
    [
      "Consistent design",
      "Keep character design, palette, lighting and visual style consistent throughout.",
    ],
    [
      "Safe margins",
      "Keep important subjects and text inside a 10% safe margin.",
    ],
    [
      "No flashing",
      "Avoid flashing lights, rapid strobing and excessive camera shake.",
    ],
    ["Seamless loop", "Make the ending connect smoothly to the opening frame."],
    [
      "Narration sync",
      "Align visual emphasis and transitions to the supplied narration timestamps.",
    ],
    [
      "Smooth motion",
      "Use deliberate easing and clear anticipation; avoid abrupt or distracting motion.",
    ],
  ],
} as const;
export function PromptTemplates({
  onPaste,
  master = false,
  onClose,
  onGenerateScene,
}: {
  onPaste: () => void;
  master?: boolean;
  onClose?: () => void;
  onGenerateScene?: (brief: string, duration: number) => void;
}) {
  const { project } = useProjectState();
  const defaults: PromptDraft = {
    template: "canvas",
    script: "",
    timedNarration: "",
    duration: project.settings.duration,
    bgm: false,
    sfx: false,
    style: "Cinematic, consistent colors, smooth deliberate motion",
    visuals: "",
    camera: "",
    screenText: "",
    notes: "",
    format: "document",
    consistency: true,
    typographyEnabled: false,
    mascotEnabled: false,
    textItems: [],
  };
  const [draft, setDraft] = useState<PromptDraft>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (!saved || typeof saved !== "object") return defaults;
      const restored = { ...defaults };
      restored.animationTechniques = restoreTechniques(
        saved.animationTechniques,
      );
      if (["auto", "2d", "2.5d", "3d"].includes(saved.renderingMode))
        restored.renderingMode = saved.renderingMode;
      for (const key of [
        "bgm",
        "sfx",
        "consistency",
        "typographyEnabled",
        "mascotEnabled",
      ] as const)
        if (typeof saved[key] === "boolean") restored[key] = saved[key];
      for (const key of [
        "script",
        "timedNarration",
        "style",
        "referenceStyle",
        "editingStyle",
        "referenceInfluence",
        "referenceNotes",
        "pacingEnergy",
        "transitionPreference",
        "editingNotes",
        "animationIntensity",
        "animationEasing",
        "animationSync",
        "subtitles",
        "textFont",
        "textScale",
        "textPlacement",
        "textAnimation",
        "textTreatment",
        "textColor",
        "titlePlacement",
        "captionPlacement",
        "textAlign",
        "textFill",
        "textAccent",
        "textBacking",
        "visuals",
        "camera",
        "screenText",
        "notes",
        "audience",
        "storyStructure",
        "mood",
        "palette",
        "lighting",
        "characters",
        "environment",
        "motion",
        "avoid",
        "mascotName",
        "mascotIdentity",
        "mascotRole",
        "mascotActions",
        "mascotPlacement",
        "mascotScale",
        "mascotTiming",
        "mascotNotes",
      ] as const)
        if (typeof saved[key] === "string") restored[key] = saved[key];
      if (promptTemplates.some((item) => item.id === saved.template))
        restored.template = saved.template;
      const items = promptTextListSchema.safeParse(saved.textItems);
      if (items.success) restored.textItems = items.data;
      for (const [key, min, max] of [
        ["titleSize", 8, 600],
        ["captionSize", 8, 300],
        ["textWeight", 100, 900],
        ["textLineHeight", 0.8, 2.5],
        ["textTracking", -5, 20],
        ["textAnimationDuration", 0.1, 3],
        ["captionLines", 1, 3],
      ] as const) {
        if (
          typeof saved[key] === "number" &&
          saved[key] >= min &&
          saved[key] <= max
        )
          restored[key] = saved[key];
      }
      if (
        typeof saved.duration === "number" &&
        saved.duration >= 0.1 &&
        saved.duration <= 600
      )
        restored.duration = saved.duration;
      if (["document", "separate"].includes(saved.format))
        restored.format = saved.format;
      return restored;
    } catch {
      return defaults;
    }
  });
  const [includeCode, setIncludeCode] = useState(false);
  const [durationInput, setDurationInput] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [timedVoiceId, setTimedVoiceId] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(() => {
    try {
      const saved = localStorage.getItem("framescript.prompt-tab");
      return [
        "brief",
        "look",
        "reference",
        "animation",
        "pacing",
        "identity",
        "mascot",
        "typography",
        "details",
        "output",
      ].includes(saved ?? "")
        ? saved!
        : "brief";
    } catch {
      return "brief";
    }
  });
  const selectSection = (section: string) => {
    setActiveSection(section);
    try {
      localStorage.setItem("framescript.prompt-tab", section);
    } catch {}
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  useEffect(() => {
    if (!onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {}
  }, [draft]);
  const update = <K extends keyof PromptDraft>(
    key: K,
    value: PromptDraft[K],
  ) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "script" ? { timedNarration: "" } : {}),
    }));
    setStatus("");
  };
  const suggestions = (key: keyof typeof fieldSuggestions) => (
    <div
      className="prompt-field-suggestions"
      role="group"
      aria-label={`${key} suggestions`}
    >
      {fieldSuggestions[key].map(([label, value]) => (
        <button
          key={label}
          type="button"
          aria-pressed={
            key === "script" ? draft.storyStructure === value : undefined
          }
          title={value || "Keep the animation free of on-screen text"}
          onClick={() => {
            if (key === "script") {
              update(
                "storyStructure",
                draft.storyStructure === value ? "" : value,
              );
              return;
            }
            const current = draft[key];
            update(
              key,
              key === "screenText"
                ? value
                : current.includes(value)
                  ? current
                  : [current.trim(), value].filter(Boolean).join("\n"),
            );
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
  const voice = project.audio
    ?.filter(
      (clip) =>
        clip.lane === "voice" &&
        !clip.muted &&
        (!clip.sceneId || clip.sceneId === project.workflow?.selectedId),
    )
    .at(-1);
  const timedVoices = (project.audio ?? []).filter(
    (clip) =>
      clip.lane === "voice" &&
      !clip.muted &&
      (!clip.sceneId || clip.sceneId === project.workflow?.selectedId) &&
      clip.transcriptWords?.length,
  );
  const timedVoice = timedVoices.find((clip) => clip.id === timedVoiceId);
  const useTimedVoice = () => {
    if (!timedVoices.length) return;
    const offset = project.workflow
      ? sceneOffset(project, project.workflow.selectedId)
      : 0;
    const words = (timedVoice ? [timedVoice] : timedVoices)
      .flatMap((clip) =>
        voiceoverWordsForScene(clip, project.settings.duration, offset),
      )
      .sort((a, b) => a.start - b.start);
    if (!words.length) {
      setStatus(
        "No timed speech falls inside this scene. Check the clip’s position and trim.",
      );
      return;
    }
    setDraft((previous) => ({
      ...previous,
      script: words.map((word) => word.text).join(" "),
      timedNarration: transcriptSrt(words),
      duration: project.settings.duration,
    }));
    setDurationInput(null);
    setStatus(
      "Timed voiceover added. Cue times follow the audio’s trim and position in this scene.",
    );
  };
  let prompt = "",
    promptError = "";
  try {
    prompt = buildCodePrompt(
      draft,
      project.settings.width,
      project.settings.height,
      includeCode ? project : undefined,
    );
  } catch (error) {
    promptError = (error as Error).message;
  }
  const icons = {
    canvas: Orbit,
    motion: Layers,
    explain: Sparkles,
    type: Type,
    depth: Orbit,
    repair: Wrench,
    data: SlidersHorizontal,
    process: Layers,
    product: Sparkles,
    isometric: Layers,
    particles: Sparkles,
    map: Orbit,
    comparison: Layers,
    loop: RotateCcw,
  };
  const descriptions = {
    canvas: "Procedural visuals",
    motion: "Shapes & transitions",
    explain: "Diagrams & concepts",
    type: "Animated text",
    depth: "Depth & camera moves",
    repair: "Fix pasted code",
    data: "Charts & values",
    process: "Stages & connections",
    product: "Features & close-ups",
    isometric: "Angled illustrations",
    particles: "Forces & movement",
    map: "Locations & journeys",
    comparison: "Side-by-side stories",
    loop: "Continuous cycles",
  };
  return (
    <section className="prompt-templates" aria-label="Prompt templates">
      <div className="prompt-heading">
        <div>
          <h3 title="Describe your animation, copy the prompt to GPT, then paste the generated code.">
            <Sparkles size={17} /> Prompt builder
          </h3>
          <p>Brief → style → copy → create.</p>
        </div>
        <button
          title="Reset prompt fields"
          aria-label="Reset prompt fields"
          onClick={() => {
            setDraft(defaults);
            setDurationInput(null);
            setIncludeCode(false);
            setStatus("");
          }}
        >
          <RotateCcw size={16} />
        </button>
        {onClose && (
          <button
            aria-label="Close prompt builder"
            title="Close prompt builder"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div
        className="prompt-section-nav"
        role="tablist"
        aria-label="Prompt sections"
      >
        {[
          ["brief", "Brief"],
          ["look", "Visuals"],
          ["reference", "Reference look"],
          ["animation", "Animation"],
          ["pacing", "Editing & pacing"],
          ["identity", "Identity"],
          ["mascot", "Mascot"],
          ["typography", "Typography"],
          ["details", "Details"],
          ["output", "Output"],
        ].map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-label={label}
            title={label}
            id={`prompt-tab-${id}`}
            aria-controls={`prompt-panel-${id}`}
            aria-selected={activeSection === id}
            tabIndex={activeSection === id ? 0 : -1}
            onKeyDown={(event) => {
              const ids = [
                "brief",
                "look",
                "reference",
                "animation",
                "pacing",
                "identity",
                "mascot",
                "typography",
                "details",
                "output",
              ];
              const index = ids.indexOf(id);
              const next =
                event.key === "ArrowRight"
                  ? ids[(index + 1) % ids.length]
                  : event.key === "ArrowLeft"
                    ? ids[(index + ids.length - 1) % ids.length]
                    : event.key === "Home"
                      ? ids[0]
                      : event.key === "End"
                        ? ids.at(-1)
                        : undefined;
              if (!next) return;
              event.preventDefault();
              selectSection(next);
              document.getElementById(`prompt-tab-${next}`)?.focus();
            }}
            onClick={() => selectSection(id)}
          >
            {id === "brief" ? (
              <Clipboard size={17} />
            ) : id === "look" ? (
              <Palette size={17} />
            ) : id === "reference" ? (
              <Sparkles size={17} />
            ) : id === "animation" ? (
              <Orbit size={17} />
            ) : id === "pacing" ? (
              <Timer size={17} />
            ) : id === "identity" ? (
              <Fingerprint size={17} />
            ) : id === "mascot" ? (
              <Cat size={17} />
            ) : id === "typography" ? (
              <Type size={17} />
            ) : id === "details" ? (
              <SlidersHorizontal size={17} />
            ) : (
              <Code2 size={17} />
            )}
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="prompt-form-scroll" ref={scrollRef}>
        <div
          className="prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-animation"
          aria-labelledby="prompt-tab-animation"
          hidden={activeSection !== "animation"}
        >
          <PromptAnimation draft={draft} update={update} />
        </div>
        <div
          className="prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-brief"
          aria-labelledby="prompt-tab-brief"
          hidden={activeSection !== "brief"}
        >
          <div
            className="prompt-section-caption"
            data-prompt-section="brief"
            tabIndex={-1}
          >
            <strong>What are you making?</strong>
            <span>Choose a format, then add your story.</span>
          </div>
          <div
            className="prompt-template-grid"
            role="group"
            aria-label="Animation templates"
          >
            {promptTemplates.map((item) => {
              const Icon = icons[item.id];
              return (
                <PromptTemplateChoice
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  selected={draft.template === item.id}
                  onSelect={() => {
                    update("template", item.id);
                    if (item.id === "repair") setIncludeCode(true);
                  }}
                >
                  <Icon size={17} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{descriptions[item.id]}</small>
                  </span>
                  {draft.template === item.id && (
                    <Check size={13} className="template-selected-check" />
                  )}
                </PromptTemplateChoice>
              );
            })}
          </div>
          <div className="prompt-form-card">
            <div className="prompt-card-heading">
              <strong>The brief</strong>
              <span>
                {project.settings.width} × {project.settings.height}
              </span>
            </div>
            <label className="field">
              <span>Audience & goal</span>
              <input
                aria-label="Audience & goal"
                placeholder="Who is this for, and what should they understand?"
                value={draft.audience ?? ""}
                onChange={(e) => update("audience", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Script / narration</span>
              <textarea
                aria-label="Prompt script"
                rows={3}
                placeholder="Paste your script, SRT, VTT or timestamped narration…"
                maxLength={100000}
                value={draft.timedNarration || draft.script}
                onChange={(event) => {
                  const parsed = parseNarrationInput(event.target.value);
                  setDraft((previous) => ({
                    ...previous,
                    script: parsed.script,
                    timedNarration: parsed.timedNarration,
                  }));
                  setStatus("");
                }}
              />
              <small className="prompt-input-format">
                {draft.timedNarration
                  ? `${parseNarrationInput(draft.timedNarration).format} · timing detected`
                  : "Plain text · timing inferred"}
              </small>
            </label>
            <div className="prompt-story-direction">
              <small>Story direction · optional</small>
              {suggestions("script")}
            </div>
            <div className="prompt-timed-toolbar">
              {timedVoices.length > 1 && (
                <select
                  aria-label="Timed voiceover source"
                  value={timedVoice?.id ?? ""}
                  onChange={(event) => setTimedVoiceId(event.target.value)}
                >
                  <option value="">All voiceover clips in this scene</option>
                  {timedVoices.map((clip) => (
                    <option key={clip.id} value={clip.id}>
                      {clip.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                disabled={!timedVoices.length}
                title={
                  timedVoices.length
                    ? "Use word timestamps from the voiceover, aligned to its scene position and trim"
                    : "Extract the voiceover text first to get word timestamps"
                }
                onClick={useTimedVoice}
              >
                <Timer size={14} /> Use timed voiceover
              </button>
            </div>
            <div className="prompt-timing">
              <label className="field">
                <span>Duration (seconds)</span>
                <input
                  aria-label="Prompt duration (seconds)"
                  type="number"
                  min="0.1"
                  max="600"
                  step="0.1"
                  value={durationInput ?? Number(draft.duration.toFixed(2))}
                  onFocus={(event) =>
                    setDurationInput(event.currentTarget.value)
                  }
                  onChange={(event) => {
                    setDurationInput(event.target.value);
                    const value = Number(event.target.value);
                    if (value >= 0.1 && value <= 600) update("duration", value);
                  }}
                  onBlur={() => setDurationInput(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </label>
              <button
                title="Use active timeline duration"
                aria-label="Use active timeline duration"
                onClick={() => update("duration", project.settings.duration)}
              >
                <Timer size={16} />
              </button>
              <button
                disabled={!voice}
                title="Use the active narration clip length"
                aria-label="Use narration duration"
                onClick={() => voice && update("duration", voice.length)}
              >
                <Music size={16} />
              </button>
            </div>
            <div
              className="prompt-field-suggestions"
              role="group"
              aria-label="Duration suggestions"
            >
              {[5, 10, 15, 30, 60].map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => {
                    update("duration", duration);
                    setDurationInput(null);
                  }}
                >
                  {duration}s
                </button>
              ))}
            </div>
            <div className="prompt-audio-options">
              <label className="prompt-check">
                <input
                  type="checkbox"
                  checked={draft.bgm ?? false}
                  onChange={(event) => update("bgm", event.target.checked)}
                />
                BGM
              </label>
              <label className="prompt-check">
                <input
                  type="checkbox"
                  checked={draft.sfx ?? false}
                  onChange={(event) => update("sfx", event.target.checked)}
                />
                SFX
              </label>
            </div>
            {(draft.bgm || draft.sfx) && (
              <p className="type-hint">
                The generated code will include a soundtrack. Paste the full
                response to create real BGM/SFX tracks automatically.
              </p>
            )}
          </div>
        </div>
        <div
          className="prompt-form-card prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-look"
          aria-labelledby="prompt-tab-look"
          hidden={activeSection !== "look"}
          data-prompt-section="look"
          tabIndex={-1}
        >
          <div className="prompt-card-heading">
            <strong>Visual subjects & art direction</strong>
            <span>Optional</span>
          </div>
          {(
            [
              ["visuals", "Visual subjects / action"],
              ["style", "Visual style"],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <textarea
                aria-label={label}
                rows={2}
                placeholder={
                  key === "visuals"
                    ? "What should we see? Subjects, action, transitions…"
                    : "Palette, lighting, illustration style…"
                }
                value={draft[key]}
                onChange={(event) => update(key, event.target.value)}
              />
              {key === "visuals" && suggestions("visuals")}
            </label>
          ))}
          <div className="prompt-style-chips" aria-label="Style suggestions">
            {artStyles.map(([style, description]) => (
              <button
                key={style}
                aria-label={`Use ${style.toLowerCase()} style`}
                title={description}
                aria-pressed={draft.style === `${style}: ${description}`}
                onClick={() => update("style", `${style}: ${description}`)}
              >
                {style}
              </button>
            ))}
          </div>
        </div>
        <div
          className="prompt-form-card prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-reference"
          aria-labelledby="prompt-tab-reference"
          hidden={activeSection !== "reference"}
        >
          <PromptDirectionStudio
            kind="reference"
            draft={draft}
            update={update}
          />
        </div>
        <div
          className="prompt-form-card prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-pacing"
          aria-labelledby="prompt-tab-pacing"
          hidden={activeSection !== "pacing"}
        >
          <PromptDirectionStudio kind="pacing" draft={draft} update={update} />
        </div>
        <div
          className="prompt-form-card prompt-design-guide prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-identity"
          aria-labelledby="prompt-tab-identity"
          hidden={activeSection !== "identity"}
          data-prompt-section="identity"
          tabIndex={-1}
        >
          <div className="prompt-card-heading">
            <strong>Visual consistency guide</strong>
            <span>Reused across every beat</span>
          </div>
          <label className="prompt-check">
            <input
              type="checkbox"
              checked={draft.consistency !== false}
              onChange={(e) => update("consistency", e.target.checked)}
            />
            Lock visual identity across shots
          </label>
          <p className="type-hint">
            Define recurring details once. Copy this guide with every scene to
            keep the same visual language.
          </p>
          {(
            [
              [
                "palette",
                "Color palette",
                "e.g. Midnight #101827, ivory #F5F0E8, coral #FF7861",
              ],
              [
                "characters",
                "Character / subject identity",
                "Silhouette, proportions, clothing, materials and signature details…",
              ],
              [
                "environment",
                "World & environment",
                "Location, recurring props, scale and background treatment…",
              ],
              [
                "lighting",
                "Lighting",
                "e.g. Soft key light from upper left, warm highlights, gentle shadows",
              ],
              [
                "mood",
                "Mood & atmosphere",
                "e.g. Curious, optimistic, calm and spacious",
              ],
              [
                "motion",
                "Motion & transitions",
                "e.g. Slow anticipation, spring-free easing, match-cut transitions",
              ],
              [
                "avoid",
                "Avoid / negative direction",
                "Unwanted colors, effects, objects or style changes…",
              ],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <textarea
                aria-label={label}
                rows={2}
                placeholder={placeholder}
                value={draft[key] ?? ""}
                onChange={(e) => update(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <div
          className="prompt-form-card prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-mascot"
          aria-labelledby="prompt-tab-mascot"
          hidden={activeSection !== "mascot"}
        >
          <PromptMascot draft={draft} update={update} />
        </div>
        <div
          className="prompt-form-card prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-typography"
          aria-labelledby="prompt-tab-typography"
          hidden={activeSection !== "typography"}
        >
          <PromptTypography
            draft={draft}
            update={update}
            width={project.settings.width}
            height={project.settings.height}
          />
        </div>
        <div
          className="prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-details"
          aria-labelledby="prompt-tab-details"
          hidden={activeSection !== "details"}
        >
          <details
            open
            className="prompt-options"
            data-prompt-section="details"
            tabIndex={-1}
          >
            <summary>
              Fine-tune the animation{" "}
              <small>Camera, text & extra direction</small>
            </summary>
            <div className="prompt-options-content">
              {(
                [
                  ["camera", "Camera / framing"],
                  ["notes", "Additional requirements"],
                ] as const
              ).map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <textarea
                    aria-label={label}
                    rows={2}
                    value={draft[key]}
                    onChange={(event) => update(key, event.target.value)}
                  />
                  {suggestions(key)}
                </label>
              ))}
            </div>
          </details>
        </div>
        <div
          className="prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-output"
          aria-labelledby="prompt-tab-output"
          hidden={activeSection !== "output"}
        >
          <details
            className="prompt-options"
            data-prompt-section="output"
            tabIndex={-1}
            open
          >
            <summary>
              Output settings{" "}
              <small>
                {draft.format === "document"
                  ? "Single HTML document"
                  : "Three code blocks"}
              </small>
            </summary>
            <div className="prompt-options-content">
              <label className="field">
                <span>GPT output format</span>
                <select
                  aria-label="Prompt output format"
                  value={draft.format}
                  onChange={(event) =>
                    update(
                      "format",
                      event.target.value as PromptDraft["format"],
                    )
                  }
                >
                  <option value="document">One complete HTML document</option>
                  <option value="separate">
                    Separate HTML / CSS / JavaScript blocks
                  </option>
                </select>
              </label>
              <label className="prompt-check">
                <input
                  type="checkbox"
                  checked={includeCode}
                  onChange={(event) => setIncludeCode(event.target.checked)}
                />{" "}
                Include active timeline code for repair or adaptation
              </label>
            </div>
          </details>
          <p className="muted">
            Draft saved on this device. No AI connection required. Text stays
            off-screen unless you specify it.
          </p>
          <details>
            <summary>Preview generated prompt</summary>
            <textarea
              aria-label="Generated prompt"
              rows={14}
              value={prompt}
              readOnly
            />
          </details>
        </div>
      </div>
      <div className="prompt-actions">
        {promptError && <p role="alert">{promptError}</p>}
        <div className="prompt-ready">
          <span className="live-dot" />
          <span>
            {Number(draft.duration.toFixed(2))}s ·{" "}
            {draft.format === "document" ? "HTML document" : "3 code blocks"}
          </span>
        </div>
        <div className="prompt-action-buttons">
          {onGenerateScene && (
            <button
              onClick={() =>
                onGenerateScene(
                  [draft.visuals, draft.timedNarration || draft.script]
                    .filter(Boolean)
                    .join("\n\n")
                    .slice(0, 12000),
                  draft.duration,
                )
              }
            >
              Generate structured scene
            </button>
          )}
          <button
            className="primary"
            title="Copy prompt"
            disabled={!!promptError}
            aria-label="Copy prompt"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prompt);
                setStatus("Prompt copied. Paste it into GPT.");
              } catch {
                setStatus(
                  "Clipboard unavailable. Expand the prompt preview and copy its text.",
                );
              }
            }}
          >
            <Clipboard size={17} />
            Copy
          </button>
          <button
            title="Paste GPT response"
            aria-label="Paste GPT response"
            onClick={onPaste}
          >
            <ClipboardPaste size={17} />
            Paste
          </button>
        </div>
        <span role="status">{status}</span>
      </div>
    </section>
  );
}
