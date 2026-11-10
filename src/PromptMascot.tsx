import type { PromptDraft } from "../shared/prompt-templates";

export function PromptMascot({
  draft,
  update,
}: {
  draft: PromptDraft;
  update: <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => void;
}) {
  return (
    <>
      <div className="prompt-card-heading">
        <strong>Mascot</strong>
        <span>Optional character direction</span>
      </div>
      <label className="prompt-check">
        <input
          type="checkbox"
          aria-label="Include mascot in prompt"
          checked={draft.mascotEnabled === true}
          onChange={(event) => update("mascotEnabled", event.target.checked)}
        />
        Include my mascot in this scene
      </label>
      <p className="type-control-help">
        Add a mascot reference image in Output to include it in the ZIP, or
        attach it in your AI chat with the prompt and ZIP.
      </p>
      {!draft.mascotEnabled && (
        <p className="type-control-help">
          Mascot is off. Saved mascot choices are excluded from the prompt.
        </p>
      )}
      {draft.mascotEnabled && (
        <div className="text-item-editor">
          {(
            [
              ["mascotName", "Mascot name (optional)", "e.g. Orbit"],
              [
                "mascotIdentity",
                "Mascot identity to preserve",
                "Face, proportions, colors, outfit and details that must match the reference",
              ],
              [
                "mascotRole",
                "Mascot role in this scene",
                "e.g. A curious guide explaining the solar system",
              ],
              [
                "mascotActions",
                "Mascot actions & expressions",
                "e.g. Point to Mars, look surprised, then nod at the final result",
              ],
              [
                "mascotPlacement",
                "Mascot placement & interactions",
                "e.g. Bottom left, facing the planet; do not cover labels",
              ],
              [
                "mascotScale",
                "Mascot size & framing",
                "e.g. Full body, about 25% of the frame height",
              ],
              [
                "mascotTiming",
                "Mascot appearance timing",
                "e.g. Enter at 2s, point at 4s, exit at 8s; use narration cues",
              ],
              [
                "mascotNotes",
                "Extra mascot direction",
                "Props, poses, movement limits, or other requirements",
              ],
            ] as const
          ).map(([key, label, placeholder]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <textarea
                rows={key === "mascotName" ? 1 : 2}
                aria-label={label}
                maxLength={key === "mascotName" ? 200 : 3000}
                placeholder={placeholder}
                value={draft[key] ?? ""}
                onChange={(event) => update(key, event.target.value)}
              />
            </label>
          ))}
          <p className="type-control-help">
            The reference guides the mascot’s silhouette, palette, and identifying details.
          </p>
        </div>
      )}
    </>
  );
}
