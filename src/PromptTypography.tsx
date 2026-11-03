import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";
import type { PromptDraft } from "../shared/prompt-templates";
import { PromptTextItems } from "./PromptTextItems";

const animations = {
  "Subtle fade": "Text gently fades in and stays still.",
  "Slide up": "Text rises a short distance while fading in.",
  "Word reveal": "Words appear in sequence within the entrance time.",
  Typewriter: "Letters appear one at a time within the entrance time.",
  "Scale in": "Text grows from 90% to full size.",
  "Mask reveal": "A horizontal mask reveals the line from left to right.",
  "Kinetic emphasis": "A small, controlled overshoot emphasizes the entrance.",
  "No animation": "Text appears immediately without movement.",
} as const;
const fonts = {
  "System sans-serif": '"Segoe UI", Arial, sans-serif',
  "Bold geometric sans-serif": 'Arial, "Segoe UI", sans-serif',
  "Editorial serif": 'Georgia, "Times New Roman", serif',
  "Monospace / technical": 'Consolas, "Courier New", monospace',
  "Rounded friendly sans-serif":
    '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
};
type Props = {
  draft: PromptDraft;
  update: <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => void;
  width: number;
  height: number;
};
export function PromptTypography({ draft, update, width, height }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(0),
    [replay, setReplay] = useState(0);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setPreviewWidth(element.clientWidth),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const animation = draft.textAnimation || "Subtle fade";
  const seconds = draft.textAnimationDuration ?? 0.4;
  const font = draft.textFont || "System sans-serif";
  const fill = /^#[0-9a-f]{6}$/i.test(draft.textFill ?? "")
    ? draft.textFill!
    : "#F5F5F5";
  const accent = /^#[0-9a-f]{6}$/i.test(draft.textAccent ?? "")
    ? draft.textAccent!
    : "#36D3DF";
  const backing = /^#[0-9a-f]{6}$/i.test(draft.textBacking ?? "")
    ? draft.textBacking!
    : "#111827";
  const titleSize = draft.titleSize ?? Math.round(height * 0.065),
    captionSize = draft.captionSize ?? Math.round(height * 0.04);
  const subtitles = !!draft.subtitles && draft.subtitles !== "Off";
  const treatment = draft.textTreatment || "Soft shadow";
  const common: CSSProperties = {
    fontFamily: fonts[font as keyof typeof fonts] ?? fonts["System sans-serif"],
    fontWeight: draft.textWeight ?? 600,
    lineHeight: draft.textLineHeight ?? 1.2,
    letterSpacing: draft.textTracking ?? 0,
    color: fill,
    textAlign: (draft.textAlign ?? "center") as CSSProperties["textAlign"],
    textShadow:
      treatment === "Soft shadow"
        ? `0 ${height * 0.002}px ${height * 0.006}px #000a`
        : undefined,
    WebkitTextStroke:
      treatment === "Outline" ? `${height * 0.001}px ${backing}` : undefined,
    background:
      treatment === "Solid backing"
        ? backing
        : treatment === "Translucent pill"
          ? `${backing}b3`
          : undefined,
    borderRadius: treatment === "Translucent pill" ? height * 0.02 : 0,
    padding:
      treatment === "Solid backing" || treatment === "Translucent pill"
        ? `${height * 0.009}px ${height * 0.015}px`
        : 0,
  };
  const place = (position: string): CSSProperties => ({
    position: "absolute",
    maxWidth: "80%",
    left: position.includes("left") ? "10%" : "50%",
    top: position.includes("Top")
      ? "10%"
      : position.includes("Bottom")
        ? undefined
        : "45%",
    bottom: position.includes("Bottom") ? "10%" : undefined,
    transform: position.includes("left") ? undefined : "translateX(-50%)",
    width: "max-content",
  });
  const animate = (text: string, caption = false) => {
    const parts = animation === "Typewriter" ? [...text] : text.split(/(\s+)/);
    if (
      (animation === "Word reveal" || animation === "Typewriter") &&
      !(
        caption &&
        (draft.subtitles === "Word-by-word highlight" ||
          draft.subtitles === "Karaoke highlight")
      )
    )
      return (
        <>
          {parts.map((part, i) => (
            <span
              key={i}
              className="type-preview-word"
              style={{ animationDelay: `${(i / parts.length) * seconds}s` }}
            >
              {part}
            </span>
          ))}
        </>
      );
    if (
      caption &&
      (draft.subtitles === "Word-by-word highlight" ||
        draft.subtitles === "Karaoke highlight")
    )
      return (
        <>
          {parts.map((part, i) => (
            <span
              key={i}
              className="type-preview-highlight"
              style={{ animationDelay: `${i * 0.13}s` }}
            >
              {part}
            </span>
          ))}
        </>
      );
    return text;
  };
  const entrance =
    {
      "Subtle fade": "typeFade",
      "Slide up": "typeSlide",
      "Scale in": "typeScale",
      "Mask reveal": "typeMask",
      "Kinetic emphasis": "typePop",
    }[animation] ?? "none";
  const entranceStyle: CSSProperties = {
    animation: `${entrance} ${seconds}s ease-out both`,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };
  const select = (
    key: keyof PromptDraft,
    label: string,
    options: readonly string[],
    fallback: string,
  ) => (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={String(draft[key] || fallback)}
        onChange={(e) => update(key, e.target.value as never)}
      >
        {options.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </label>
  );
  const number = (
    key: keyof PromptDraft,
    label: string,
    value: number,
    min: number,
    max: number,
    step = 1,
  ) => (
    <TypographyNumber
      key={key}
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(value) => update(key, value as never)}
    />
  );
  const preset = (name: string) => {
    const common = {
      textFill: "#F5F5F5",
      textAccent: "#36D3DF",
      textBacking: "#111827",
      titleSize: Math.round(height * 0.065),
      captionSize: Math.round(height * 0.04),
      textWeight: 600,
      textLineHeight: 1.2,
      textTracking: 0,
      textAnimationDuration: 0.4,
      titlePlacement: "Center",
      captionPlacement: "Bottom center",
      textAlign: "center",
    };
    const values = {
      ...common,
      ...(name === "Editorial"
        ? {
            textFont: "Editorial serif",
            textAnimation: "Subtle fade",
            textTreatment: "Clean text / no effects",
          }
        : name === "Bold headline"
          ? {
              textFont: "Bold geometric sans-serif",
              textWeight: 800,
              titleSize: Math.round(height * 0.09),
              textAnimation: "Scale in",
              textTreatment: "Soft shadow",
            }
          : name === "Caption focus"
            ? {
                subtitles: "Phrase subtitles",
                textFont: "System sans-serif",
                captionSize: Math.round(height * 0.05),
                textTreatment: "Translucent pill",
                textAnimation: "Word reveal",
              }
            : {
                textFont: "System sans-serif",
                textAnimation: "Subtle fade",
                textTreatment: "Soft shadow",
              }),
    };
    for (const [key, value] of Object.entries(values))
      update(key as keyof PromptDraft, value as never);
  };
  return (
    <>
      <div className="prompt-card-heading">
        <strong>Typography studio</strong>
        <span>Preview your choices</span>
      </div>
      <label className="prompt-check">
        <input
          type="checkbox"
          aria-label="Include typography in prompt"
          checked={draft.typographyEnabled === true}
          onChange={(event) =>
            update("typographyEnabled", event.target.checked)
          }
        />
        Include text in this video
      </label>
      <p className="type-control-help">
        {draft.typographyEnabled
          ? "Choose the text you want below. Only enabled items with your content are requested. These controls describe the prompt; generated code must implement them."
          : "Text is off. Saved typography choices are kept here but excluded from the prompt. No titles, labels, counters or subtitles will be requested."}
      </p>
      {draft.typographyEnabled && (
        <PromptTextItems
          draft={draft}
          update={update}
          width={width}
          height={height}
        />
      )}
      <div hidden={!draft.typographyEnabled}>
        <h3>Quick title, narration captions & shared defaults</h3>
        <div className="type-preview-heading">
          <span>
            Sample preview · {width} × {height}
          </span>
          <button
            aria-label="Replay typography preview"
            title="Replay typography preview"
            onClick={() => setReplay((n) => n + 1)}
          >
            <RotateCcw size={13} />
          </button>
        </div>
        <div
          ref={box}
          className="type-preview"
          style={{
            aspectRatio: `${width}/${height}`,
            maxWidth: height > width ? (240 * width) / height : undefined,
          }}
        >
          <div
            className="type-preview-stage"
            data-caption-mode={draft.subtitles}
            style={
              {
                width,
                height,
                transform: `scale(${previewWidth / width})`,
                "--type-accent": accent,
                "--type-entrance": `${seconds}s`,
              } as CSSProperties
            }
            key={`${replay}-${animation}-${draft.subtitles}-${seconds}`}
          >
            <div
              className="type-preview-orb"
              style={{
                width: height * 0.3,
                height: height * 0.3,
                left: "55%",
                top: "25%",
              }}
            />
            <div
              style={{
                ...place(draft.titlePlacement ?? "Center"),
                fontSize: titleSize,
              }}
            >
              <div
                style={{ ...common, ...entranceStyle }}
                data-testid="typography-title-preview"
              >
                {animate(draft.screenText || "Your headline")}
              </div>
            </div>
            {subtitles && (
              <div
                style={{
                  ...place(draft.captionPlacement ?? "Bottom center"),
                  fontSize: captionSize,
                }}
              >
                <div
                  style={{
                    ...common,
                    ...entranceStyle,
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: draft.captionLines ?? 2,
                    overflow: "hidden",
                  }}
                >
                  {animate(
                    (draft.script || "A clear idea, beautifully explained.")
                      .split(/\s+/)
                      .slice(0, 10)
                      .join(" "),
                    true,
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <small className="type-control-help">
          Sample text is only a preview. Add your title or enable subtitles to
          include text in the scene.
        </small>
        <div className="prompt-style-chips">
          {[
            "Clean explainer",
            "Bold headline",
            "Caption focus",
            "Editorial",
          ].map((name) => (
            <button key={name} onClick={() => preset(name)}>
              {name}
            </button>
          ))}
        </div>
        <details className="type-config-group" open>
          <summary>
            Titles & labels <small>Your exact words and position</small>
          </summary>
          <div className="type-config-fields">
            <label className="field">
              <span>Exact title / label text</span>
              <textarea
                aria-label="Exact on-screen text (optional)"
                rows={2}
                placeholder="Leave empty for no titles or labels"
                value={draft.screenText}
                onChange={(e) => update("screenText", e.target.value)}
              />
            </label>
            <div className="type-control-grid">
              {number("titleSize", "Title size (px)", titleSize, 8, 600)}
              {select(
                "titlePlacement",
                "Title placement",
                [
                  "Top left",
                  "Top center",
                  "Center",
                  "Bottom left",
                  "Bottom center",
                ],
                "Center",
              )}
            </div>
          </div>
        </details>
        <details className="type-config-group" open>
          <summary>
            Subtitles <small>From your narration</small>
          </summary>
          <div className="type-config-fields">
            {select(
              "subtitles",
              "Subtitles",
              [
                "Off",
                "Phrase subtitles",
                "Word-by-word highlight",
                "Karaoke highlight",
              ],
              "Off",
            )}
            <small className="type-control-help">
              {!subtitles
                ? "No subtitles will be generated."
                : draft.subtitles === "Phrase subtitles"
                  ? "One readable phrase at a time, following your narration."
                  : draft.subtitles === "Word-by-word highlight"
                    ? "The current spoken word changes to the accent color. Requires word timing; otherwise highlights phrases."
                    : "Words keep their highlight as the phrase is spoken. Requires word timing; otherwise highlights phrases."}
            </small>
            {subtitles && (
              <>
                <div className="type-control-grid">
                  {number(
                    "captionSize",
                    "Subtitle size (px)",
                    captionSize,
                    8,
                    300,
                  )}
                  {number(
                    "captionLines",
                    "Maximum lines",
                    draft.captionLines ?? 2,
                    1,
                    3,
                  )}
                </div>
                {select(
                  "captionPlacement",
                  "Subtitle placement",
                  ["Top center", "Center", "Bottom center"],
                  "Bottom center",
                )}
              </>
            )}
          </div>
        </details>
        <details className="type-config-group" open>
          <summary>
            Appearance <small>Font, color and readability</small>
          </summary>
          <div className="type-config-fields">
            {select(
              "textFont",
              "Font treatment",
              Object.keys(fonts),
              "System sans-serif",
            )}
            <small className="type-control-help">
              Uses installed system fonts. Missing fonts fall back to a similar
              local font.
            </small>
            <div className="type-control-grid">
              {number(
                "textWeight",
                "Font weight",
                draft.textWeight ?? 600,
                100,
                900,
                100,
              )}
              {select(
                "textAlign",
                "Text alignment",
                ["left", "center", "right"],
                "center",
              )}
              {number(
                "textLineHeight",
                "Line spacing",
                draft.textLineHeight ?? 1.2,
                0.8,
                2.5,
                0.1,
              )}
              {number(
                "textTracking",
                "Letter spacing (px)",
                draft.textTracking ?? 0,
                -5,
                20,
                0.5,
              )}
            </div>
            <div className="type-color-grid">
              {(
                [
                  ["textFill", "Text color", fill],
                  ["textAccent", "Highlight color", accent],
                  ["textBacking", "Backing color", backing],
                ] as const
              ).map(([key, label, color]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    aria-label={label}
                    type="color"
                    value={color}
                    onChange={(e) => update(key, e.target.value)}
                  />
                  <small>{color}</small>
                </label>
              ))}
            </div>
            {select(
              "textTreatment",
              "Readability",
              [
                "Soft shadow",
                "Solid backing",
                "Translucent pill",
                "Outline",
                "Clean text / no effects",
              ],
              "Soft shadow",
            )}
            <label className="field">
              <span>Extra color direction (optional)</span>
              <input
                aria-label="Text & highlight colors"
                value={draft.textColor ?? ""}
                placeholder="e.g. Use coral only on key numbers"
                onChange={(e) => update("textColor", e.target.value)}
              />
            </label>
          </div>
        </details>
        <details className="type-config-group" open>
          <summary>
            Animation <small>How text enters the frame</small>
          </summary>
          <div className="type-config-fields">
            {select(
              "textAnimation",
              "Text animation",
              Object.keys(animations),
              "Subtle fade",
            )}
            <small className="type-control-help">
              {animations[animation as keyof typeof animations]}
            </small>
            {animation !== "No animation" &&
              number(
                "textAnimationDuration",
                "Entrance time (seconds)",
                seconds,
                0.1,
                3,
                0.1,
              )}
          </div>
        </details>
      </div>
    </>
  );
}

function TypographyNumber({
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
  const [raw, setRaw] = useState(String(value)),
    [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setRaw(String(value));
  }, [value, editing]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={raw}
        onFocus={() => setEditing(true)}
        onChange={(event) => {
          setRaw(event.target.value);
          const next = event.target.valueAsNumber;
          if (Number.isFinite(next) && next >= min && next <= max)
            onChange(next);
        }}
        onBlur={() => {
          const next = raw.trim() ? Number(raw) : value;
          const bounded = Number.isFinite(next)
            ? Math.min(max, Math.max(min, next))
            : value;
          onChange(bounded);
          setRaw(String(bounded));
          setEditing(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}
