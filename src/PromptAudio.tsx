import { Music, AudioLines } from "lucide-react";
import type { PromptDraft } from "../shared/prompt-templates";

export function PromptAudio({ draft, onChange, structured }: {
  draft: PromptDraft;
  onChange: (patch: Pick<PromptDraft, "bgm" | "sfx" | "audio">) => void;
  structured: boolean;
}) {
  return (
    <div className="prompt-form-card">
      <div className="prompt-card-heading"><strong>Audio</strong><span>Optional</span></div>
      <p>Choose whether to include music and sound effects. The director decides their treatment and timing, keeping narration clear.</p>
      {structured && <p role="note">Structured output does not support audio. Select a code output to include music or sound effects.</p>}
      <label className="prompt-check">
        <input type="checkbox" checked={!!draft.bgm} disabled={structured}
          onChange={(event) => onChange({ bgm: event.target.checked })} />
        <Music size={16} aria-hidden="true" /> Background music
      </label>
      <label className="prompt-check">
        <input type="checkbox" checked={!!draft.sfx} disabled={structured}
          onChange={(event) => onChange({ sfx: event.target.checked })} />
        <AudioLines size={16} aria-hidden="true" /> Sound effects
      </label>
    </div>
  );
}
