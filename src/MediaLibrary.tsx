import { useStatusActivity, useStatusNotice } from "./editor-status";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  FileAudio,
  ImagePlus,
  Plus,
  Sparkles,
  Upload,
  X,
  FileText,
  Copy,
  RotateCcw,
  Play,
  Pause,
  Check,
  Trash2,
  MoreHorizontal,
  Volume2,
  ChevronUp,
  Code2,
} from "lucide-react";
import { useProjectState, useStudio } from "./store";
import { audioDetails, clipFromAudio, readData } from "./audio";
import { toggleAudioEnhancement } from "./enhance-audio";
import {
  initialWorkflow,
  totalDuration,
} from "../shared/workflow";
import type { AudioClip } from "../shared/project";
import { AudioWaveform } from "./AudioWaveform";
import { Modal } from "./components";
import { SilenceEditor } from "./SilenceEditor";
import { DimensionsControl } from "./DimensionsControl";
import { bridge } from "./bridge";
import { transcriptSrt } from "../shared/transcript";
import { audioDragType } from "../shared/audio-library";
import type { ImagePlacement, MediaSize } from "../shared/media-layout";

export function MediaLibrary({
  manual = false,
  mode,
  master,
  selectedAudio,
  onSelectAudio,
  onSelectAsset,
  onImportImages,
  onUseAsset,
  onAttach,
  onRemoveAsset,
  onTool,
  onError,
  placement,
  onPlacement,
  followFrame,
  onFollowFrame,
  onFrameSize,
}: {
  manual?: boolean;
  mode: "media" | "audio";
  master: boolean;
  selectedAudio?: string;
  onSelectAudio: (id: string) => void;
  onSelectAsset: (id: string) => void;
  onImportImages: () => void;
  onUseAsset: (id: string) => void;
  onAttach: (id: string) => void;
  onRemoveAsset: (id: string) => void;
  onTool: (tab: string) => void;
  onError: (message: string) => void;
  placement: ImagePlacement;
  onPlacement: (value: ImagePlacement) => void;
  followFrame: boolean;
  onFollowFrame: (value: boolean) => void;
  onFrameSize: (size: MediaSize) => void;
}) {
  const { project, change } = useProjectState();
  const [pendingRemoval, setPendingRemoval] = useState<AudioClip | null>(null);
  const isAudioInUse = (clip: AudioClip) => project.audio?.some(
    (item) => item.sourceId === clip.id || item.data === clip.data,
  ) ?? false;
  const input = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("all");
  const [audioTab, setAudioTab] = useState<"imported" | "generated">("imported");
  const [lane, setLane] = useState<AudioClip["lane"]>("voice");
  const [importing, setImporting] = useState(false);
  const [enhancingSource, setEnhancingSource] = useState<string | null>(null);
  const enhancementLock = useRef(false);
  const enhanceSource = async (clip: AudioClip) => {
    if (enhancementLock.current) return;
    enhancementLock.current = true;
    setEnhancingSource(clip.id);
    const session = useStudio.getState().session;
    stopPreview();
    useStudio.getState().setPlaying(false);
    try {
      const result = await toggleAudioEnhancement(clip);
      const current = useStudio.getState();
      const source = current.project.audioLibrary?.find(item => item.id === clip.id);
      if (current.session !== session || source?.data !== clip.data)
        throw Error("Audio changed during enhancement. Try again.");
      current.change({
        audioLibrary: current.project.audioLibrary?.map(item => item.id === clip.id ? { ...item, ...result } : item),
        audio: current.project.audio?.map(item =>
          item.data === clip.data && (item.sourceId === clip.id || !item.sourceId)
            ? { ...item, ...result, sourceId: clip.id } : item),
      }, "Enhance library audio");
      notify(result.enhanced ? "Audio enhanced. Click again to hear the original." : "Enhancement off. Original audio restored.");
    } catch (error) {
      onError((error as Error).message);
    } finally {
      enhancementLock.current = false;
      setEnhancingSource(null);
    }
  };
  const [search, setSearch] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<{ id: string; original: boolean } | null>(null);
  const previewPlayer = useRef<HTMLAudioElement | null>(null);
  const timelinePlaying = useStudio((state) => state.playing);
  const stopPreview = () => {
    if (previewPlayer.current) {
      previewPlayer.current.pause();
      previewPlayer.current.removeAttribute("src");
      previewPlayer.current.load();
      previewPlayer.current = null;
    }
    setPreviewId(null);
  };
  useEffect(
    () => () => {
      previewPlayer.current?.pause();
      previewPlayer.current?.removeAttribute("src");
      previewPlayer.current = null;
    },
    [],
  );
  useEffect(() => {
    if (
      mode !== "audio" ||
      timelinePlaying ||
      (previewId &&
        !project.audioLibrary?.some((source) => source.id === previewId))
    )
      stopPreview();
  }, [mode, timelinePlaying, project.audioLibrary, previewId]);
  const inspectAudio = (source: AudioClip, compareOriginal?: boolean) => {
    if (compareOriginal === undefined) setComparison(null);
    setSelectedSource(source.id);
    const instance = project.audio?.find(
      (clip) =>
        clip.data === source.data &&
        (!clip.sceneId || clip.sceneId === project.workflow?.selectedId),
    );
    if (instance) onSelectAudio(instance.id);
    if (previewId === source.id && compareOriginal === undefined) {
      stopPreview();
      return;
    }
    stopPreview();
    useStudio.getState().setPlaying(false);
    const variant = source.enhancement;
    const player = new Audio(compareOriginal === undefined || !variant ? source.data : compareOriginal ? variant.originalData : variant.processedData);
    previewPlayer.current = player;
    player.volume = 0.7 * (compareOriginal === undefined || !variant ? 1 : compareOriginal ? variant.comparisonOriginalGain ?? 1 : variant.comparisonProcessedGain ?? 1);
    player.onended = () => {
      if (previewPlayer.current === player) stopPreview();
    };
    setPreviewId(source.id);
    void player.play().catch((error) => {
      if (previewPlayer.current !== player) return;
      stopPreview();
      onError("Could not preview this audio: " + error.message);
    });
  };
  const addAudioSource = (source: AudioClip) => {
    try {
      const state = useStudio.getState(),
        p = state.project;
      const workflow = p.workflow ?? initialWorkflow(p);
      if (
        !master &&
        workflow.scenes.find((scene) => scene.id === workflow.selectedId)
          ?.locked
      )
        throw Error("Unlock this timeline before adding audio.");
      if ((p.audio?.length ?? 0) >= 60)
        throw Error("Remove a timeline audio clip before adding another.");
      const limit = master
        ? totalDuration({ ...p, workflow })
        : p.settings.duration;
      const start = source.lane === "music" ? 0 : Math.max(0, state.time);
      if (start >= limit)
        throw Error("Place the playhead inside the timeline to add audio.");
      const clip = {
        ...clipFromAudio(
          source,
          source.lane,
          master ? undefined : workflow.selectedId,
        ),
        id: crypto.randomUUID(),
        sourceId: source.id,
        generatedSource: undefined,
        start,
        length:
          source.lane === "music"
            ? limit
            : Math.min(source.duration, limit - start),
        license: source.license,
      };
      state.change(
        { workflow, audio: [...(p.audio ?? []), clip] },
        "Add library audio to timeline",
      );
      onSelectAudio(clip.id);
      setSelectedSource(source.id);
    } catch (error) {
      onError((error as Error).message);
    }
  };
  const [transcribing, setTranscribing] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const notify = useStatusNotice();
  useStatusActivity(transcribing ? "Extracting voiceover text…" : importing ? "Importing media…" : "");
  const [transcriptFormat, setTranscriptFormat] = useState<"text" | "srt">(
    "srt",
  );
  const transcriptValue = (clip: AudioClip) =>
    transcriptFormat === "srt"
      ? transcriptSrt(clip.transcriptWords ?? [])
      : (clip.transcript ?? "");
  const downloadTranscript = (clip: AudioClip) => {
    const url = URL.createObjectURL(
      new Blob([transcriptValue(clip)], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      clip.name.replace(/\.[^.]+$/, "") +
      (transcriptFormat === "srt" ? ".srt" : ".txt");
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const extractText = async (clip: AudioClip) => {
    if (transcribing) return;
    setTranscribing(clip.id);
    try {
      const result = await bridge.call("transcribeAudio", {
        data: clip.data,
        name: clip.name,
      });
      const current = useStudio.getState();
      if (
        !current.project.audioLibrary?.some(
          (item) => item.id === clip.id && item.data === clip.data,
        )
      )
        throw Error("The audio changed. Extract text again.");
      current.change(
        {
          audioLibrary: current.project.audioLibrary?.map((item) =>
            item.id === clip.id
              ? {
                  ...item,
                  transcript: result.text,
                  transcriptWords: result.words,
                }
              : item,
          ),
          audio: current.project.audio?.map((item) =>
            item.data === clip.data
              ? {
                  ...item,
                  transcript: result.text,
                  transcriptWords: result.words,
                }
              : item,
          ),
        },
        "Extract voiceover text",
      );
      setTranscriptId(clip.id);
      notify("Transcript ready.");
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setTranscribing(null);
    }
  };
  const importAudio = async (files: File[]) => {
    if (importing) return;
    setImporting(true);
    try {
      for (const file of files) {
        if (
          !file.type.startsWith("audio/") &&
          !/\.(mp3|wav|m4a|ogg|flac|aac|opus|webm)$/i.test(file.name)
        )
          throw Error("Choose an audio file such as MP3 or WAV.");
        const state = useStudio.getState(),
          p = state.project;
        const data = await readData(file),
          details = await audioDetails(data);
        if (
          useStudio.getState().revision !== state.revision ||
          useStudio.getState().session !== state.session
        )
          throw Error("Project changed while importing audio. Import again.");
        const existing = p.audioLibrary?.find((source) => source.data === data);
        if (existing) {
          setSelectedSource(existing.id);
          notify(`${file.name} is already in the audio library.`);
          continue;
        }
        const clip = {
          ...clipFromAudio({ name: file.name, data, ...details }, lane),
          ...(lane === "voice" && p.workflow?.script.trim()
            ? { transcript: p.workflow.script }
            : {}),
        };
        change(
          { audioLibrary: [...(p.audioLibrary ?? []), clip] },
          "Import library audio",
        );
        if (
          !useStudio
            .getState()
            .project.audioLibrary?.some((source) => source.id === clip.id)
        )
          throw Error(
            useStudio.getState().error || "The audio could not be imported.",
          );
        setSelectedSource(clip.id);
        notify(
          `${file.name} imported to the library · Add or drag it to the timeline.`,
        );
      }
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setImporting(false);
    }
  };
  const assets = project.assets.filter(
    (asset) =>
      asset.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter !== "references" || asset.kind === "reference"),
  );
  const audio = (project.audioLibrary ?? []).filter((clip) =>
    clip.name.toLowerCase().includes(search.toLowerCase()) &&
    (audioTab === "generated" ? !!clip.generatedSource : !clip.generatedSource),
  );
  return (
    <section
      className="media-library"
      aria-label={mode === "audio" ? "Audio library" : "Media library"}
    >
      <input
        ref={input}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          e.currentTarget.value = "";
          void importAudio(files);
        }}
      />
      {!manual && (
        <div className="library-sidebar">
          <strong>Project</strong>
          {mode === "media" ? (
            <>
              <button
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                All media
              </button>
              <button
                className={filter === "references" ? "active" : ""}
                onClick={() => setFilter("references")}
              >
                References
              </button>
              {!manual && (
                <button onClick={() => onTool("mascot")}>Mascot</button>
              )}
            </>
          ) : (
            <>
              <button className="active">Your audio</button>
              {!manual && (
                <>
                  <button onClick={() => onTool("voice")}>Narration</button>
                  <button onClick={() => onTool("sound")}>SFX & music</button>
                </>
              )}
            </>
          )}
        </div>
      )}
      <div
        className="library-content"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          if (mode === "audio") {
            e.preventDefault();
            e.stopPropagation();
            void importAudio(Array.from(e.dataTransfer.files));
          }
        }}
      >
        <div className="library-toolbar">
          <div className="media-library-heading">
            <strong>{mode === "media" ? "Media" : "Audio"}</strong>
            <small>
              {mode === "media"
                ? `${project.assets.length} images`
                : `${project.audioLibrary?.length ?? 0} recordings`}
            </small>
          </div>
          <button
            className="library-import"
            aria-label={importing ? "Importing media" : "Import media"}
            title={importing ? "Importing media" : "Import media"}
            disabled={importing}
            onClick={() =>
              mode === "media" ? onImportImages() : input.current?.click()
            }
          >
            <Plus size={14} />
          </button>
          {mode === "audio" && (
            <select
              aria-label="Library audio category"
              value={lane}
              onChange={(e) => setLane(e.target.value as AudioClip["lane"])}
            >
              <option value="voice">Narration</option>
              <option value="sfx">SFX</option>
              <option value="music">Music</option>
            </select>
          )}
        </div>
        {mode === "media" && (
          <div className="media-dimensions">
            <details className="media-size-card" open>
              <summary>
                Output frame{" "}
                <small>
                  {project.settings.width} × {project.settings.height}
                </small>
              </summary>
              <p>Video resolution. Presets and custom dimensions up to 4K.</p>
              <DimensionsControl
                label="Output frame"
                value={project.settings}
                frame
                onApply={onFrameSize}
              />
            </details>
            <details className="media-size-card">
              <summary>
                Image insertion{" "}
                <small>
                  {placement.width} × {placement.height}
                </small>
              </summary>
              <p>
                Size of images added or dragged into the preview. Source files
                stay unchanged.
              </p>
              <label className="media-follow-frame">
                <input
                  type="checkbox"
                  checked={followFrame}
                  onChange={(event) => onFollowFrame(event.target.checked)}
                />{" "}
                Use current frame size
              </label>
              <DimensionsControl
                label="Image size"
                value={placement}
                disabled={followFrame}
                onApply={(size) => onPlacement({ ...placement, ...size })}
              />
              <label className="field">
                <span>Image fitting</span>
                <select
                  aria-label="Image fitting"
                  value={placement.fit}
                  onChange={(event) =>
                    onPlacement({
                      ...placement,
                      fit: event.target.value as ImagePlacement["fit"],
                    })
                  }
                >
                  <option value="contain">Fit entire image</option>
                  <option value="cover">Fill and crop</option>
                </select>
              </label>
            </details>
          </div>
        )}
        {mode === "media" && (
          <div className="media-filter-tabs">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All images
            </button>
            <button
              className={filter === "references" ? "active" : ""}
              onClick={() => setFilter("references")}
            >
              References
            </button>
          </div>
        )}
        {mode === "audio" && (
          <div className="media-filter-tabs" role="group" aria-label="Audio source">
            {(["imported", "generated"] as const).map((tab) => (
              <button key={tab} className={audioTab === tab ? "active" : ""}
                aria-pressed={audioTab === tab} onClick={() => setAudioTab(tab)}>
                {tab === "generated" ? <Code2 size={14} aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                {tab === "generated" ? "Generated" : "Imported"}
                <span>{(project.audioLibrary ?? []).filter((clip) => tab === "generated" ? !!clip.generatedSource : !clip.generatedSource).length}</span>
              </button>
            ))}
          </div>
        )}
        <input
          className="library-search"
          aria-label="Search media"
          placeholder={mode === "audio" ? "Search audio" : "Search your media"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="library-section-title">
          <span>{mode === "media" ? "Imported media" : audioTab === "generated" ? "Code-generated audio" : "Imported audio"}</span>
          <span>{mode === "media" ? assets.length : audio.length}</span>
        </div>
        {mode === "media" ? (
          <div className="media-grid">
            {assets.map((asset) => (
              <article className="media-tile" key={asset.id}>
                <button
                  className="media-thumbnail"
                  aria-label={`Inspect ${asset.name}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/x-framescript-asset",
                      asset.id,
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onSelectAsset(asset.id)}
                >
                  <img src={asset.data} alt={asset.name} loading="lazy" />
                  <span className="media-type-badge">
                    {asset.kind === "reference" ? "Reference" : "Image"}
                  </span>
                </button>
                <input
                  aria-label="Asset name"
                  title={asset.name}
                  value={asset.name}
                  onChange={(e) =>
                    change(
                      {
                        assets: project.assets.map((a) =>
                          a.id === asset.id
                            ? { ...a, name: e.target.value }
                            : a,
                        ),
                      },
                      "Rename asset",
                    )
                  }
                />
                <div className="media-tile-actions">
                  <button
                    title="Insert image into HTML"
                    onClick={() => onUseAsset(asset.id)}
                  >
                    <Plus size={13} />
                  </button>
                  {!manual && (
                    <button
                      title="Attach image to AI prompt"
                      onClick={() => onAttach(asset.id)}
                    >
                      <Sparkles size={13} />
                    </button>
                  )}
                  <button
                    title="Delete unused asset"
                    onClick={() => onRemoveAsset(asset.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="media-grid audio-card-grid">
            {audio.map((clip) => (
              <article
                className={`media-tile audio-library-tile ${selectedSource === clip.id || project.audio?.some((item) => item.id === selectedAudio && item.data === clip.data) ? "selected" : ""}`}
                data-lane={clip.lane}
                key={clip.id}
                onClickCapture={(event) => {
                  if (
                    !(event.target as Element).closest(
                      ".media-thumbnail, .media-caption",
                    )
                  )
                    stopPreview();
                }}
              >
                <button
                  className="media-thumbnail audio-thumbnail"
                  draggable
                  title={
                    previewId === clip.id
                      ? "Stop preview"
                      : "Click to preview · drag onto the timeline"
                  }
                  onDragStart={(event) => {
                    event.dataTransfer.setData(audioDragType, clip.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => inspectAudio(clip)}
                  aria-label={`Inspect ${clip.name}`}
                  aria-pressed={previewId === clip.id}
                >
                  <AudioWaveform clip={clip} thumbnail />
                  <span className="audio-preview-control">
                    {previewId === clip.id ? (
                      <Pause size={16} />
                    ) : (
                      <Play size={16} />
                    )}
                  </span>
                  <span className="media-type-badge">{clip.lane}</span>
                  <span className="media-duration">
                    {clip.duration.toFixed(1)}s
                  </span>
                </button>
                <div className="audio-card-heading">
                  <button
                    className="media-caption"
                    onClick={() => inspectAudio(clip)}
                    title={clip.name}
                  >
                    {clip.name}
                  </button>
                  <small
                    className="audio-source-meta"
                    title="Timeline clips using this recording"
                  >
                    <FileAudio size={12} aria-hidden="true" />{" "}
                    {project.audio?.filter((item) => item.data === clip.data)
                      .length ?? 0}
                    <span className="sr-only"> timeline clips</span>
                  </small>
                </div>
                <div
                  className="audio-card-actions"
                  role="group"
                  aria-label="Recording actions"
                >
                  <button
                    className="audio-library-add"
                    aria-label={`Add ${clip.name} to timeline`}
                    title="Add a fresh copy to the timeline"
                    onClick={() => addAudioSource(clip)}
                  >
                    <Plus size={15} />
                  </button>
                  <div className="audio-card-statuses">
                  {project.audio?.some(
                    (item) =>
                      item.sourceId === clip.id || item.data === clip.data,
                  ) && (
                    <span
                      className="audio-on-timeline"
                      aria-label={`${clip.name} is on the timeline`}
                    >
                      <Check size={12} aria-hidden="true" /> On timeline
                    </span>
                  )}
                  {clip.enhanced && (
                    <span className="audio-on-timeline" aria-label={`${clip.name} is enhanced`}>
                      <Check size={12} aria-hidden="true" /> Enhanced
                    </span>
                  )}
                  </div>
                  <RecordingActions name={clip.name}>
                  <button
                    aria-label={`Enhance ${clip.name}`}
                    title={clip.enhanced ? "Turn enhancement off" : "Enhance audio locally"}
                    aria-pressed={clip.enhanced === true}
                    disabled={!!enhancingSource}
                    aria-busy={enhancingSource === clip.id}
                    onClick={() => void enhanceSource(clip)}
                  >
                    <Sparkles size={15} /> {clip.enhanced ? "Turn enhancement off" : "Enhance audio"}
                  </button>
                  {enhancingSource === clip.id && <small role="status">Enhancing…</small>}
                  {clip.enhancement?.comparisonOriginalGain !== undefined && (
                    <button className="audio-compare" title="Compare original and enhanced at matched loudness; does not change the timeline"
                      aria-label={`Compare ${comparison?.id === clip.id && comparison.original ? "enhanced" : "original"} ${clip.name}`}
                      onClick={() => {
                        const original = !(comparison?.id === clip.id && comparison.original);
                        setComparison({ id: clip.id, original });
                        inspectAudio(clip, original);
                      }}>
                      <Volume2 size={15} aria-hidden="true" />
                      {comparison?.id === clip.id && comparison.original ? "Hear enhanced" : "Hear original"}
                    </button>
                  )}
                  {clip.lane === "voice" && (
                    <SilenceEditor clip={clip} onError={onError} showLabels />
                  )}
                  {clip.lane === "voice" && (
                    <div
                      className="audio-transcript-toolbar"
                      aria-busy={transcribing === clip.id}
                    >
                      {clip.transcript && (
                        <button
                          className="transcript-toggle"
                          aria-label="Transcript"
                          title="Show or hide transcript"
                          aria-expanded={transcriptId === clip.id}
                          aria-controls={`transcript-${clip.id}`}
                          onClick={() =>
                            setTranscriptId(
                              transcriptId === clip.id ? null : clip.id,
                            )
                          }
                        >
                          <FileText size={14} /> Show / hide transcript
                        </button>
                      )}
                      <button
                        className={
                          clip.transcript
                            ? "transcript-refresh"
                            : "transcript-extract"
                        }
                        disabled={!!transcribing}
                        aria-label={
                          clip.transcript
                            ? `Extract text again from ${clip.name}`
                            : `Extract text from ${clip.name}`
                        }
                        title="Extract text with ElevenLabs (API key required, provider charges may apply)"
                        onClick={() => void extractText(clip)}
                      >
                        {clip.transcript ? (
                          <RotateCcw size={14} />
                        ) : (
                          <FileText size={14} />
                        )}
                        {clip.transcript ? "Extract text again" : "Extract text"}
                      </button>
                    </div>
                  )}
                  <button
                    className="audio-library-remove"
                    aria-label={`Remove ${clip.name} from library`}
                    title={isAudioInUse(clip) ? "Remove this recording from the timeline before deleting it" : "Remove from library"}
                    disabled={isAudioInUse(clip)}
                    onClick={() => setPendingRemoval(clip)}
                  >
                    <Trash2 size={15} /> Remove recording
                  </button>
                  </RecordingActions>
                </div>
                {clip.lane === "voice" &&
                  transcriptId === clip.id &&
                  clip.transcript && (
                    <div className="audio-text-actions">
                      <div
                        className="transcript-content"
                        id={`transcript-${clip.id}`}
                      >
                        <div
                          className="transcript-formats"
                          role="group"
                          aria-label="Transcript format"
                        >
                          <button
                            aria-pressed={transcriptFormat === "text"}
                            onClick={() => {
                              setTranscriptFormat("text");
                            }}
                          >
                            Plain text
                          </button>
                          <button
                            aria-pressed={transcriptFormat === "srt"}
                            onClick={() => {
                              setTranscriptFormat("srt");
                            }}
                          >
                            Timed text · SRT
                          </button>
                          <div className="transcript-header-copy">
                            {(["text", "srt"] as const).map((format) => (
                              <button
                                key={format}
                                className="transcript-copy"
                                disabled={format === "srt" ? !clip.transcriptWords?.length : !clip.transcript}
                                onClick={() => {
                                  const value = format === "srt"
                                    ? transcriptSrt(clip.transcriptWords ?? [])
                                    : (clip.transcript ?? "");
                                  void navigator.clipboard.writeText(value)
                                    .then(() => notify(format === "srt" ? "SRT copied." : "Transcript copied."))
                                    .catch(() => onError("Could not copy. Select and copy the transcript manually."));
                                }}
                              >
                                <Copy size={13} aria-hidden="true" />
                                {format === "srt" ? "Copy SRT" : "Copy text"}
                              </button>
                            ))}
                            <button
                              className="transcript-copy"
                              aria-label="Collapse transcript"
                              title="Collapse transcript"
                              aria-expanded={true}
                              aria-controls={`transcript-${clip.id}`}
                              onClick={() => setTranscriptId(null)}
                            >
                              <ChevronUp size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        {transcriptFormat === "srt" &&
                          !clip.transcriptWords?.length && (
                            <p className="transcript-hint">
                              Extract again to get real word timestamps for this
                              recording.
                            </p>
                          )}
                        <textarea
                          aria-label={`Transcript of ${clip.name}`}
                          readOnly
                          value={transcriptValue(clip)}
                          placeholder={
                            transcriptFormat === "srt"
                              ? "Word timestamps aren’t available for this transcript yet."
                              : ""
                          }
                          rows={8}
                        />
                        <div className="transcript-footer">
                          <span>
                            {clip.transcript.trim().split(/\s+/).length} words ·
                            {transcriptFormat === "srt"
                              ? "Source audio timestamps"
                              : "Full source audio"}
                          </span>
                          <button
                            className="transcript-copy"
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(transcriptValue(clip))
                                .then(() => notify("Transcript copied."))
                                .catch(() =>
                                  onError(
                                    "Could not copy. Select and copy the transcript manually.",
                                  ),
                                )
                            }
                          >
                            <Copy size={13} /> Copy text
                          </button>
                          <button
                            className="transcript-copy"
                            disabled={!transcriptValue(clip)}
                            onClick={() => downloadTranscript(clip)}
                          >
                            Download{" "}
                            {transcriptFormat === "srt" ? ".srt" : ".txt"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
              </article>
            ))}
          </div>
        )}
        {(mode === "media" ? !assets.length : !audio.length) && (
          <div className="library-empty">
            {mode === "media" ? (
              <ImagePlus size={30} />
            ) : (
              <FileAudio size={30} />
            )}
            <strong>
              {search
                ? "No matching files"
                : mode === "media"
                  ? "Your media starts here"
                  : audioTab === "generated" ? "No generated audio yet" : "Bring your narration"}
            </strong>
            <p>
              {mode === "media"
                ? search
                  ? "Try a different filename or clear the search."
                  : filter === "references"
                    ? "Images marked as references appear here."
                    : "Drop images here or import files. Insert them at the size set above."
                : audioTab === "generated" ? "Audio generated by scene code appears here." : "Import narration, music or sound effects, then arrange them on the timeline."}
            </p>
            {!search && (mode !== "audio" || audioTab === "imported") && (
              <button
                onClick={() =>
                  mode === "media" ? onImportImages() : input.current?.click()
                }
              >
                <Upload size={14} />
                Import {mode === "media" ? "media" : "audio"}
              </button>
            )}
          </div>
        )}
        {mode === "audio" && !manual && (
          <button
            className="library-studio-link"
            onClick={() => onTool("voice")}
          >
            <Sparkles size={14} />
            Open voice studio & scene composition
          </button>
        )}
      </div>
      <Modal title="Remove recording?" open={pendingRemoval !== null} onClose={() => setPendingRemoval(null)}>
        <p>Remove “{pendingRemoval?.name}” from the audio library?</p>
        {pendingRemoval && isAudioInUse(pendingRemoval) && (
          <p role="status">This recording is used on the timeline. Remove its timeline clips first.</p>
        )}
        <div className="modal-actions">
          <button autoFocus onClick={() => setPendingRemoval(null)}>Cancel</button>
          <button
            disabled={!pendingRemoval || isAudioInUse(pendingRemoval)}
            onClick={() => {
              if (!pendingRemoval || isAudioInUse(pendingRemoval)) return;
              change({ audioLibrary: project.audioLibrary?.filter((source) => source.id !== pendingRemoval.id) }, "Remove library recording");
              if (selectedSource === pendingRemoval.id) setSelectedSource(null);
              setPendingRemoval(null);
            }}
          ><Trash2 size={15} /> Remove recording</button>
        </div>
      </Modal>
    </section>
  );
}

function RecordingActions({ name, children }: { name: string; children: ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const position = () => {
    if (!trigger.current || !panel.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const menu = panel.current;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const left = rect.right + 6 + width <= window.innerWidth - 8
      ? rect.right + 6 : Math.max(8, rect.left - width - 6);
    menu.style.left = Math.min(left, Math.max(8, window.innerWidth - width - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8)) + "px";
  };
  useEffect(() => {
    if (!open) return;
    position();
    const dismiss = () => panel.current?.hidePopover();
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);
  return <div className="audio-more-actions">
    <button ref={trigger} aria-label={`More actions for ${name}`} title="More recording actions"
      aria-expanded={open} onClick={() => {
        if (panel.current?.matches(":popover-open")) panel.current.hidePopover();
        else { panel.current?.showPopover(); position(); }
      }}><MoreHorizontal size={18} /></button>
    <div ref={panel} popover="auto" className="audio-more-panel"
      onToggle={(event) => setOpen((event.nativeEvent as ToggleEvent).newState === "open")}
      onKeyDown={(event) => {
        if (event.key === "Escape") trigger.current?.focus();
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button:not(:disabled)")) panel.current?.hidePopover();
      }}>
      {children}
    </div>
  </div>;
}
