import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRightFromLine,
  AudioLines,
  Clipboard,
  Clapperboard,
  Code2,
  Eye,
  Image,
  LockKeyhole,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  appendCodeContinuation,
  codeContinuationInputSchema,
  continuationAudio,
  continuationNarration,
  continuationSource,
  type CodeContinuationInput,
} from "../shared/code-continuation";
import {
  parseCombined,
  visualCodeSchema,
  type Project,
} from "../shared/project";
import { initialWorkflow } from "../shared/workflow";
import type { PromptReferences as References } from "../shared/prompt-references";
import type { PromptDraft } from "../shared/prompt-templates";
import { bridge, download } from "./bridge";
import { useStatusActivity, useStatusNotice } from "./editor-status";
import { PromptDrawer } from "./PromptDrawer";
import { PromptReferences } from "./PromptReferences";
import { ReviewFrame, SceneReview } from "./SceneReview";
import { useStudio } from "./store";

const sections = [
  { id: "handoff", label: "Handoff", Icon: Image },
  { id: "narration", label: "Narration", Icon: AudioLines },
  { id: "direction", label: "Direction", Icon: SlidersHorizontal },
  { id: "output", label: "Output", Icon: Code2 },
] as const;
type Section = (typeof sections)[number]["id"];
const inheritedFields = [
  ["style", "Visual style"],
  ["referenceStyle", "Reference look"],
  ["palette", "Palette"],
  ["editingStyle", "Editing style"],
] as const;
export function CodeContinuationPanel({
  sceneId,
  segmentId,
  open,
  onClose,
  onApplied,
  appliedProject,
}: {
  sceneId: string;
  segmentId?: string;
  open: boolean;
  onClose: () => void;
  onApplied: (segmentId: string) => void;
  appliedProject: Project;
}) {
  const project = useStudio((state) => state.project);
  const source = continuationSource(project, sceneId, segmentId);
  const html = source?.code.html;
  const css = source?.code.css;
  const js = source?.code.js;
  const sourceDuration = source?.duration;
  const sourceOffset = source?.sourceOffset;
  const savedContext = source?.context;
  const inherited = useMemo(() => {
    if (!savedContext) {
      try {
        const saved = JSON.parse(localStorage.getItem("framescript.prompt-draft.v1") ?? "null");
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
        const { script, timedNarration, selectedDirection, directionApproval, ...settings } = saved;
        return settings as Partial<PromptDraft>;
      } catch { return; }
    }
    try {
      return JSON.parse(savedContext) as Partial<PromptDraft> | null;
    } catch {
      return;
    }
  }, [savedContext]);
  const savedFullScript = useMemo(() => {
    if (inherited?.fullScript?.trim()) return inherited.fullScript;
    try {
      const draft = JSON.parse(localStorage.getItem("framescript.prompt-draft.v1") ?? "null");
      return typeof draft?.fullScript === "string" ? draft.fullScript : "";
    } catch {
      return "";
    }
  }, [inherited, open]);
  const handoffPreview = useMemo(() => {
    if (
      html === undefined ||
      css === undefined ||
      js === undefined ||
      !sourceDuration
    )
      return;
    const snapshot = {
      ...project,
      html,
      css,
      js,
      settings: { ...project.settings, duration: sourceDuration },
    };
    const workflow = initialWorkflow(snapshot);
    workflow.scenes[0].sourceOffset = sourceOffset;
    return { ...snapshot, workflow };
  }, [html, css, js, sourceDuration, sourceOffset, project]);
  const audio = source
    ? continuationAudio(project, sceneId, source.handoff)
    : [];
  const defaultAudio = audio.find((item) => item.start >= -1e-6) ?? audio[0];
  const [audioId, setAudioId] = useState(defaultAudio?.clip.id ?? "");
  const [seconds, setSeconds] = useState<string>();
  const [section, setSection] = useState<Section>("handoff");
  const scroll = useRef<HTMLDivElement>(null);
  const [narration, setNarration] = useState<string>();
  const [fullScript, setFullScript] = useState<string>();
  const [selectedDirection, setSelectedDirection] = useState("");
  const [references, setReferences] = useState<References>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncopiedPrompt, setUncopiedPrompt] = useState("");
  const [result, setResult] = useState("");
  const [task, setTask] = useState<{
    input: CodeContinuationInput;
    session: number;
    revision: number;
  }>();
  const [review, setReview] = useState<{
    patch: Partial<Project>;
    task: NonNullable<typeof task>;
    segmentId: string;
  }>();
  const notify = useStatusNotice();
  useStatusActivity(busy ? "Preparing visual extension…" : "");
  const selectedAudio = audio.find(({ clip }) => clip.id === audioId);
  const automaticDuration = Math.min(
    source?.maxDuration ?? 0,
    Math.max(0.1, selectedAudio?.end ?? 5),
  );
  const duration = seconds === undefined ? automaticDuration : Number(seconds);
  const validDuration =
    !!source && duration >= 0.1 && duration <= source.maxDuration;
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
  }, [section]);
  const script =
    narration ??
    (selectedAudio
      ? continuationNarration(selectedAudio.clip, selectedAudio.start, duration)
      : "");
  const invalidate = () => {
    setTask(undefined);
    setError("");
    setUncopiedPrompt("");
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      notify(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const checkTask = (pending: NonNullable<typeof task>) => {
    const state = useStudio.getState();
    if (
      state.session !== pending.session ||
      state.revision !== pending.revision
    )
      throw Error("The timeline changed. Prepare a fresh extension ZIP.");
    return state;
  };
  const makeInput = (purpose: "implementation" | "director" = "implementation") => {
    if (!source) throw Error("Select a visual clip to extend.");
    return codeContinuationInputSchema.parse({
        source: source.code,
        title: source.scene.title,
        settings: { ...project.settings, duration: source.duration, speed: 1 },
        assets: project.assets.filter((asset) =>
          Object.values(source.code).some((code) =>
            code.includes(`asset://${asset.id}`),
          ),
        ),
        sourceOffset: source.sourceOffset,
        handoff: source.handoff,
        timelineHandoff: source.timelineHandoff,
        lastFrameTime: source.lastFrameTime,
        duration,
        inheritedContext: inherited ? JSON.stringify(inherited) : source.context,
        direction: "",
        pacing: "",
        camera: "",
        narration: script,
        references,
        fullScript: fullScript ?? savedFullScript,
        selectedDirection,
        purpose,
      });
  };
  const copyAndDownload = (purpose: "implementation" | "director" = "implementation") =>
    run(async () => {
      if (!source)
        throw Error(
          "Select the last visual clip in an unlocked seek-mode timeline.",
        );
      invalidate();
      const state = useStudio.getState();
      const applied = continuationSource(appliedProject, sceneId, segmentId);
      if (
        !applied ||
        JSON.stringify(applied.code) !== JSON.stringify(source.code)
      )
        throw Error(
          "Save and apply the current visual code before extending it.",
        );
      const input = makeInput(purpose);
      const exported = await bridge.call("codeContinuationPackage", input);
      const pending = {
        input,
        session: state.session,
        revision: state.revision,
      };
      checkTask(pending);
      const response = await fetch(exported.url, {
        credentials: "same-origin",
      });
      const contentType = response.headers.get("content-type")?.split(";")[0];
      if (
        !response.ok ||
        !["application/zip", "application/octet-stream"].includes(
          contentType ?? "",
        )
      )
        throw Error(
          "Could not retrieve the extension ZIP. Try Copy and Download again.",
        );
      const zip = await response.blob();
      checkTask(pending);
      const url = URL.createObjectURL(zip);
      try {
        download({ url, name: exported.name });
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (purpose === "implementation") setTask(pending);
      try {
        await navigator.clipboard.writeText(exported.prompt);
        notify(
          purpose === "director" ? "Director context ZIP downloaded. Paste the selected direction in Direction." : "Extension prompt copied and ZIP download started. Paste the AI result in Output.",
        );
      } catch {
        setUncopiedPrompt(exported.prompt);
        notify("Extension ZIP download started. Copy the prompt from Output.");
      }
    });
  const reviewResult = async () => {
    if (!source) return;
    setBusy(true);
    try {
      if (!validDuration) throw Error("Set a valid extension duration before reviewing.");
      const current = useStudio.getState();
      const pending = task ?? {
        input: makeInput(),
        session: current.session,
        revision: current.revision,
      };
      const applied = continuationSource(appliedProject, sceneId, segmentId);
      if (!applied || JSON.stringify(applied.code) !== JSON.stringify(source.code))
        throw Error("Save and apply the current visual code before extending it.");
      checkTask(pending);
      const html = result
        .trim()
        .replace(/^```(?:html)?\s*\n/i, "")
        .replace(/\n```\s*$/, "");
      if (!/<html[\s>]/i.test(html))
        throw Error(
          "Paste the full HTML document returned for this extension.",
        );
      const code = visualCodeSchema.parse(parseCombined(html));
      if (!/\bwindow\s*\.\s*renderFrame\b/.test(code.js))
        throw Error(
          "The extension must expose window.renderFrame(timeInSeconds).",
        );
      const { parse } = await import("@babel/parser");
      parse(code.js, { sourceType: "script" });
      const state = checkTask(pending);
      const newSegmentId = crypto.randomUUID();
      setReview({
        patch: appendCodeContinuation(
          state.project,
          source.scene,
          pending.input,
          code,
          newSegmentId,
        ),
        task: pending,
        segmentId: newSegmentId,
      });
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (open && review && source) {
    const sceneProject = (value: Project) => ({
      ...value,
      workflow: value.workflow && { ...value.workflow, selectedId: sceneId },
    });
    const before = sceneProject({
      ...project,
      ...source.scene,
      settings: { ...project.settings, duration: source.scene.duration },
    });
    const after = {
      ...before,
      ...review.patch,
      settings: {
        ...before.settings,
        duration: Math.max(
          source.scene.duration,
          review.task.input.handoff + review.task.input.duration,
        ),
      },
    };
    return (
      <SceneReview
        before={before}
        after={sceneProject(after)}
        beforeTime={source.handoff - source.duration + source.lastFrameTime}
        initialTime={source.handoff}
        playFrom={Math.max(0, source.handoff - 1)}
        comparisonDuration={after.settings.duration}
        explanation={
          <>
            <p>
              Compare the original handoff with the continuation. Drag the
              slider across the join at {source.timelineHandoff.toFixed(3)}s.
            </p>
            {error && <p role="alert">{error}</p>}
          </>
        }
        onDiscard={() => setReview(undefined)}
        onApply={() => {
          try {
            const state = checkTask(review.task);
            state.change(review.patch, "Extend visual clip");
            if (useStudio.getState().revision === state.revision)
              throw Error(
                useStudio.getState().error ||
                  "The extension could not be applied.",
              );
            state.setPlaying(false);
            notify("Visual extension added · Undo available");
            setReview(undefined);
            setTask(undefined);
            onClose();
            onApplied(review.segmentId);
          } catch (failure) {
            setError((failure as Error).message);
          }
        }}
      />
    );
  }
  return (
    <PromptDrawer
      open={open}
      id="extend-builder-panel"
      label="Extend builder panel"
      onClose={onClose}
    >
      <section
        className="prompt-templates code-continuation-builder"
        aria-label="Extend visual · Prompt Builder"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          onClose();
        }}
      >
        <div className="prompt-heading">
          <div>
            <h3>
              <ArrowRightFromLine size={17} /> Extend visual
            </h3>
            {source && (
              <p title={source.scene.title}>
                {source.scene.title} · Handoff at{" "}
                {source.timelineHandoff.toFixed(3)}s
              </p>
            )}
          </div>
          <button
            aria-label="Close Extend builder"
            title="Close Extend builder"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div
          className="prompt-section-nav"
          role="tablist"
          aria-label="Extension sections"
        >
          {sections.map(({ id, label, Icon }, index) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={"extend-tab-" + id}
              aria-controls={"extend-panel-" + id}
              aria-selected={section === id}
              tabIndex={section === id ? 0 : -1}
              onClick={() => setSection(id)}
              onKeyDown={(event) => {
                const last = sections.length - 1;
                const next = {
                  ArrowLeft: index === 0 ? last : index - 1,
                  ArrowRight: index === last ? 0 : index + 1,
                  Home: 0,
                  End: last,
                }[event.key];
                if (next === undefined) return;
                event.preventDefault();
                const nextId = sections[next].id;
                setSection(nextId);
                document.getElementById("extend-tab-" + nextId)?.focus();
              }}
            >
              <Icon aria-hidden="true" /> <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="prompt-form-scroll" ref={scroll}>
          {source ? (
            <>
              <div
                className="prompt-tab-panel extend-handoff-grid"
                role="tabpanel"
                id="extend-panel-handoff"
                aria-labelledby="extend-tab-handoff"
                hidden={section !== "handoff"}
              >
                {handoffPreview && open && section === "handoff" && (
                  <div className="prompt-form-card extend-preview">
                    <ReviewFrame
                      project={handoffPreview}
                      time={source.lastFrameTime}
                      title="Last visible frame"
                    />
                  </div>
                )}
                <div className="prompt-form-card">
                  <div className="extend-card-heading">
                    <h4>Inherited context</h4>
                    <span className="extend-tag">
                      <LockKeyhole size={12} /> Read only
                    </span>
                  </div>
                  <div className="extend-metadata">
                    <span>
                      {project.settings.width} × {project.settings.height}
                    </span>
                    <span>{project.settings.fps} fps</span>
                  </div>
                  <p>
                    Previous HTML, CSS, JavaScript and the last visible frame
                    are included in the ZIP.
                  </p>
                  {inherited && (
                    <dl className="extend-inherited">
                      {inheritedFields.map(([key, label]) => {
                        const value = inherited[key];
                        return (
                          typeof value === "string" &&
                          value.trim() && (
                            <div key={key}>
                              <dt>{label}</dt>
                              <dd>{value}</dd>
                            </div>
                          )
                        );
                      })}
                    </dl>
                  )}
                  {savedContext ? (
                    <details>
                      <summary>Saved prompt selections</summary>
                      <textarea
                        aria-label="Inherited prompt selections"
                        readOnly
                        rows={7}
                        value={savedContext}
                      />
                    </details>
                  ) : (
                    <p>
                      The source code and handoff frame provide continuity for
                      this clip.
                    </p>
                  )}
                </div>
              </div>
              <div
                className="prompt-tab-panel"
                role="tabpanel"
                id="extend-panel-narration"
                aria-labelledby="extend-tab-narration"
                hidden={section !== "narration"}
              >
                <fieldset disabled={busy} className="prompt-form-card">
                  <div className="extend-card-heading">
                    <h4>Next voice clip</h4>
                    <span className="extend-tag">Starts at 00:00.000</span>
                  </div>
                  <div className="extend-field-grid">
                    <label className="field">
                      <span>New voice clip</span>
                      <select
                        value={audioId}
                        onChange={(event) => {
                          setAudioId(event.target.value);
                          setSeconds(undefined);
                          setNarration(undefined);
                          invalidate();
                        }}
                      >
                        <option value="">Enter narration manually</option>
                        {audio.map(({ clip }) => (
                          <option key={clip.id} value={clip.id}>
                            {clip.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Extension duration (seconds)</span>
                      <input
                        type="number"
                        min={0.1}
                        max={source.maxDuration}
                        step="0.001"
                        value={
                          seconds ??
                          String(Number(automaticDuration.toFixed(3)))
                        }
                        onChange={(event) => {
                          setSeconds(event.target.value);
                          invalidate();
                        }}
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Full script · broader story context</span>
                    <textarea rows={5} maxLength={100000} value={fullScript ?? savedFullScript}
                      placeholder="Full video script for story context"
                      onChange={(event) => { setFullScript(event.target.value); invalidate(); }} />
                    <small>Automatically uses the previous scene’s full script or your saved Prompt Builder script. Edit only if needed.</small>
                  </label>
                  <label className="field">
                    <span>Timed narration</span>
                    <textarea
                      className="extend-script"
                      rows={8}
                      value={script}
                      placeholder="Paste SRT or VTT cues for the new voice clip"
                      onChange={(event) => {
                        setNarration(event.target.value);
                        invalidate();
                      }}
                    />
                  </label>
                </fieldset>
              </div>
              <div
                className="prompt-tab-panel"
                role="tabpanel"
                id="extend-panel-direction"
                aria-labelledby="extend-tab-direction"
                hidden={section !== "direction"}
              >
                <fieldset disabled={busy} className="prompt-form-card">
                  <div className="extend-card-heading">
                    <h4>Explore a direction</h4>
                    <span className="extend-tag">Optional</span>
                  </div>
                  <ol className="director-workflow" aria-label="Creative direction workflow">
                    <li><strong>Copy &amp; attach</strong><span>Send the director prompt and context ZIP to your AI.</span></li>
                    <li><strong>Choose &amp; refine</strong><span>Review three approaches and develop your preferred option.</span></li>
                    <li><strong>Bring it back</strong><span>Paste only the final direction below.</span></li>
                  </ol>
                  <p className="type-hint">Previous settings, identity, full script and scene code continue automatically. The context ZIP adds handoff and motion images.</p>
                  <div className="director-export-action director-transfer">
                    <div className="director-transfer-buttons">
                      <button type="button" className="director-export-button" disabled={!validDuration} onClick={() => copyAndDownload("director")}><Clapperboard size={18} aria-hidden="true" /> Copy Director Prompt &amp; Download ZIP</button>
                    </div>
                  </div>
                  <label className="field">
                    <span>Selected creative direction</span>
                    <textarea rows={10} maxLength={30000} value={selectedDirection}
                      placeholder="Paste the director's SELECTED CREATIVE DIRECTION"
                      onChange={(event) => { setSelectedDirection(event.target.value); invalidate(); }} />
                    <small>Included automatically in the extension prompt and ZIP.</small>
                  </label>
                </fieldset>
              </div>
              <div
                className="prompt-tab-panel extend-output"
                role="tabpanel"
                id="extend-panel-output"
                aria-labelledby="extend-tab-output"
                hidden={section !== "output"}
              >
                <div className="prompt-form-card">
                  <div className="extend-card-heading">
                    <h4>Output settings</h4>
                    <span className="extend-tag">
                      <Code2 size={13} /> Full HTML document
                    </span>
                  </div>
                  <p>
                    Send the copied prompt and the downloaded ZIP together.
                    Paste the returned HTML with its CSS and JavaScript
                    embedded.
                  </p>
                  <PromptReferences
                    references={references}
                    busy={busy}
                    run={run}
                    onChange={(files) => {
                      setReferences(files);
                      invalidate();
                    }}
                  />
                  {uncopiedPrompt && (
                    <label className="field">
                      <span>Exported extension prompt</span>
                      <textarea
                        className="extend-script"
                        rows={6}
                        readOnly
                        value={uncopiedPrompt}
                      />
                    </label>
                  )}
                </div>
              </div>
                <div className="prompt-form-card">
                  <div className="extend-card-heading">
                    <h4>Import continuation</h4>
                  </div>
                  <>
                      <label className="field">
                        <span>Paste continuation HTML</span>
                        <textarea
                          className="extend-script"
                          rows={6}
                          value={result}
                          onChange={(event) => setResult(event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="primary extend-review-button"
                        disabled={!validDuration || !result.trim() || busy}
                        onClick={() => void reviewResult()}
                      >
                        <Eye size={16} aria-hidden="true" />
                        Review extension
                      </button>
                  </>
                  <p>Paste the complete continuation HTML to review it with the current extension settings.</p>
                </div>
            </>
          ) : (
            <p className="prompt-form-card">
              Select the last visual in an unlocked seek-mode timeline to extend
              it.
            </p>
          )}
        </div>
        <div className="prompt-actions">
          <div className="prompt-ready">
            {validDuration && <span className="live-dot" />}
            <span>
              {validDuration
                ? duration.toFixed(3) + "s"
                : "Set a valid duration"}{" "}
              <span className="extend-footer-format">· Full HTML document</span>
            </span>
          </div>
          <div className="prompt-action-buttons">
            <button
              type="button"
              className="primary"
              disabled={busy || !validDuration}
              aria-busy={busy}
              onClick={() => void copyAndDownload()}
            >
              <Clipboard size={15} /> Copy and Download
            </button>
          </div>
          {error && (
            <p className="extend-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </PromptDrawer>
  );
}
