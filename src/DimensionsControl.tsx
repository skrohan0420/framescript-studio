import { useEffect, useState } from "react";
import { Check, ArrowRightLeft } from "lucide-react";
import { sizeError, sizePresets, type MediaSize } from "../shared/media-layout";
export function DimensionsControl({
  label,
  value,
  frame = false,
  disabled = false,
  onApply,
}: {
  label: string;
  value: MediaSize;
  frame?: boolean;
  disabled?: boolean;
  onApply: (size: MediaSize) => void;
}) {
  const [width, setWidth] = useState(String(value.width));
  const [height, setHeight] = useState(String(value.height));
  const [error, setError] = useState("");
  useEffect(() => {
    setWidth(String(value.width));
    setHeight(String(value.height));
    setError("");
  }, [value.width, value.height]);
  return (
    <div className="dimensions-control">
      <label className="field">
        <span>{label} preset</span>
        <select
          aria-label={`${label} preset`}
          disabled={disabled}
          value={sizePresets.findIndex(
            (item) =>
              item.width === Number(width) && item.height === Number(height),
          )}
          onChange={(event) => {
            const size = sizePresets[Number(event.target.value)];
            if (size) {
              setWidth(String(size.width));
              setHeight(String(size.height));
              setError("");
            }
          }}
        >
          <option value={-1}>Custom size</option>
          {sizePresets.map((preset, index) => (
            <option key={preset.name} value={index}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <div className="dimension-inputs">
        <label>
          <span>Width</span>
          <input
            type="number"
            min={frame ? 64 : 1}
            max={3840}
            step={frame ? 2 : 1}
            aria-label={`${label} width`}
            value={width}
            disabled={disabled}
            onChange={(event) => {
              setWidth(event.target.value);
              setError("");
            }}
          />
        </label>
        <span className="dimension-times">×</span>
        <label>
          <span>Height</span>
          <input
            type="number"
            min={frame ? 64 : 1}
            max={3840}
            step={frame ? 2 : 1}
            aria-label={`${label} height`}
            value={height}
            disabled={disabled}
            onChange={(event) => {
              setHeight(event.target.value);
              setError("");
            }}
          />
        </label>
        <button
          disabled={disabled}
          title={`Swap ${label.toLowerCase()} dimensions`}
          aria-label={`Swap ${label.toLowerCase()} dimensions`}
          onClick={() => {
            setWidth(height);
            setHeight(width);
            setError("");
          }}
        >
          <ArrowRightLeft size={15} />
        </button>
        <button
          className="primary"
          disabled={disabled}
          title={`Apply ${label.toLowerCase()} dimensions`}
          aria-label={`Apply ${label.toLowerCase()} dimensions`}
          onClick={() => {
            const size = { width: Number(width), height: Number(height) };
            const message = sizeError(size, frame);
            setError(message);
            if (!message) onApply(size);
          }}
        >
          <Check size={16} />
        </button>
      </div>
      {error && (
        <p className="dimension-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
