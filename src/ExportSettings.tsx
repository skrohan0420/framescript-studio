import { Field } from "./components";
import { useState } from "react";
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
  frame: { width: number; height: number };
  disabled: boolean;
  onChange: (value: ExportOptions) => void;
}) {
  const update = (patch: Partial<ExportOptions>) =>
    onChange({ ...options, ...patch });
  const [advanced, setAdvanced] = useState(false);
  const [customResolution, setCustomResolution] = useState(false);
  const [customQuality, setCustomQuality] = useState(false);
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
      <div className="settings-grid">
        <Field label="Rendering">
          <select
            aria-label="Export capture mode"
            value={
              supportsFastCapture ? (options.captureMode ?? "fast") : "lossless"
            }
            disabled={!supportsFastCapture}
            onChange={(event) =>
              update({ captureMode: event.target.value as "fast" | "lossless" })
            }
          >
            <option value="fast">Faster video export</option>
            <option value="lossless">Lossless frame capture</option>
          </select>
          <small>
            {supportsFastCapture
                ? "Compatible full-frame canvases use direct lossless capture automatically. Other scenes use JPEG in Faster mode, or PNG in Lossless mode. Resolution and frame rate stay unchanged."
              : "This export uses lossless frame capture to preserve image quality and transparency."}
          </small>
        </Field>
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
                update(exportPresetSize(Number(event.target.value), frame));
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
            value={options.fps}
            onChange={(event) => update({ fps: Number(event.target.value) })}
          >
            {rates.map((rate) => (
              <option value={rate} key={rate}>
                {rate} fps
              </option>
            ))}
          </select>
        </Field>
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
        <Field label="Quality">
          <select
            aria-label="Export quality"
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
            <option value="custom">Custom · CRF {options.quality}</option>
          </select>
        </Field>
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
        <Field label="Preserve transparency">
          <input
            aria-label="Export transparency"
            type="checkbox"
            disabled={!["webm", "sequence", "png"].includes(options.format)}
            checked={options.transparent}
            onChange={(event) => update({ transparent: event.target.checked })}
          />
        </Field>
      </div>
      <details
        className="export-advanced"
        open={advanced}
        onToggle={(event) => setAdvanced(event.currentTarget.open)}
      >
        <summary>
          Advanced settings{" "}
          <small>Custom dimensions, duration & encoding</small>
        </summary>
        <div className="settings-grid">
          <Field label="Encoding">
            <select
              aria-label="Export encoding"
              value={options.acceleration ?? "auto"}
              disabled={!["mp4", "mkv"].includes(options.format)}
              onChange={(event) =>
                update({
                  acceleration: event.target.value as "auto" | "software",
                })
              }
            >
              <option value="auto">Automatic · hardware when available</option>
              <option value="software">Software · CPU</option>
            </select>
          </Field>
          {(
            ["width", "height", "duration", "fps", "speed", "quality"] as const
          ).map((key) => (
            <Field
              key={key}
              label={
                key === "quality"
                  ? "Quality CRF (lower is better)"
                  : key === "fps"
                    ? "Custom frame rate"
                    : key
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
                step={key === "speed" || key === "duration" ? 0.1 : 1}
                value={options[key]}
                onChange={(event) =>
                  update({ [key]: Number(event.target.value) })
                }
              />
            </Field>
          ))}
        </div>
      </details>
    </fieldset>
  );
}
