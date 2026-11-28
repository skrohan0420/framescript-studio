import { useId, useState, type CSSProperties } from "react";
import { Film, Globe2, Copy, Check, Settings, X } from "lucide-react";
import type { Project } from "../shared/project";
import { readReferenceConfig, referenceLookKey, referenceLookFont, type ReferenceConfig } from "../shared/reference-config";
import type { PromptDraft } from "../shared/prompt-templates";
import { PromptDirectionStudio } from "./PromptDirectionStudio";

function LookSettings({ name, style, config, onChange }: {
  name: string;
  style: string;
  config: ReferenceConfig;
  onChange: (value: ReferenceConfig) => void;
}) {
  const id = useId();
  const anchor = `--look-${id.replace(/[^a-z0-9]/gi, "")}`;
  const font = referenceLookFont({ ...config, referenceStyle: style });
  return <>
    <button type="button" className="look-settings-trigger" title={`Settings for ${name}`}
      aria-label={`Settings for ${name}`} popoverTarget={id}
      style={{ anchorName: anchor } as CSSProperties}>
      <Settings size={15} aria-hidden="true" />
    </button>
    <div id={id} popover="auto" className="look-settings-popover"
      role="group" aria-label={`${name} settings`}
      style={{ positionAnchor: anchor } as CSSProperties}>
      <header><strong>{name}</strong>
        <button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label="Close look settings">
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      <label className="field"><span>Font</span>
        <select aria-label="Reference look font" value={font}
          onChange={event => onChange({ ...config, referenceLookSettings: {
            ...config.referenceLookSettings,
            [referenceLookKey(style)]: { font: event.target.value },
          } })}>
          {[...new Set(["Outfit", "Arial", "Verdana", "Georgia", "monospace", font])].map(value =>
            <option key={value}>{value}</option>)}
        </select>
      </label>
    </div>
  </>;
}

export function ConfigSettings({ project, home, globalConfig, onGlobalConfig, onProjectConfig }: {
  project: Project;
  home: boolean;
  globalConfig: ReferenceConfig;
  onGlobalConfig: (value: ReferenceConfig) => void;
  onProjectConfig: (value: ReferenceConfig) => void;
}) {
  const [scope, setScope] = useState<"project" | "global">(home ? "global" : "project");
  const active = home ? "global" : scope;
  const config = active === "global" ? globalConfig : readReferenceConfig(project.promptDraft);
  const save = active === "global" ? onGlobalConfig : onProjectConfig;
  const draft: PromptDraft = {
    template: "canvas", script: "", duration: project.settings.duration,
    style: "", visuals: "", camera: "", screenText: "", notes: "",
    format: "document", ...config,
  };
  return <section className="config-settings" aria-label="Reference look config">
    <header className="config-heading">
      <h3>Config</h3>
      <span className="config-save-note"><Check size={14} aria-hidden="true" /> Autosaved</span>
    </header>
    <div className="config-toolbar">
    <div className="config-scope" role="group" aria-label="Config scope">
      <button type="button" disabled={home} aria-pressed={active === "project"}
        onClick={() => setScope("project")}><Film size={16} aria-hidden="true" />Project config</button>
      <button type="button" aria-pressed={active === "global"}
        onClick={() => setScope("global")}><Globe2 size={16} aria-hidden="true" />Global config</button>
    </div>
    {active === "project" && <button type="button" className="config-copy-global"
      aria-label="Copy global config to this project" onClick={() => save({ ...globalConfig })}>
      <Copy size={14} aria-hidden="true" /> Copy global defaults
    </button>}
    </div>
    <div className="config-scope-description">
      {active === "project" ? <><Film size={14} aria-hidden="true" />
        <span>{project.name}</span>
      </> : <><Globe2 size={14} aria-hidden="true" />
        <span>Defaults for new projects</span>
      </>}
    </div>
    <label className="field"><span>Rendering</span>
      <select aria-label="Rendering mode" value={config.renderingMode}
        onChange={event => save(readReferenceConfig({ ...config, renderingMode: event.target.value }))}>
        <option value="3d">Stylized true 3D</option>
        <option value="2.5d">2.5D depth and parallax</option>
        <option value="2d">2D illustration</option>
        <option value="auto">Director decides</option>
      </select>
      <small>Applies to new prompts. Reference colors and shapes adapt to this choice; existing scenes stay as saved.</small>
    </label>
    <PromptDirectionStudio key={active} kind="reference" compact draft={draft}
      renderLookSettings={(style, name) => <LookSettings name={name} style={style} config={config} onChange={save} />}
      update={(key, value) => {
        if (key === "referenceStyle" || key === "referenceInfluence" || key === "referenceNotes")
          save(readReferenceConfig({ ...config, [key]: value }));
      }} />
  </section>;
}
