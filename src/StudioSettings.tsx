import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Palette,
  Code2,
  Film,
  HardDrive,
  History,
  SlidersHorizontal,
} from "lucide-react";
import { Modal, Field } from "./components";
import { AppearanceSettings } from "./AppearanceSettings";
import type { StudioPalette } from "./studio-palettes";
import type { Project } from "../shared/project";
import type { ReferenceConfig } from "../shared/reference-config";
import { ConfigSettings } from "./ConfigSettings";

const tabs = [
  { id: "appearance", name: "Appearance", icon: Palette },
  { id: "editor", name: "Editor", icon: Code2 },
  { id: "config", name: "Config", icon: SlidersHorizontal },
  { id: "project", name: "Project", icon: Film, project: true },
  { id: "storage", name: "Storage", icon: HardDrive },
  { id: "recovery", name: "Recovery", icon: History, project: true },
] as const;
type Tab = (typeof tabs)[number]["id"];
type Props = {
  open: boolean;
  home: boolean;
  onClose: () => void;
  palette: StudioPalette;
  light: boolean;
  onPalette: (id: StudioPalette) => void;
  onLight: (value: boolean) => void;
  project: Project;
  globalConfig: ReferenceConfig;
  onGlobalConfig: (value: ReferenceConfig) => void;
  onProjectConfig: (value: ReferenceConfig) => void;
  onProject: (patch: Partial<Project["settings"]>) => void;
  autosave: boolean;
  onAutosave: (value: boolean) => void;
  fontSize: number;
  onFontSize: (value: number) => void;
  onKeyboard: () => void;
  onRecovery: () => void;
  onRecoveryCopy: () => void;
  onSaveCopy: () => void;
  onSource: () => void;
  onTrash: () => void;
  storage: { files: number; bytes: number; retentionDays: number } | null;
  onCheckStorage: () => void;
  onClearStorage: () => void;
  services?: ReactNode;
};

