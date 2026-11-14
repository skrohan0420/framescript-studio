import { useStatusNotice } from "./editor-status";
import type { AnimationDirection } from "../shared/animation-techniques";
import { threeStarter } from "../shared/three-runtime";
import type { PromptDraft } from "../shared/prompt-templates";

export function PromptAnimation({
  draft,
  update,
}: {
  draft: PromptDraft;
  update: <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => void;
}) {
  const notify = useStatusNotice();
  return (
    <>
      <div className="prompt-section-caption">
        <strong>Rendering mode</strong>
        <p>
          Choose 2D, 2.5D or 3D. The director plans motion techniques, camera behavior and timing.
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
            : "Rendering controls scene construction. The director chooses suitable movement within this mode."}
        </p>
        {draft.renderingMode === "3d" && (
          <>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(threeStarter);
                  notify(
                    "3D starter copied. Use Paste code to load it into the current scene.",
                  );
                } catch {
                  notify(
                    "Clipboard unavailable. Allow clipboard access and try again.",
                  );
                }
              }}
            >
              Copy working 3D starter
            </button>
          </>
        )}
      </div>
    </>
  );
}
