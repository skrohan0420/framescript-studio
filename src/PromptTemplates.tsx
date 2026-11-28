import { ExpandableTextarea } from "./ExpandableTextarea";
import { useStatusActivity, useStatusNotice } from "./editor-status";
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
  X,
  Fingerprint,
  Cat,
  Clapperboard,
  Package,
} from "lucide-react";
import { useProjectState, useStudio } from "./store";
import { sceneOffset } from "../shared/workflow";
import { transcriptSrt, voiceoverWordsForScene } from "../shared/transcript";
import { parseNarrationInput } from "../shared/narration-input";
import { PromptMascot } from "./PromptMascot";
import { readReferenceConfig } from "../shared/reference-config";
import {
  buildCodePrompt,
  buildStructuredSceneBrief,
  type PromptDraft,
} from "../shared/prompt-templates";
import {
  buildGeneratePrompt,
  generateInputSchema,
  type GenerateInput,
} from "../shared/structured-generate";
import {
  buildCodeGeneratePrompt,
  codeGenerateInputSchema,
  type CodeGenerateInput,
} from "../shared/code-generate";
import { buildDirectorPrompt } from "../shared/director-prompt";
import { buildIdentityPrompt } from "../shared/identity-prompt";
import { projectPackageContext } from "../shared/package-naming";
import { bridge, download } from "./bridge";

const outputKey = "framescript.prompt-output";
type GenerateOutput = CodeGenerateInput["format"] | "structured";
type GeneratePackage =
  | { kind: "code"; input: CodeGenerateInput }
  | { kind: "structured"; input: GenerateInput };
