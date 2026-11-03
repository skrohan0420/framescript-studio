import { useState } from "react";
import {
  Check,
  Move,
  ListOrdered,
  Waves,
  Route,
  PencilLine,
  Layers,
  Video,
  Boxes,
} from "lucide-react";
import {
  animationTechniques,
  type AnimationDirection,
  type TechniqueSelection,
} from "../shared/animation-techniques";
import { threeStarter } from "../shared/three-runtime";
import { PromptTemplateChoice } from "./PromptTemplateChoice";
import type { PromptDraft } from "../shared/prompt-templates";
const techniqueIcons = {
  transform: Move,
  stagger: ListOrdered,
  spring: Waves,
  path: Route,
  reveal: PencilLine,
  parallax: Layers,
  camera: Video,
  assembly: Boxes,
};

export function PromptAnimation({
  draft,
  update,
}: {
  draft: PromptDraft;
  update: <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => void;
}) {
  const [status, setStatus] = useState("");
  const selected = draft.animationTechniques ?? [];
  const change = (id: string, patch: Partial<TechniqueSelection>) =>
    update(
      "animationTechniques",
      selected.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  return (
    <>
      <div className="prompt-section-caption">
        <strong>Animation techniques</strong>
        <p>
          Choose how subjects move. Combine techniques and fine-tune each one.
        </p>
      </div>
      <div className="prompt-form-card animation-rendering">
        <label className="field">
          <span>Rendering mode</span>
          <select
            aria-label="Rendering mode"
            value={draft.renderingMode ?? "auto"}
            onChange={(e) =>
              update(
                "renderingMode",
                e.target.value as AnimationDirection["renderingMode"],
              )
            }
          >
            <option value="auto">Follow the selected format</option>
            <option value="2d">2D · Canvas / SVG / HTML</option>
            <option value="2.5d">2.5D · Layers & perspective</option>
            <option value="3d">3D · Three.js</option>
          </select>
        </label>
        <p className="type-hint">
          {draft.renderingMode === "3d"
            ? "Real 3D meshes, lights and cameras. Three.js is included locally for preview and export. Start with procedural geometry; imported models and addons are not included yet."
            : "Rendering controls the scene construction. Animation choices below work across 2D and 3D."}
        </p>
        {draft.renderingMode === "3d" && (
          <>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(threeStarter);
                  setStatus(
                    "3D starter copied. Use Paste code to load it into the current scene.",
                  );
                } catch {
                  setStatus(
                    "Clipboard unavailable. Allow clipboard access and try again.",
                  );
                }
              }}
            >
              Copy working 3D starter
            </button>
            <p role="status" className="type-hint" hidden={!status}>
              {status}
            </p>
          </>
        )}
      </div>
      <div className="prompt-template-grid animation-technique-grid">
        {animationTechniques.map((item) => (
          <PromptTemplateChoice
            key={item.id}
            id={item.id}
            name={item.name}
            actionLabel={item.name}
            details={item}
            selected={selected.some((s) => s.id === item.id)}
            onSelect={() =>
              update(
                "animationTechniques",
                selected.some((s) => s.id === item.id)
                  ? selected.filter((s) => s.id !== item.id)
                  : [...selected, { id: item.id, variant: item.variants[0] }],
              )
            }
          >
            {(() => {
              const Icon = techniqueIcons[item.id];
              return <Icon size={17} />;
            })()}
            <span>{item.name}</span>
            {selected.some((s) => s.id === item.id) && <Check size={13} />}
          </PromptTemplateChoice>
        ))}
      </div>
      <p className="type-hint">
        Hover or focus a technique for details and an example. Select it to
        customize.
      </p>
      {selected.length > 0 && (
        <div className="prompt-form-card animation-shared">
          <strong>Shared motion settings</strong>
          {(
            [
              [
                "animationIntensity",
                "Motion intensity",
                ["Subtle", "Moderate", "Expressive"],
              ],
              [
                "animationEasing",
                "Easing",
                ["Smooth ease in/out", "Linear", "Ease out", "Ease in"],
              ],
              [
                "animationSync",
                "Synchronization",
                [
                  "Follow narration cues",
                  "Continuous motion",
                  "Emphasize key reveals",
                ],
              ],
            ] as const
          ).map(([key, label, options]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <select
                aria-label={label}
                value={
                  draft[key] ??
                  (key === "animationIntensity" ? "Moderate" : options[0])
                }
                onChange={(e) => update(key, e.target.value)}
              >
                {options.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {selected.map((item) => {
        const technique = animationTechniques.find((t) => t.id === item.id);
        if (!technique) return null;
        return (
          <fieldset className="prompt-form-card animation-config" key={item.id}>
            <legend>{technique.name}</legend>
            <p className="type-hint">
              {technique.detail} Example: {technique.example}
            </p>
            <label className="field">
              <span>{technique.name} variation</span>
              <select
                aria-label={`${technique.name} variation`}
                value={item.variant ?? technique.variants[0]}
                onChange={(e) => change(item.id, { variant: e.target.value })}
              >
                {technique.variants.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{technique.control}</span>
              <input
                value={item.amount ?? ""}
                placeholder={technique.placeholder}
                onChange={(e) => change(item.id, { amount: e.target.value })}
              />
            </label>
            <div className="animation-timing">
              <label className="field">
                <span>{technique.name} start (seconds)</span>
                <input
                  type="number"
                  min={0}
                  max={draft.duration}
                  step={0.1}
                  value={item.start ?? 0}
                  onChange={(e) =>
                    change(item.id, {
                      start: Math.max(
                        0,
                        Math.min(draft.duration, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </label>
              <label className="field">
                <span>{technique.name} duration (seconds)</span>
                <input
                  type="number"
                  min={0.05}
                  max={draft.duration}
                  step={0.1}
                  placeholder="Remaining scene"
                  value={item.duration ?? ""}
                  onChange={(e) =>
                    change(item.id, {
                      duration:
                        e.target.value === ""
                          ? undefined
                          : Math.max(
                              0.05,
                              Math.min(draft.duration, Number(e.target.value)),
                            ),
                    })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() =>
                update(
                  "animationTechniques",
                  selected.filter((s) => s.id !== item.id),
                )
              }
            >
              Remove {technique.name.toLowerCase()}
            </button>
          </fieldset>
        );
      })}
      <p className="type-hint">
        These choices guide generated code. They take effect when you paste the
        resulting scene; changing them does not modify existing animation.
      </p>
    </>
  );
}
