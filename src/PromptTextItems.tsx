import { useState } from "react";
import type { PromptDraft } from "../shared/prompt-templates";
import {
  promptTextSchema,
  textKinds,
  type PromptText,
} from "../shared/prompt-text";

type Props = {
  draft: PromptDraft;
  update: <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => void;
  width: number;
  height: number;
};

export function PromptTextItems({ draft, update, width, height }: Props) {
  const items = draft.textItems ?? [];
  const [kind, setKind] = useState<PromptText["kind"]>("Subject label");
  const [selected, setSelected] = useState("");
  const [time, setTime] = useState(0);
  const patch = (id: string, values: Partial<PromptText>) =>
    update(
      "textItems",
      items.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  const active = items.find((item) => item.id === selected) ?? items[0];
  const field = (
    item: PromptText,
    key: keyof PromptText,
    label: string,
    type = "text",
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        value={String(item[key])}
        maxLength={
          key === "notes"
            ? 2000
            : key === "font"
              ? 200
              : key === "subject"
                ? 500
                : 100
        }
        onChange={(event) => patch(item.id, { [key]: event.target.value })}
      />
    </label>
  );
  const number = (
    item: PromptText,
    key: keyof PromptText,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <NumberField
      key={key}
      label={label}
      value={item[key] as number}
      min={min}
      max={max}
      step={step}
      onChange={(value) => patch(item.id, { [key]: value })}
    />
  );
  const select = (
    item: PromptText,
    key: keyof PromptText,
    label: string,
    options: readonly string[],
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={String(item[key])}
        onChange={(event) => patch(item.id, { [key]: event.target.value })}
      >
        {options.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </label>
  );
  const counter = (item: PromptText) => {
    const raw = Math.min(
      1,
      Math.max(0, (time - item.start) / Math.max(0.001, item.end - item.start)),
    );
    const t =
      item.easing === "ease-in"
        ? raw * raw
        : item.easing === "ease-out"
          ? 1 - (1 - raw) ** 2
          : item.easing === "ease-in-out"
            ? raw < 0.5
              ? 2 * raw * raw
              : 1 - (-2 * raw + 2) ** 2 / 2
            : raw;
    return (
      item.prefix +
      (item.from + (item.to - item.from) * t).toFixed(item.decimals) +
      item.suffix
    );
  };
  return (
    <section className="prompt-text-items" aria-label="Individual video text">
      <div className="text-items-heading">
        <h3>Text overlays</h3>
        <small>{items.length} / 30 items</small>
      </div>
      <p className="type-control-help">
        Labels, counters and custom text, each with its own timing and style.
        Added to your prompt; timeline clips are created separately.
      </p>
      <div className="text-item-add-row">
        <label className="field">
          <span>Text type</span>
          <select
            aria-label="Text item type"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as PromptText["kind"])
            }
          >
            {textKinds.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          className="text-item-add-button"
          disabled={items.length >= 30}
          onClick={() => {
            const item = promptTextSchema.parse({
              id: crypto.randomUUID(),
              kind,
              end: Math.min(draft.duration, 10),
              size: Math.round(height * 0.05),
              ...(kind === "Timer / countdown"
                ? { from: Math.min(draft.duration, 10), to: 0 }
                : {}),
            });
            update("textItems", [...items, item]);
            setSelected(item.id);
            setTime(0);
          }}
        >
          Add text item
        </button>
      </div>
      {!items.length && (
        <div className="text-items-empty">
          No overlays yet. Choose a text type and add your first item.
        </div>
      )}
      {!!items.length && (
        <>
          <label className="field">
            <span>Edit text item</span>
            <select
              aria-label="Edit text item"
              value={active?.id}
              onChange={(event) => setSelected(event.target.value)}
            >
              {items.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {index + 1} · {item.kind}
                  {item.enabled ? "" : " (off)"}
                </option>
              ))}
            </select>
          </label>
          <div
            className="text-item-preview"
            style={{ aspectRatio: `${width}/${height}` }}
            aria-label="Text item layout preview"
          >
            {items
              .filter(
                (item) =>
                  item.enabled && time >= item.start && time <= item.end,
              )
              .map((item) => (
                <div
                  key={item.id}
                  style={{
                    position: "absolute",
                    left: `${item.x}%`,
                    top: `${item.y}%`,
                    transform: `translate(${item.align === "left" ? "0" : item.align === "right" ? "-100%" : "-50%"},-50%)`,
                    maxWidth: `${item.maxWidth}%`,
                    fontFamily: `"${item.font.replace(/["\\]/g, "")}", sans-serif`,
                    fontSize: `${(item.size / width) * 100}cqw`,
                    fontWeight: item.weight,
                    color: item.color,
                    background: ["Solid backing", "Translucent pill"].includes(
                      item.treatment,
                    )
                      ? item.backing +
                        (item.treatment === "Translucent pill" ? "b3" : "")
                      : undefined,
                    textShadow:
                      item.treatment === "Soft shadow"
                        ? "0 1px 3px black"
                        : undefined,
                    WebkitTextStroke:
                      item.treatment === "Outline"
                        ? `0.03em ${item.backing}`
                        : undefined,
                    textAlign: item.align,
                    lineHeight: item.lineHeight,
                    letterSpacing: `${(item.tracking / width) * 100}cqw`,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {["Number counter", "Timer / countdown"].includes(item.kind)
                    ? counter(item)
                    : item.text ||
                      (item.kind === "Subtitle / captions"
                        ? "Narration captions (sample)"
                        : "Your text (sample)")}
                </div>
              ))}
          </div>
          <label className="field">
            <span>Layout preview time · {time.toFixed(1)}s</span>
            <input
              aria-label="Text layout preview time"
              type="range"
              min={0}
              max={draft.duration}
              step={0.1}
              value={Math.min(time, draft.duration)}
              onChange={(event) => setTime(Number(event.target.value))}
            />
          </label>
          <p className="type-control-help">
            Layout/value preview only. Subject tracking and entrance/exit motion
            are instructions for generated code.
          </p>
        </>
      )}
      {active && (
        <div
          className="text-item-editor"
          aria-label="Selected text item settings"
        >
          <label className="prompt-check">
            <input
              type="checkbox"
              aria-label="Enable selected text item"
              checked={active.enabled}
              onChange={(event) =>
                patch(active.id, { enabled: event.target.checked })
              }
            />
            Include this item
          </label>
          {select(active, "kind", "Selected text type", textKinds)}
          <label className="field">
            <span>Exact item text</span>
            <textarea
              aria-label="Exact item text"
              rows={3}
              maxLength={10000}
              value={active.text}
              placeholder={
                active.kind === "Subtitle / captions"
                  ? "Captions use your narration when left empty"
                  : "Your exact words; use line breaks for lists and credits"
              }
              onChange={(event) =>
                patch(active.id, { text: event.target.value })
              }
            />
          </label>
          {field(
            active,
            "subject",
            "Subject / object to follow (optional except subject labels)",
          )}
          <div className="type-control-grid">
            {number(active, "start", "Item start (seconds)", 0, 600, 0.1)}
            {number(active, "end", "Item end (seconds)", 0, 600, 0.1)}
            {number(active, "x", "Item X (%)", 0, 100, 0.1)}
            {number(active, "y", "Item Y (%)", 0, 100, 0.1)}
            {number(active, "maxWidth", "Item maximum width (%)", 5, 100)}
          </div>
          {field(active, "font", "Item font family")}
          <div className="type-control-grid">
            {number(active, "size", "Item font size (px)", 8, 600)}
            {number(active, "weight", "Item font weight", 100, 900, 100)}
            {number(active, "lineHeight", "Item line height", 0.8, 3, 0.1)}
            {number(
              active,
              "tracking",
              "Item letter spacing (px)",
              -5,
              30,
              0.5,
            )}
            {select(active, "align", "Item alignment", [
              "left",
              "center",
              "right",
            ])}
            {field(active, "color", "Item text color", "color")}
            {field(active, "accent", "Item accent color", "color")}
            {field(active, "backing", "Item backing color", "color")}
          </div>
          {select(active, "treatment", "Item readability", [
            "None",
            "Soft shadow",
            "Outline",
            "Solid backing",
            "Translucent pill",
          ])}
          {select(active, "animation", "Item entrance animation", [
            "None",
            "Fade",
            "Slide up",
            "Word reveal",
            "Typewriter",
            "Scale in",
            "Mask reveal",
          ])}
          <div className="type-control-grid">
            {number(
              active,
              "entrance",
              "Item entrance duration (seconds)",
              0,
              5,
              0.1,
            )}
            {number(active, "exit", "Item exit fade (seconds)", 0, 5, 0.1)}
          </div>
          {select(active, "easing", "Item easing", [
            "linear",
            "ease-in",
            "ease-out",
            "ease-in-out",
          ])}
          {["Number counter", "Timer / countdown"].includes(active.kind) && (
            <>
              <h4>Counter values</h4>
              <div className="type-control-grid">
                {number(active, "from", "Counter from", -1e12, 1e12, 0.01)}
                {number(active, "to", "Counter to", -1e12, 1e12, 0.01)}
                {number(active, "decimals", "Counter decimal places", 0, 6)}
              </div>
              {field(active, "prefix", "Counter prefix")}
              {field(active, "suffix", "Counter suffix")}
            </>
          )}
          {field(active, "notes", "Item extra direction")}
          <div className="prompt-style-chips">
            <button
              disabled={items.length >= 30}
              onClick={() => {
                const item = { ...active, id: crypto.randomUUID() };
                update("textItems", [...items, item]);
                setSelected(item.id);
              }}
            >
              Duplicate text item
            </button>
            <button
              onClick={() => {
                update(
                  "textItems",
                  items.filter((item) => item.id !== active.id),
                );
                setSelected("");
              }}
            >
              Remove text item
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={raw ?? value}
        onFocus={() => setRaw(String(value))}
        onChange={(event) => {
          setRaw(event.target.value);
          const number = event.target.valueAsNumber;
          if (
            Number.isFinite(number) &&
            number >= min &&
            number <= max &&
            (step !== 1 || Number.isInteger(number))
          )
            onChange(number);
        }}
        onBlur={() => {
          const number = raw?.trim() ? Number(raw) : value;
          onChange(
            Number.isFinite(number)
              ? Math.min(
                  max,
                  Math.max(min, step === 1 ? Math.round(number) : number),
                )
              : value,
          );
          setRaw(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
