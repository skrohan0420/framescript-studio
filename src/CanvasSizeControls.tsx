import {
  canvasRatio,
  canvasRatios,
  canvasResolution,
  canvasResolutions,
  canvasPresetSize,
} from "../shared/canvas-size";
import type { MediaSize } from "../shared/media-layout";

export function CanvasSizeControls({
  value,
  onChange,
}: {
  value: MediaSize;
  onChange: (size: MediaSize) => void;
}) {
  const ratio = canvasRatio(value);
  const resolution = canvasResolution(value);
  return (
    <div className="canvas-size-controls">
      <label>
        <select
          aria-label="Canvas aspect ratio"
          title="Canvas shape. Keeps the selected resolution tier."
          value={ratio?.name ?? "custom"}
          onChange={(e) => {
            const next = canvasRatios.find((r) => r.name === e.target.value);
            if (next)
              onChange(
                canvasPresetSize(
                  next,
                  resolution?.shortSide ?? Math.min(value.width, value.height),
                ),
              );
          }}
        >
          {!ratio && <option value="custom">Custom ratio</option>}
          {canvasRatios.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <select
          aria-label="Canvas resolution"
          title="Editing canvas dimensions. Export defaults to this size; animation code is not rewritten."
          value={resolution?.shortSide ?? "custom"}
          onChange={(e) => {
            if (e.target.value !== "custom")
              onChange(canvasPresetSize(value, Number(e.target.value)));
          }}
        >
          {!resolution && (
            <option value="custom">
              {value.width} × {value.height}
            </option>
          )}
          {canvasResolutions.map((r) => {
            const size = canvasPresetSize(value, r.shortSide);
            return (
              <option key={r.shortSide} value={r.shortSide}>
                {r.name} · {size.width} × {size.height}
              </option>
            );
          })}
        </select>
      </label>
    </div>
  );
}
