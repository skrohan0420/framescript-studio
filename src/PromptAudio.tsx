import { Music, AudioLines } from "lucide-react";
import { useEffect, useState } from "react";
import type { PromptDraft } from "../shared/prompt-templates";
import {
  restoreAudioDirection,
  audioDirectionSchema,
  audioPresets,
  musicStyles,
  musicMoods,
  musicEnergies,
  musicTempos,
  musicTimings,
  musicEndings,
  musicTextures,
  effectTypes,
  effectDensities,
  effectCharacters,
  effectPlacements,
  narrationBalances,
  type AudioDirection,
} from "../shared/prompt-audio";

export function PromptAudio({
  draft,
  onChange,
  structured,
}: {
  draft: PromptDraft;
  onChange: (patch: Pick<PromptDraft, "bgm" | "sfx" | "audio">) => void;
  structured: boolean;
}) {
  const audio = restoreAudioDirection(draft.audio);
  const [bpmInput, setBpmInput] = useState<string | null>(null);
  useEffect(() => setBpmInput(null), [audio.musicTempo, audio.musicBpm]);
  const setAudio = (patch: Partial<AudioDirection>) =>
    onChange({ audio: audioDirectionSchema.parse({ ...audio, ...patch }) });
  const field = (
    key: Exclude<
      keyof AudioDirection,
      | "effectTypes"
      | "effectPlacement"
      | "notes"
      | "musicTextures"
      | "musicBpm"
      | "musicVolume"
      | "musicFadeIn"
      | "musicFadeOut"
      | "musicNotes"
      | "effectVolume"
      | "effectNotes"
    >,
    label: string,
    options: readonly string[],
  ) => (
    <label className="field" key={key}>
      <span>{label}</span>
      <select
        aria-label={label}
        value={audio[key]}
        onChange={(event) => setAudio({ [key]: event.target.value })}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
  const choices = (
    key: "effectTypes" | "effectPlacement" | "musicTextures",
    label: string,
    options: readonly string[],
  ) => (
    <fieldset className="prompt-audio-choices">
      <legend>{label}</legend>
      <div className="prompt-field-suggestions">
        {options.map((option) => {
          const selected = audio[key].some((value) => value === option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                setAudio({
                  [key]: selected
                    ? audio[key].filter((value) => value !== option)
                    : [...audio[key], option],
                })
              }
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
  const slider = (
    key: "musicVolume" | "effectVolume" | "musicFadeIn" | "musicFadeOut",
    label: string,
    maximum: number,
    step: number,
  ) => (
    <label className="field prompt-audio-slider">
      <span>
        {label}
        <output>
          {maximum === 1
            ? Math.round(audio[key] * 100) + "%"
            : audio[key].toFixed(1) + "s"}
        </output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={0}
        max={maximum}
        step={step}
        value={audio[key]}
        onChange={(event) => setAudio({ [key]: Number(event.target.value) })}
      />
    </label>
  );
  return (
    <div className="prompt-audio-studio">
      <div className="prompt-form-card">
        <div className="prompt-card-heading">
          <strong>Audio presets</strong>
          <span>Optional</span>
        </div>
        <div
          className="prompt-field-suggestions"
          role="group"
          aria-label="Audio presets"
        >
          {audioPresets.map((preset) => (
            <button
              key={preset.name}
              type="button"
              aria-pressed={
                draft.bgm === preset.bgm &&
                draft.sfx === preset.sfx &&
                Object.entries(preset.audio).every(
                  ([key, value]) =>
                    ["notes", "musicNotes", "effectNotes"].includes(key) ||
                    JSON.stringify(audio[key as keyof AudioDirection]) ===
                      JSON.stringify(value),
                )
              }
              onClick={() =>
                onChange({
                  bgm: preset.bgm,
                  sfx: preset.sfx,
                  audio: {
                    ...preset.audio,
                    notes: audio.notes,
                    musicNotes: audio.musicNotes,
                    effectNotes: audio.effectNotes,
                  },
                })
              }
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
      <div className="prompt-audio-cards">
        <div className="prompt-form-card">
          <div className="prompt-card-heading">
            <strong>
              <Music size={16} aria-hidden="true" /> Background music
            </strong>
            <label className="prompt-check">
              <input
                type="checkbox"
                checked={draft.bgm ?? false}
                onChange={(event) => onChange({ bgm: event.target.checked })}
              />
              BGM
            </label>
          </div>
          {!draft.bgm && (
            <p className="type-hint">
              Enable BGM to include music in the generated scene.
            </p>
          )}
          <fieldset disabled={!draft.bgm} className="prompt-audio-controls">
            <div className="prompt-audio-fields">
              {field("musicStyle", "Music style", musicStyles)}
              {field("musicMood", "Music mood", musicMoods)}
              {field("musicEnergy", "Music energy", musicEnergies)}
              {field("musicTempo", "Music tempo", musicTempos)}
              {audio.musicTempo === "Custom BPM" && (
                <label className="field">
                  <span>Beats per minute</span>
                  <input
                    aria-label="Beats per minute"
                    type="number"
                    min={40}
                    max={240}
                    step={1}
                    value={bpmInput ?? audio.musicBpm}
                    onChange={(event) => {
                      setBpmInput(event.target.value);
                      const bpm = Number(event.target.value);
                      if (Number.isInteger(bpm) && bpm >= 40 && bpm <= 240)
                        setAudio({ musicBpm: bpm });
                    }}
                    onBlur={() => setBpmInput(null)}
                  />
                </label>
              )}
              {field("musicTiming", "Music timing", musicTimings)}
              {field("musicEnding", "Music ending", musicEndings)}
            </div>
            <details className="prompt-audio-advanced">
              <summary>Advanced music</summary>
              <div className="prompt-audio-controls">
                {choices("musicTextures", "Music textures", musicTextures)}
                {slider("musicVolume", "Music volume", 1, 0.01)}
                <div className="prompt-audio-fields">
                  {slider("musicFadeIn", "Music fade in", 10, 0.1)}
                  {slider("musicFadeOut", "Music fade out", 10, 0.1)}
                </div>
                <label className="field">
                  <span>Music-specific instructions</span>
                  <textarea
                    aria-label="Music-specific instructions"
                    rows={2}
                    maxLength={2000}
                    value={audio.musicNotes}
                    onChange={(event) =>
                      setAudio({ musicNotes: event.target.value })
                    }
                    placeholder="Soft keys with a slow bass pulse…"
                  />
                </label>
              </div>
            </details>
          </fieldset>
        </div>
        <div className="prompt-form-card">
          <div className="prompt-card-heading">
            <strong>
              <AudioLines size={16} aria-hidden="true" /> Sound effects
            </strong>
            <label className="prompt-check">
              <input
                type="checkbox"
                checked={draft.sfx ?? false}
                onChange={(event) => onChange({ sfx: event.target.checked })}
              />
              SFX
            </label>
          </div>
          {!draft.sfx && (
            <p className="type-hint">
              Enable SFX to include sound effects in the generated scene.
            </p>
          )}
          <fieldset disabled={!draft.sfx} className="prompt-audio-controls">
            {choices("effectTypes", "Effect types", effectTypes)}
            <div className="prompt-audio-fields">
              {field("effectDensity", "Effect density", effectDensities)}
              {field("effectCharacter", "Effect character", effectCharacters)}
            </div>
            {choices("effectPlacement", "Effect placement", effectPlacements)}
            <details className="prompt-audio-advanced">
              <summary>Advanced effects</summary>
              <div className="prompt-audio-controls">
                {slider("effectVolume", "Effect volume", 1, 0.01)}
                <label className="field">
                  <span>Effect-specific instructions</span>
                  <textarea
                    aria-label="Effect-specific instructions"
                    rows={2}
                    maxLength={2000}
                    value={audio.effectNotes}
                    onChange={(event) =>
                      setAudio({ effectNotes: event.target.value })
                    }
                    placeholder="One soft impact at the reveal; avoid repeated whooshes…"
                  />
                </label>
              </div>
            </details>
          </fieldset>
        </div>
      </div>
      <div className="prompt-form-card">
        <div className="prompt-card-heading">
          <strong>Mix & direction</strong>
        </div>
        <fieldset
          disabled={!draft.bgm && !draft.sfx}
          className="prompt-audio-controls"
        >
          {field("narrationBalance", "Narration balance", narrationBalances)}
          <label className="field">
            <span>Custom audio instructions</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={audio.notes}
              onChange={(event) => setAudio({ notes: event.target.value })}
              placeholder="Quiet space ambience, one soft impact when the galaxy appears…"
            />
          </label>
        </fieldset>
        <p className="type-hint">
          {structured
            ? "These preferences guide the brief. Structured scenes do not include audio tracks."
            : "These settings guide the generated soundtrack. Music and effects become editable timeline tracks when the generated code is applied."}
        </p>
      </div>
    </div>
  );
}