const outputLabels: Record<GenerateOutput, string> = {
  document: "Full HTML document",
  separate: "Separate HTML, CSS, and JavaScript",
  structured: "Editable structured scene",
};
export function PromptTemplates({
  master = false,
  onClose,
  onReviewGeneratedScene,
  onOpenCode,
  onCodeTaskExported,
}: {
  master?: boolean;
  onClose?: () => void;
  onReviewGeneratedScene: () => void;
  onOpenCode: (pasteDocument: boolean) => void;
  onCodeTaskExported: (context: string, sceneId: string, session: number) => void;
}) {
  const { project } = useProjectState();
  const defaults: PromptDraft = {
    template: "canvas",
    script: "",
    timedNarration: "",
    duration: project.settings.duration,
    bgm: false,
    sfx: false,
    style: "",
    visuals: "",
    camera: "",
    screenText: "",
    notes: "",
    format: "document",
    consistency: true,
    mascotEnabled: false,
    ...readReferenceConfig(project.promptDraft),
  };
  const draft: PromptDraft = (() => {
    try {
      const saved = project.promptDraft;
      if (!saved || typeof saved !== "object") return defaults;
      const restored = { ...defaults };
      for (const key of [
        "bgm",
        "sfx",
        "consistency",
        "mascotEnabled",
      ] as const)
        if (typeof saved[key] === "boolean") restored[key] = saved[key];
      for (const key of [
        "script",
        "selectedDirection",
        "fullScript",
        "identityGuide",
        "timedNarration",
        "referenceStyle",
        "referenceInfluence",
        "referenceNotes",
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
      if (
        typeof saved.duration === "number" &&
        saved.duration >= 0.1 &&
        saved.duration <= 600
      )
        restored.duration = saved.duration;
      return restored;
    } catch {
      return defaults;
    }
  })();
  const setDraft = (value: PromptDraft | ((previous: PromptDraft) => PromptDraft)) => {
    const next = typeof value === "function" ? value(draft) : value;
    useStudio.getState().change({
      promptDraft: { ...next, ...readReferenceConfig(project.promptDraft) },
    }, "Prompt builder edit");
  };
  const [includeCode, setIncludeCode] = useState(false);
  const [output, setOutput] = useState<GenerateOutput>(() => {
    try {
      const saved = localStorage.getItem(outputKey);
      if (saved === "separate" || saved === "structured") return saved;
    } catch {}
    return "document";
  });
  useEffect(() => {
    try {
      localStorage.setItem(outputKey, output);
    } catch {}
  }, [output]);
  const [busy, setBusy] = useState(false);
  const [durationInput, setDurationInput] = useState<string | null>(null);
  const notify = useStatusNotice();
  useStatusActivity(busy ? "Preparing prompt package…" : "");
  const [uncopiedPrompt, setUncopiedPrompt] = useState("");
  const [timedVoiceId, setTimedVoiceId] = useState("");
  const [narrationSource, setNarrationSource] = useState<{
    text: string;
    names: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(() => {
    try {
      const saved = localStorage.getItem("framescript.prompt-tab");
      return [
        "brief",
        "identity",
        "mascot",
        "direction",
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
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  const update = <K extends keyof PromptDraft>(
    key: K,
    value: PromptDraft[K],
  ) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "script" ? { timedNarration: "" } : {}),
    }));

  };
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
      notify(
        "No timed speech falls inside this scene. Check the clip’s position and trim.",
      );
      return;
    }
    const narration = transcriptSrt(words);
    setNarrationSource({
      text: narration,
      names: (timedVoice ? [timedVoice] : timedVoices)
        .map((clip) => clip.name)
        .join(", "),
    });
    setDraft((previous) => ({
      ...previous,
      script: words.map((word) => word.text).join(" "),
      timedNarration: narration,
      duration: project.settings.duration,
    }));
    setDurationInput(null);
    notify(
      "Timed voiceover added. Cue times follow the audio’s trim and position in this scene.",
    );
  };
  const hasDirection = !!draft.selectedDirection?.trim();
  const implementationDraft = draft;
  let request: GeneratePackage | undefined;
  let prompt = "",
    promptError = "";
  try {
    const { width, height, fps } = project.settings;
    const source = includeCode ? project : undefined;
    if (output === "structured") {
      const input = generateInputSchema.parse({
        brief: buildStructuredSceneBrief(implementationDraft, width, height, source),
        width,
        height,
        fps,
        durationFrames: Math.max(
          Math.ceil(fps / 10),
          Math.round(draft.duration * fps),
        ),
        references: [],
      });
      request = { kind: "structured", input };
      prompt = buildGeneratePrompt(input);
    } else {
      const input = codeGenerateInputSchema.parse({
        format: output,
        prompt: buildCodePrompt({ ...implementationDraft, format: output }, width, height, source),
        references: [],
        purpose: "implementation",
        packageContext: projectPackageContext(project),
      });
      request = { kind: "code", input };
      prompt = buildCodeGeneratePrompt(input);
    }
  } catch (error) {
    promptError = (error as Error).message;
  }
  const run = async (action: () => Promise<void>) => {
    setBusy(true);

    try {
      await action();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const directorPrompt = buildDirectorPrompt(
    draft, project.settings.width, project.settings.height, output,
    includeCode ? project : undefined,
  );
  const exportDirector = () => run(async () => {
    setUncopiedPrompt("");
    const session = useStudio.getState().session;
    const input = codeGenerateInputSchema.parse({ format: "document", prompt: directorPrompt, references: [], purpose: "director", packageContext: projectPackageContext(project) });
    const result = await bridge.call("codeGeneratePackage", input);
    if (useStudio.getState().session !== session) throw Error("The project changed. Export a fresh director prompt.");
    download(result);
    try {
      await navigator.clipboard.writeText(directorPrompt);
      notify("Director prompt copied and context ZIP download started.");
    } catch {
      setUncopiedPrompt(directorPrompt);
      notify("Context ZIP download started. Copy the director prompt from the preview below.");
    }
  });
  const copyAndDownload = (request: GeneratePackage) =>
    run(async () => {
      notify("Ready");
      setUncopiedPrompt("");
      const { session, project: currentProject } = useStudio.getState();
      const sceneId = currentProject.workflow?.selectedId ?? "scene-1";
      const result = request.kind === "structured"
        ? await bridge.call("structuredGeneratePackage", request.input)
        : await bridge.call("codeGeneratePackage", request.input);
      if (useStudio.getState().session !== session)
        throw Error("The project changed. Open its Prompt Builder and try again.");
      download(result);
      if (request.kind === "code" && request.input.format === "document") {
        const { script, timedNarration, ...context } = draft;
        onCodeTaskExported(JSON.stringify({ ...context, format: "document" }, null, 2), sceneId, session);
      }
      try {
        await navigator.clipboard.writeText(result.prompt);
        notify("Prompt copied and ZIP download started.");
      } catch {
        setUncopiedPrompt(result.prompt);
        selectSection("output");
        notify("ZIP download started. Clipboard access was unavailable. Copy the exported prompt in Output.");
      }
    });
  return (
    <section className="prompt-templates" aria-label="Prompt templates">
      <div className="prompt-heading">
        <div>
          <h3 title="Describe your scene, then copy the prompt and download its task ZIP.">
            <Sparkles size={17} /> Prompt builder
          </h3>
          <p>Brief → style → copy → create. Reference look: Settings → Config.</p>
        </div>
        <button
          title="Reset prompt fields"
          aria-label="Reset prompt fields"
          onClick={() => {
            setDraft(defaults);
            setDurationInput(null);
            setIncludeCode(false);

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
          ["identity", "Identity"],
          ["mascot", "Mascot"],
          ["direction", "Direction"],
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
                "identity",
                "mascot",
                "direction",
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
            
            ) : id === "identity" ? (
              <Fingerprint size={17} />
            ) : id === "mascot" ? (
              <Cat size={17} />
            ) : id === "direction" ? (
              <Clapperboard size={17} />
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
          id="prompt-panel-brief"
          aria-labelledby="prompt-tab-brief"
          hidden={activeSection !== "brief"}
        >
          <div className="prompt-form-card">
            <div className="prompt-card-heading">
              <strong>The brief</strong>
              <span>
                {project.settings.width} × {project.settings.height}
              </span>
            </div>
            <details className="brief-script-context prompt-options">
              <summary>Full video script <small>{draft.fullScript?.trim() ? "Script added · optional context" : "Optional context"}</small></summary>
              <div className="prompt-options-content">
              <label className="field" htmlFor="prompt-full-script">
                <span>Full video script</span>
                <ExpandableTextarea id="prompt-full-script" rows={8} maxLength={100000}
                  aria-describedby="prompt-full-script-help"
                  value={draft.fullScript ?? ""}
                  onChange={(event) => update("fullScript", event.target.value)}
                  placeholder="Paste the whole video script so the AI understands the complete story…" />
              </label>
              <p id="prompt-full-script-help" className="type-hint">Used by the director and identity prompts for whole-video context. Only the scene narration below is animated; its timestamps control this scene. The AI infers the intended audience and takeaway from your script.</p>
              </div>
            </details>
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
            {voice && (
              <div className="prompt-audio-timing" role="status">
                <small>
                  Audio: {voice.name} · {Number(voice.length.toFixed(2))}s.
                  {Math.abs(draft.duration - voice.length) > 0.05
                    ? ` Duration mismatch: animation is ${Number(draft.duration.toFixed(2))}s. Paste a script or choose Match audio length to use the narration duration.`
                    : " Animation duration matches this audio clip."}
                </small>
                {Math.abs(draft.duration - voice.length) > 0.05 && (
                  <button
                    type="button"
                    onClick={() => {
                      update("duration", voice.length);
                      setDurationInput(null);
                    }}
                  >
                    Match audio length
                  </button>
                )}
              </div>
            )}
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
            <div className="prompt-script-heading">
              <label htmlFor="prompt-script-input">Scene narration / timestamps</label>
            <div className="prompt-timed-toolbar prompt-voiceover-action">
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
                <Timer size={15} aria-hidden="true" /> Use timed voiceover
              </button>
            </div>
            </div>
            <div className="field">

              <ExpandableTextarea
                id="prompt-script-input"
                aria-label="Scene narration / timestamps"
                aria-describedby="prompt-scene-script-help"
                onPaste={(event) => {
                  if (!event.clipboardData.getData("text/plain").trim() || !voice) return;
                  update("duration", voice.length);
                  setDurationInput(null);
                }}
                rows={8}
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

                }}
              />
              <small id="prompt-scene-script-help" className="prompt-input-format">
                {draft.timedNarration
                  ? `${parseNarrationInput(draft.timedNarration).format} · timing detected`
                  : "Plain text · timing inferred"}
              </small>
              <small className="prompt-narration-source">
                {narrationSource?.text === (draft.timedNarration || draft.script)
                  ? `Text from audio: ${narrationSource.names}`
                  : "Pasted or edited text · audio source unverified"}
              </small>
            </div>


          </div>
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
          <p className="type-hint">Generate a reusable identity from your project’s reference look in Settings → Config and your script, then paste the guide below. The lock preserves its invariants across shots.</p>
          <div className="director-export-action">
            <button className="director-export-button" disabled={busy} onClick={() => void run(async () => {
              const text = buildIdentityPrompt(draft, output);
              try {
                await navigator.clipboard.writeText(text);
                notify("Identity prompt copied. Attach identity reference images in your external AI conversation if needed.");
              } catch {
                setUncopiedPrompt(text);
                selectSection("output");
                notify("Clipboard unavailable. Copy the exported identity prompt in Output.");
              }
            })}>
              <Fingerprint size={18} aria-hidden="true" /> Copy Identity Prompt
            </button>
            <small>Review three options externally, choose or refine one, then paste its detailed final guide here.</small>
          </div>
          <label className="field">
            Video theme &amp; visual identity guide
            <ExpandableTextarea rows={12} maxLength={30000} value={draft.identityGuide ?? ""}
              onChange={(event) => update("identityGuide", event.target.value)}
              placeholder="Paste the selected whole-video theme and its detailed visual instructions…" />
          </label>
          <details><summary>Preview identity prompt</summary>
            <ExpandableTextarea aria-label="Identity prompt" rows={10} value={buildIdentityPrompt(draft, output)} readOnly />
          </details>
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
          className="prompt-tab-panel"
          role="tabpanel"
          id="prompt-panel-direction"
          aria-labelledby="prompt-tab-direction"
          hidden={activeSection !== "direction"}
        >
          <section className="prompt-form-card" aria-labelledby="prompt-direction-heading">
            <div className="prompt-card-heading"><strong id="prompt-direction-heading" className="output-section-title"><Clapperboard size={18} aria-hidden="true" /> Explore a direction</strong><span>Optional · external AI</span></div>
            <div className="prompt-options-content">

              <p className="type-hint">Scene narration, timestamps and optional full-script context are included from Brief.</p>
              <div className="director-export-action director-transfer">
                <div className="director-transfer-buttons">
                <button className="director-export-button" disabled={busy} aria-busy={busy}
                  onClick={() => void exportDirector()}>
                  <Clapperboard size={18} aria-hidden="true" />
                  Copy Director Prompt &amp; Download ZIP
                </button>
                </div>
                <small>Paste the copied prompt into your AI and attach the downloaded context ZIP.</small>
              </div>
              <label className="field">
                <span>Selected creative direction <small>{hasDirection ? "In use" : "Optional"}</small></span>
                <ExpandableTextarea id="selected-creative-direction" aria-describedby="direction-draft-help" rows={10} maxLength={30000}
                  value={draft.selectedDirection ?? ""}
                  onChange={(event) => update("selectedDirection", event.target.value)}
                  placeholder="Paste the final refined direction here, rather than all the alternatives." />
              </label>
              <p id="direction-draft-help" className="direction-draft-notice" role="status">
                {hasDirection ? "This direction is automatically included in the final prompt and ZIP. Edits apply immediately."
                  : "Paste your selected direction to use it automatically, or leave this empty to generate directly."}
              </p>
              <details><summary>Preview director prompt</summary>
                <ExpandableTextarea aria-label="Director prompt" rows={12} value={directorPrompt} readOnly />
              </details>
            </div>
          </section>
        </div>
        <div className="prompt-tab-panel" role="tabpanel" id="prompt-panel-output"
          aria-labelledby="prompt-tab-output" hidden={activeSection !== "output"}>
          <section className="prompt-form-card" aria-labelledby="prompt-package-heading">
            <div className="prompt-card-heading">
              <strong id="prompt-package-heading" className="output-section-title"><Package size={18} aria-hidden="true" /> Prepare your package</strong><span>{outputLabels[output]}</span>
            </div>
            <div className="prompt-options-content">
              <label className="field">
                Output format
                <select
                  aria-label="Output format"
                  value={output}
                  onChange={(event) => setOutput(event.target.value as GenerateOutput)}
                >
                  {Object.entries(outputLabels).map(([format, label]) => (
                    <option key={format} value={format}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {output === "document"
                  ? "One pasteable HTML document with CSS and JavaScript embedded. FrameScript splits it into the three editor tabs."
                  : output === "separate"
                    ? "Paste each returned block into its matching code editor tab."
                    : "One scene module with editable native shapes, a built-in star, or a static label."}
              </p>
              <label className="prompt-check">
                <input
                  type="checkbox"
                  checked={includeCode}
                  onChange={(event) => setIncludeCode(event.target.checked)}
                />{" "}
                Include active timeline code as a reference
              </label>

            </div>
          </section>
          <section className="output-import-section" aria-labelledby="output-import-heading">
            <div><h3 id="output-import-heading">Import your generated result</h3><p>After your AI returns animation code, bring it into the editor for preview.</p></div>
              <button
                className="prompt-import-code-button"
                disabled={busy || (master && output !== "structured")}
                onClick={
                  output === "structured"
                    ? onReviewGeneratedScene
                    : () => onOpenCode(output === "document")
                }
              >
                {output === "structured" ? <Layers size={17} aria-hidden="true" /> : <ClipboardPaste size={17} aria-hidden="true" />}
                {output === "structured"
                  ? "Import generated scene"
                  : output === "document"
                    ? "Paste full HTML document"
                    : "Open code editor"}
              </button>
          </section>
          <p className="muted">
            Draft saved on this device. No AI connection required. The director decides when on-screen text helps.
          </p>
          {uncopiedPrompt && (
            <label className="field">
              Exported prompt
              <ExpandableTextarea rows={6} value={uncopiedPrompt} readOnly />
            </label>
          )}
          <details>
            <summary>Preview generated prompt</summary>
            <ExpandableTextarea
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
            {outputLabels[output]}
          </span>
        </div>
        <div className="prompt-action-buttons">
          <button
            className="primary"
            aria-busy={busy}
            disabled={busy || !request || !!promptError}
            onClick={() => request && void copyAndDownload(request)}
          >
            <Clipboard size={17} aria-hidden="true" />
            Copy and Download
          </button>
        </div>
      </div>
    </section>
  );
}
