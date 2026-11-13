import {
  studioPalettes,
  studioPaletteTokens,
  type StudioPalette,
} from "./studio-palettes";

export function AppearanceSettings({
  palette,
  light,
  onPalette,
  onLight,
}: {
  palette: StudioPalette;
  light: boolean;
  onPalette: (value: StudioPalette) => void;
  onLight: (value: boolean) => void;
}) {
  const swatches = (id: StudioPalette) => {
    const tokens = studioPaletteTokens(id, light);
    return [
      tokens["--base"],
      tokens["--surface"],
      tokens["--raised"],
      tokens["--accent"],
    ];
  };
  return (
    <section
      className="settings-section appearance-settings"
      aria-label="Appearance"
    >
      <header>
        <div>
          <h3>Appearance</h3>
          <p>
            Choose from {studioPalettes.length} workspace palettes. Changes
            preview immediately and save automatically.
          </p>
        </div>
        <label className="field">
          <span>Appearance mode</span>
          <select
            aria-label="Appearance mode"
            value={light ? "light" : "dark"}
            onChange={(e) => onLight(e.target.value === "light")}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </header>
      <div
        className="appearance-palettes"
        role="group"
        aria-label="Color palette"
      >
        {studioPalettes.map((p) => (
          <button
            type="button"
            key={p.id}
            aria-pressed={palette === p.id}
            aria-label={p.name}
            onClick={() => onPalette(p.id)}
          >
            <span className="appearance-swatches" aria-hidden="true">
              {swatches(p.id).map((color, i) => (
                <i key={i} style={{ background: color }} />
              ))}
            </span>
            <strong>{p.name}</strong>
            <small>{p.note}</small>
            <span className="appearance-selected">
              {palette === p.id ? "Selected" : "Choose palette"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
