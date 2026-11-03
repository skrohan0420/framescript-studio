import { Field } from "./components";
import { useId, useState } from "react";
import { ExportHelp } from "./ExportHelp";
import type { ExportOptions } from "../shared/project";
import {
  exportPresetSize,
  exportResolutions,
  supportedExportSize,
} from "../shared/export-presets";
export function ExportSettings({
  options,
  frame,
  disabled,
  onChange,
}: {
  options: ExportOptions;
  frame: { width: number; height: number; fps?: number };
  disabled: boolean;
  onChange: (value: ExportOptions) => void;
}) {
  const update = (patch: Partial<ExportOptions>) =>
    onChange({ ...options, ...patch });
  const helpId = useId();
  const [advanced, setAdvanced] = useState(false);
  const [customResolution, setCustomResolution] = useState(false);
  const [customQuality, setCustomQuality] = useState(false);
  const [customFrameRate, setCustomFrameRate] = useState(false);
  const supportsFastCapture =
    !options.transparent &&
    options.quality !== 0 &&
    ["mp4", "mkv", "webm"].includes(options.format);
  const selected = exportResolutions.find((item) => {
    const size = exportPresetSize(item.height, frame);
    return size.width === options.width && size.height === options.height;
  });
  const rates = [...new Set([24, 25, 30, 50, 60, options.fps])].sort(
    (a, b) => a - b,
  );
  const quality =
    options.quality === 18
      ? "18"
      : options.quality === 20
        ? "20"
        : options.quality === 28
          ? "28"
          : "custom";
  const automatic =
    (options.graphics ?? "auto") === "auto" &&
    (options.acceleration ?? "auto") === "auto" &&
    (options.captureMode ?? "lossless") === "lossless" &&
    options.quality === 18 &&
    options.width === frame.width &&
    options.height === frame.height &&
    (frame.fps === undefined || options.fps === frame.fps);
  const numericFields = (
    keys: ("width" | "height" | "duration" | "fps" | "speed" | "quality")[],
  ) =>
    keys.map((key) => (
      <Field
        key={key}
        label={
          key === "duration"
            ? "Duration (seconds)"
            : key === "speed"
              ? "Playback speed"
              : key === "fps"
                ? "Custom frame rate"
                : key === "quality"
                  ? "Quality value"
                  : key === "width"
                    ? "Width (px)"
                    : "Height (px)"
        }
      >
        <input
          type="number"
          aria-label={
            key === "quality"
              ? "Quality CRF (lower is better)"
              : key === "fps"
                ? "Custom frame rate"
                : key
          }
          step={key === "duration" ? 0.001 : key === "speed" ? 0.1 : 1}
          min={
            key === "quality"
              ? 0
              : key === "duration" || key === "speed"
                ? 0.1
                : key === "width" || key === "height"
                  ? 64
                  : 1
          }
          max={
            key === "quality"
              ? 51
              : key === "duration"
                ? 600
                : key === "speed"
                  ? 8
                  : key === "fps"
                    ? 120
                    : key === "width"
                      ? 7680
                      : 4320
          }
          title={
            key === "duration"
              ? "Exact timeline duration: " + options.duration + " seconds"
              : undefined
          }
          value={
            key === "duration"
              ? Number(options.duration.toFixed(3))
              : options[key]
          }
          onChange={(event) => update({ [key]: Number(event.target.value) })}
        />
      </Field>
    ));
  return (
    <fieldset className="export-settings" disabled={disabled}>
      <div className="export-output-summary">
        <strong>
          {options.width} × {options.height}
        </strong>
        <span>
          {options.fps} fps · {options.format.toUpperCase()}
        </span>
      </div>
      <p className="export-auto-note">
        <strong>
          {automatic ? "Automatic · quality first" : "Custom export settings"}
        </strong>
        <span>
          {automatic
            ? "Lossless capture · hardware acceleration when supported. Resolution and FPS stay unchanged."
            : "Your advanced settings will be used."}
        </span>
        {!automatic && (
          <button
            type="button"
            onClick={() =>
              update({
                width: frame.width,
                height: frame.height,
                fps: frame.fps ?? options.fps,
                quality: 18,
                captureMode: "lossless",
                graphics: "auto",
                acceleration: "auto",
              })
            }
          >
            Use automatic settings
          </button>
        )}
      </p>
      <Field label="Format">
        <select
          aria-label="Export format"
          value={options.format}
          onChange={(event) =>
            update({
              format: event.target.value as ExportOptions["format"],
              transparent: false,
            })
          }
        >
          {["mp4", "mkv", "webm", "gif", "sequence", "png"].map((format) => (
            <option value={format} key={format}>
              {format === "sequence" ? "PNG sequence" : format.toUpperCase()}
            </option>
          ))}
        </select>
      </Field>
      <details
        className="export-advanced"
        open={advanced}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
      >
        <summary>
          Advanced settings{" "}
          <small>Resolution, FPS, quality & compatibility</small>
        </summary>
        <div className="export-option-groups">
          <section className="export-option-group" aria-label="Output">
            <header>
              <h3>Output</h3>
              <p>Frame size, playback rate and background.</p>
            </header>
            <div className="settings-grid">
              {" "}
              <Field label="Resolution">
                <select
                  aria-label="Export resolution"
                  value={
                    customResolution
                      ? "custom"
                      : selected
                        ? String(selected.height)
                        : "custom"
                  }
                  onChange={(event) => {
                    setCustomResolution(event.target.value === "custom");
                    if (event.target.value === "custom") setAdvanced(true);
                    if (event.target.value === "original")
                      update({ width: frame.width, height: frame.height });
                    else if (event.target.value !== "custom")
                      update(
                        exportPresetSize(Number(event.target.value), frame),
                      );
                  }}
                >
                  <option value="custom">
                    Custom · {options.width} × {options.height}
                  </option>
                  <option value="original">Match project frame</option>
                  {exportResolutions.map((item) => {
                    const size = exportPresetSize(item.height, frame);
                    const supported = supportedExportSize(size);
                    return (
                      <option
                        key={item.height}
                        value={item.height}
                        disabled={!supported}
                      >
                        {item.name} · {size.width} × {size.height}
                        {supported ? "" : " (unavailable)"}
                      </option>
                    );
                  })}
                </select>
              </Field>
              <Field label="Frame rate">
                <select
                  aria-label="Export frame rate"
                  value={customFrameRate ? "custom" : options.fps}
                  onChange={(event) => {
                    setCustomFrameRate(event.target.value === "custom");
                    if (event.target.value !== "custom")
                      update({ fps: Number(event.target.value) });
                  }}
                >
                  <option value="custom">Custom frame rate…</option>
                  {rates.map((rate) => (
                    <option value={rate} key={rate}>
                      {rate} fps
                    </option>
                  ))}
                </select>
              </Field>
              {(customResolution || !selected || customFrameRate) && (
                <div className="export-custom-values">
                  {(customResolution || !selected) &&
                    numericFields(["width", "height"])}
                  {customFrameRate && numericFields(["fps"])}
                </div>
              )}
              <Field label="Canvas fitting">
                <select
                  aria-label="Export canvas fitting"
                  value={options.fit}
                  onChange={(event) =>
                    update({ fit: event.target.value as ExportOptions["fit"] })
                  }
                >
                  <option value="fit">Fit (letterbox)</option>
                  <option value="fill">Fill / crop</option>
                  <option value="stretch">Stretch</option>
                </select>
              </Field>
              <label className="export-toggle-row">
                <span>
                  <strong>Transparent background</strong>
                  <small>
                    {["webm", "sequence", "png"].includes(options.format)
                      ? "Keep the background transparent."
                      : "Requires WebM or PNG output."}
                  </small>
                </span>
                <input
                  aria-label="Export transparency"
                  title="Available for WebM and PNG output. MP4 and MKV do not support transparency."
                  type="checkbox"
                  disabled={
                    !["webm", "sequence", "png"].includes(options.format)
                  }
                  checked={options.transparent}
                  onChange={(event) =>
                    update({ transparent: event.target.checked })
                  }
                />
              </label>
            </div>
          </section>
          <section className="export-option-group" aria-label="Image quality">
            <header>
              <h3>Image quality</h3>
              <p>Capture detail and final video compression.</p>
            </header>
            <div className="settings-grid">
              {" "}
              <ExportHelp
                id={`${helpId}-rendering`}
                label="Rendering"
                selected={
                  supportsFastCapture
                    ? (options.captureMode ?? "lossless")
                    : "lossless"
                }
                choices={[
                  {
                    value: "fast",
                    title: "Faster video export",
                    detail:
                      "Choose for drafts and quick previews. Compatible canvases still use lossless direct pixels; other opaque video scenes use JPEG intermediates, which can soften fine text and edges.",
                    example: "A quick review before your final export.",
                  },
                  {
                    value: "lossless",
                    title: "Lossless frame capture",
                    detail:
                      "Choose for final videos, typography, diagrams and fine detail. PNG or direct capture preserves source frames before video encoding. It can take longer; resolution and FPS stay the same.",
                    example:
                      "Your final 4K/60 video with crisp labels and graphics.",
                  },
                ]}
                note="For your quality priority: choose Lossless frame capture + Higher quality. Lossless capture does not mean the final MP4 is lossless; video encoding still compresses it."
              >
                <Field label="Rendering">
                  <select
                    aria-label="Export capture mode"
                    aria-describedby={`${helpId}-rendering`}
                    value={
                      supportsFastCapture
                        ? (options.captureMode ?? "lossless")
                        : "lossless"
                    }
                    disabled={!supportsFastCapture}
                    onChange={(event) =>
                      update({
                        captureMode: event.target.value as "fast" | "lossless",
                      })
                    }
                  >
                    <option value="fast">Faster video export</option>
                    <option value="lossless">Lossless frame capture</option>
                  </select>
                  <small>
                    Lossless source frames; resolution and FPS stay unchanged.
                  </small>
                </Field>
              </ExportHelp>
              <ExportHelp
                id={`${helpId}-quality`}
                label="Quality"
                selected={customQuality ? "custom" : quality}
                choices={[
                  {
                    value: "18",
                    title: "Higher quality · 18",
                    detail:
                      "Less compression and better preservation of fine detail. Usually creates a larger file; encoding time depends on the scene and encoder.",
                    example:
                      "A final 4K/60 export with small text or smooth gradients.",
                  },
                  {
                    value: "20",
                    title: "Recommended · 20",
                    detail:
                      "Balances detail and file size for everyday exports. Uses more compression than Higher quality.",
                    example:
                      "A normal finished video where file size also matters.",
                  },
                  {
                    value: "28",
                    title: "Smaller file · 28",
                    detail:
                      "Stronger compression reduces file size but may show artifacts around text, gradients or fast motion. This is primarily a size tradeoff, not a guaranteed speed boost.",
                    example: "A lightweight preview to share for feedback.",
                  },
                  {
                    value: "custom",
                    title: `Custom · ${options.quality}`,
                    detail:
                      "Set the numeric quality value in Advanced settings. Lower values generally preserve more detail; higher values compress more. Hardware encoders interpret these values differently from software CRF.",
                    example: "Fine-tuning a specific delivery requirement.",
                  },
                ]}
                note={
                  options.format === "png" || options.format === "sequence"
                    ? "PNG output is lossless. These video-quality presets do not change PNG pixels."
                    : options.format === "gif"
                      ? "GIF uses a limited color palette; this video-quality value does not control that palette."
                      : "For maximum detail among these presets, choose Higher quality. Rendering controls frame capture; Quality controls the final video compression. Neither changes your resolution or FPS."
                }
              >
                <Field label="Quality">
                  <select
                    aria-label="Export quality"
                    aria-describedby={`${helpId}-quality`}
                    value={customQuality ? "custom" : quality}
                    onChange={(event) => {
                      setCustomQuality(event.target.value === "custom");
                      if (event.target.value === "custom") setAdvanced(true);
                      if (event.target.value !== "custom")
                        update({ quality: Number(event.target.value) });
                    }}
                  >
                    <option value="18">Higher quality</option>
                    <option value="20">Recommended</option>
                    <option value="28">Smaller file</option>
                    <option value="custom">
                      Custom · CRF {options.quality}
                    </option>
                  </select>
                </Field>
              </ExportHelp>
              {(customQuality || quality === "custom") && (
                <>{numericFields(["quality"])}</>
              )}
            </div>
          </section>
          <section className="export-option-group" aria-label="Timing">
            <header>
              <h3>Timing</h3>
              <p>Adjust the exported duration and playback speed.</p>
            </header>
            <div className="settings-grid">
              {numericFields(["duration", "speed"])}
            </div>
          </section>
          <section
            className="export-option-group"
            aria-label="Performance & compatibility"
          >
            <header>
              <h3>Performance & compatibility</h3>
              <p>Automatic settings are recommended.</p>
            </header>
            <div className="settings-grid">
              {" "}
              <ExportHelp
                id={`${helpId}-encoding`}
                label="Encoding"
                selected={options.acceleration ?? "auto"}
                choices={[
                  {
                    value: "auto",
                    title: "Automatic · hardware when available",
                    detail:
                      "Best starting point for MP4 and MKV. Tests available hardware encoders and falls back to CPU when needed. It can shorten video compression, but does not speed up every scene-drawing or capture step.",
                    example:
                      "Everyday exports, especially 4K/60 on a supported computer.",
                  },
                  {
                    value: "software",
                    title: "Software · CPU",
                    detail:
                      "Uses the CPU's software encoder. Choose it for compatibility, troubleshooting a graphics-driver/encoder issue, or comparing software CRF settings. It may take longer at 4K/60.",
                    example:
                      "A hardware export fails or produces unexpected compression artifacts.",
                  },
                ]}
                note="Encoding compresses finished frames into video. It is separate from graphics acceleration, which draws the scene. Hardware and software quality numbers are not exact equivalents. This selector applies to MP4/MKV; other formats use their own encoders."
              >
                <Field label="Encoding">
                  <select
                    aria-label="Export encoding"
                    aria-describedby={`${helpId}-encoding`}
                    value={options.acceleration ?? "auto"}
                    disabled={!["mp4", "mkv"].includes(options.format)}
                    onChange={(event) =>
                      update({
                        acceleration: event.target.value as "auto" | "software",
                      })
                    }
                  >
                    <option value="auto">
                      Automatic · hardware when available
                    </option>
                    <option value="software">Software · CPU</option>
                  </select>
                </Field>
              </ExportHelp>
              <ExportHelp
                id={`${helpId}-graphics`}
                label="Graphics acceleration"
                selected={options.graphics ?? "auto"}
                choices={[
                  {
                    value: "auto",
                    title: "Automatic · recommended",
                    detail:
                      "Automatically uses Windows hardware graphics for Three.js scenes and the compatible browser backend for other scenes. Retries compatibility mode if GPU initialization fails.",
                    example:
                      "Typography, diagrams, or a scene that already exports reliably.",
                  },
                  {
                    value: "browser",
                    title: "Browser default · compatibility",
                    detail:
                      "Disables automatic Windows GPU selection. Use to troubleshoot graphics drivers; it can be much slower for 3D.",
                    example:
                      "A scene fails to initialize with hardware graphics.",
                  },
                  {
                    value: "hardware",
                    title: "Hardware graphics · Windows",
                    detail:
                      "Try for Three.js/WebGL scenes on Windows with a supported GPU. Compatible opaque, full-frame canvases use direct lossless GPU capture; scenes with overlays or CSS effects retain browser capture. Keeps your resolution, geometry, effects and antialiasing settings. Driver rasterization can differ; GPU initialization errors trigger a compatibility retry.",
                    example:
                      "A 4K/60 3D scene with meshes, lights and particles.",
                  },
                ]}
                note="This changes scene drawing, not the video encoder. Combine Hardware graphics with Automatic encoding to accelerate both stages when supported. A GPU is not guaranteed to improve every scene."
              >
                <Field label="Graphics acceleration">
                  <select
                    aria-label="Export graphics acceleration"
                    aria-describedby={`${helpId}-graphics`}
                    value={options.graphics ?? "auto"}
                    onChange={(e) =>
                      update({
                        graphics: e.target.value as
                          "auto" | "hardware" | "browser",
                      })
                    }
                  >
                    <option value="auto">Automatic · recommended</option>
                    <option value="browser">
                      Browser default · compatibility
                    </option>
                    <option
                      value="hardware"
                      disabled={!/Windows/i.test(navigator.userAgent)}
                    >
                      Hardware graphics · Windows
                    </option>
                  </select>
                </Field>
              </ExportHelp>
              <label className="export-toggle-row export-toggle-wide">
                <span>
                  <strong>Reuse rendered frames</strong>
                  <small>
                    Reuse unchanged output. First export may be slower; up to 2
                    GB cached for 7 days.
                  </small>
                </span>
                <input
                  type="checkbox"
                  aria-label="Reuse rendered frames"
                  checked={options.reuseFrames ?? false}
                  onChange={(e) => update({ reuseFrames: e.target.checked })}
                />
              </label>
            </div>
          </section>
        </div>
      </details>
    </fieldset>
  );
}
