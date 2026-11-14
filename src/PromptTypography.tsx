import type { PromptDraft } from "../shared/prompt-templates";

export function PromptTypography({ draft, update }: {
  draft: PromptDraft;
  update: <K extends keyof PromptDraft>(key: K, value: PromptDraft[K]) => void;
}) {
  return (
    <div className="prompt-form-card">
      <div className="prompt-card-heading"><strong>Typography</strong><span>Optional</span></div>
      <label className="prompt-check">
        <input type="checkbox" checked={draft.typographyEnabled === true}
          onChange={(event) => update("typographyEnabled", event.target.checked)} />
        Include text in this video
      </label>
      <p>The director chooses useful wording, density, placement, appearance and animation from your narration and video theme. Text stays off when disabled. Full narration subtitles require an explicit request in essential instructions.</p>
    </div>
  );
}
