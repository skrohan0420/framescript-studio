import { FileAudio, Film, Image, Settings2 } from "lucide-react";
import { Field } from "./components";
import { useProjectState } from "./store";
import { totalDuration } from "../shared/workflow";
import type { AudioClip } from "../shared/project";

export function ProjectInspector({
  manual = false,
  audioId,
  assetId,
  children,
  onSettings,
  onVoice,
}: {
  manual?: boolean;
  audioId?: string;
  assetId?: string;
  children?: React.ReactNode;
  onSettings: () => void;
  onVoice: () => void;
}) {
  const { project, change } = useProjectState();
  const clip = project.audio?.find((clip) => clip.id === audioId);
  const asset = project.assets.find((asset) => asset.id === assetId);
  const locked =
    clip?.sceneId &&
    project.workflow?.scenes.find((scene) => scene.id === clip.sceneId)?.locked;
  const edit = (patch: Partial<AudioClip>) =>
    change(
      {
        audio: project.audio?.map((audio) =>
          audio.id === clip?.id ? { ...audio, ...patch } : audio,
        ),
      },
      "Edit audio properties",
    );
  return (
    <div className="project-inspector" aria-label="Project inspector">
      {clip ? (
        <>
          <div className="inspector-heading">
            <FileAudio size={17} />
            <div>
              <h3>Audio properties</h3>
              <p>{clip.name}</p>
            </div>
          </div>
          <audio controls src={clip.data} preload="metadata" />
          <p className="muted">
            {clip.duration.toFixed(2)}s source ·{" "}
            {clip.sceneId ? "Scene timeline" : "Master timeline"}
            {locked ? " · locked" : ""}
          </p>
          <fieldset disabled={!!locked} className="inspector-audio-fields">
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
              <Field
                key={key}
                label={
                  {
                    start: "Start (seconds)",
                    trimIn: "Source trim",
                    length: "Length (seconds)",
                    volume: "Volume",
                    fadeIn: "Fade in",
                    fadeOut: "Fade out",
                  }[key]
                }
              >
                <input
                  type="number"
                  min={key === "length" ? 0.01 : 0}
                  max={key === "volume" ? 2 : 600}
                  step={key === "volume" ? 0.05 : 0.1}
                  value={clip[key]}
                  onChange={(e) => edit({ [key]: Number(e.target.value) })}
                />
              </Field>
            ))}
            <Field label="Mute clip">
              <input
                type="checkbox"
                checked={clip.muted}
                onChange={(e) => edit({ muted: e.target.checked })}
              />
            </Field>
            {clip.lane === "music" && (
              <Field label="Loop music">
                <input
                  type="checkbox"
                  checked={clip.loop}
                  onChange={(e) => edit({ loop: e.target.checked })}
                />
              </Field>
            )}
          </fieldset>
          {clip.lane === "voice" && !manual && (
            <button className="inspector-action" onClick={onVoice}>
              Narration timing & scene composition
            </button>
          )}
        </>
      ) : asset ? (
        <>
          <div className="inspector-heading">
            <Image size={17} />
            <div>
              <h3>Media details</h3>
              <p>{asset.name}</p>
            </div>
          </div>
          <img
            className="inspector-asset-preview"
            src={asset.data}
            alt={asset.name}
          />
          <p className="muted">
            {asset.kind ?? "Image"} · embedded in this project
          </p>
          <p className="muted">
            Use the + in the media library or drag this asset into the player to
            add it to the selected scene.
          </p>
        </>
      ) : (
        <>
          <div className="inspector-heading">
            <Film size={17} />
            <div>
              <h3>Project details</h3>
            </div>
          </div>
          <dl className="project-detail-list">
            <div>
              <dt>Name</dt>
              <dd>{project.name}</dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>
                {project.settings.width} × {project.settings.height}
              </dd>
            </div>
            <div>
              <dt>Frame rate</dt>
              <dd>{project.settings.fps} fps</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{totalDuration(project).toFixed(2)}s</dd>
            </div>
            <div>
              <dt>{manual ? "Timelines" : "Scenes"}</dt>
              <dd>{project.workflow?.scenes.length ?? 1}</dd>
            </div>
            <div>
              <dt>Media</dt>
              <dd>
                {project.assets.length} images · {project.audio?.length ?? 0}{" "}
                audio
              </dd>
            </div>
          </dl>
          <button
            className="inspector-action"
            aria-label="Project settings"
            title="Project settings"
            onClick={onSettings}
          >
            <Settings2 size={14} />
          </button>
          {children}
        </>
      )}
    </div>
  );
}