export function StudioSettings(p: Props) {
  const [tab, setTab] = useState<Tab>("appearance");
  const id = useId();
  const enabled = tabs.filter((t) => !p.home || !("project" in t));
  const active = enabled.some((t) => t.id === tab) ? tab : "appearance";
  const title = tabs.find((t) => t.id === active)!.name;
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = enabled.findIndex((t) => t.id === active);
    let next: number;
    if (["ArrowDown", "ArrowRight"].includes(event.key))
      next = (index + 1) % enabled.length;
    else if (["ArrowUp", "ArrowLeft"].includes(event.key))
      next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    else return;
    event.preventDefault();
    setTab(enabled[next].id);
    document.getElementById(`${id}-${enabled[next].id}`)?.focus();
  };
  return (
    <Modal
      title="Project & application settings"
      open={p.open}
      onClose={p.onClose}
    >
      <div className="studio-settings">
        <div className="studio-settings-body">
          <nav
            className="settings-nav"
            role="tablist"
            aria-label="Settings categories"
            aria-orientation="vertical"
          >
            <small>PREFERENCES</small>
            {tabs.map((t) => {
              const Icon = t.icon;
              const disabled = p.home && "project" in t;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${id}-${t.id}`}
                  aria-controls={`${id}-${t.id}-panel`}
                  aria-selected={active === t.id}
                  disabled={disabled}
                  title={
                    disabled
                      ? "Open a project in the editor to change these settings"
                      : t.name
                  }
                  tabIndex={active === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={navigate}
                >
                  <Icon size={16} />
                  <span>{t.name}</span>
                </button>
              );
            })}
            <p>
              {p.home
                ? "Application preferences are available without opening a project."
                : "Project changes apply to the current workspace."}
            </p>
          </nav>
          <main
            className="settings-content"
            role="tabpanel"
            id={`${id}-${active}-panel`}
            aria-labelledby={`${id}-${active}`}
            tabIndex={0}
          >
            {active !== "appearance" && active !== "config" && (
              <header className="settings-page-heading">
                <h3>{title}</h3>
                <p>
                  {active === "project" ||
                  active === "recovery"
                    ? p.project.name
                    : "Application preferences · saved automatically"}
                </p>
              </header>
            )}
            {active === "appearance" && (
              <AppearanceSettings
                palette={p.palette}
                light={p.light}
                onPalette={p.onPalette}
                onLight={p.onLight}
              />
            )}
            {active === "editor" && (
              <>
                <div className="settings-grid">
                  <Field label="Workspace save mode">
                    <select
                      value={p.autosave ? "auto" : "manual"}
                      onChange={(e) => p.onAutosave(e.target.value === "auto")}
                    >
                      <option value="auto">Autosave</option>
                      <option value="manual">Manual save</option>
                    </select>
                  </Field>
                  <Field label="Editor font size">
                    <input
                      type="number"
                      min={10}
                      max={28}
                      value={p.fontSize}
                      onChange={(e) =>
                        p.onFontSize(
                          Math.min(28, Math.max(10, Number(e.target.value))),
                        )
                      }
                    />
                  </Field>
                </div>
                <section className="settings-action-group">
                  <h4>Keyboard shortcuts</h4>
                  <p>Search commands and customize key bindings.</p>
                  <button onClick={p.onKeyboard}>Keyboard shortcuts</button>
                </section>
                {p.services}
              </>
            )}
            {active === "config" && (
              <ConfigSettings project={p.project} home={p.home}
                globalConfig={p.globalConfig} onGlobalConfig={p.onGlobalConfig}
                onProjectConfig={p.onProjectConfig} />
            )}
            {active === "project" && (
              <>
                <div className="settings-grid">
                  {(
                    [
                      ["width", "Canvas width"],
                      ["height", "Canvas height"],
                      ["duration", "Duration (seconds)"],
                      ["fps", "Frame rate"],
                      ["speed", "Playback speed"],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <input
                        type="number"
                        step={key === "duration" || key === "speed" ? 0.1 : 1}
                        value={p.project.settings[key]}
                        onChange={(e) =>
                          p.onProject({ [key]: Number(e.target.value) })
                        }
                      />
                    </Field>
                  ))}
                  <Field label="Background (CSS color or transparent)">
                    <input
                      value={p.project.settings.background}
                      onChange={(e) =>
                        p.onProject({ background: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Export timing">
                    <select
                      value={p.project.settings.timing}
                      onChange={(e) =>
                        p.onProject({
                          timing: e.target.value as "seek" | "replay",
                        })
                      }
                    >
                      <option value="seek">Seek CSS / renderFrame(time)</option>
                      <option value="replay">
                        Replay browser timers (export only)
                      </option>
                    </select>
                  </Field>
                </div>
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={p.project.settings.network}
                    onChange={(e) => p.onProject({ network: e.target.checked })}
                  />
                  Allow animation network access
                </label>
                <div className="settings-button-row">
                  <button onClick={p.onSaveCopy}>Save copy as .frame</button>
                  <button onClick={p.onSource}>Export HTML source</button>
                </div>
                <section className="settings-action-group">
                  <h4>Project management</h4>
                  <button className="settings-danger" onClick={p.onTrash}>
                    Move saved project to trash
                  </button>
                </section>
              </>
            )}
            {active === "storage" && (
              <section className="settings-action-group">
                <h4>Rendered files</h4>
                <p>
                  Local render copies expire after 7 days. Clearing completed
                  copies removes their local download links. Files saved
                  elsewhere and active exports are kept.
                </p>
                {p.storage && (
                  <p role="status">
                    {p.storage.files} files ·{" "}
                    {(p.storage.bytes / 1_000_000).toFixed(1)} MB retained
                  </p>
                )}
                <div className="settings-button-row">
                  <button onClick={p.onCheckStorage}>
                    Check retained renders
                  </button>
                  <button onClick={p.onClearStorage}>
                    Clear completed renders
                  </button>
                </div>
              </section>
            )}
            {active === "recovery" && (
              <section className="settings-action-group">
                <h4>Workspace recovery</h4>
                <p>
                  Review saved checkpoints or download the current workspace as
                  a recovery copy.
                </p>
                <div className="settings-button-row">
                  <button onClick={p.onRecovery}>Recovery history</button>
                  <button onClick={p.onRecoveryCopy}>
                    Download recovery copy
                  </button>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </Modal>
  );
}
