export const studioPalettes = [
  {
    "id": "silver",
    "name": "Obsidian",
    "note": "Neutral ink · crisp silver",
    "base": "#111214",
    "panel": "#1b1d21",
    "raised": "#292c32",
    "accent": "#d2d6df",
    "lightAccent": "#485367",
    "lightBase": "#e0e3e8",
    "lightPanel": "#edf0f4",
    "lightRaised": "#d4d9e1"
  },
  {
    "id": "graphite",
    "name": "Cobalt",
    "note": "Deep blue · electric periwinkle",
    "base": "#0b1124",
    "panel": "#141f38",
    "raised": "#223150",
    "accent": "#93b4ff",
    "lightAccent": "#294db0",
    "lightBase": "#dce3f1",
    "lightPanel": "#eaf0fa",
    "lightRaised": "#ccd7ec"
  },
  {
    "id": "plum",
    "name": "Ultraviolet",
    "note": "Black violet · luminous orchid",
    "base": "#171023",
    "panel": "#241932",
    "raised": "#352647",
    "accent": "#d4a3ff",
    "lightAccent": "#7434a1",
    "lightBase": "#e8dfef",
    "lightPanel": "#f2eaf8",
    "lightRaised": "#dfd1e9"
  },
  {
    "id": "forest",
    "name": "Pine",
    "note": "Evergreen · fresh mint",
    "base": "#0c1917",
    "panel": "#142923",
    "raised": "#213b31",
    "accent": "#83dbb3",
    "lightAccent": "#216546",
    "lightBase": "#dce8de",
    "lightPanel": "#eaf2e9",
    "lightRaised": "#cdddcf"
  },
  {
    "id": "ocean",
    "name": "Lagoon",
    "note": "Deep teal · tropical turquoise",
    "base": "#091b23",
    "panel": "#112e3a",
    "raised": "#1c414c",
    "accent": "#65dce5",
    "lightAccent": "#12616b",
    "lightBase": "#d9e8eb",
    "lightPanel": "#e7f2f3",
    "lightRaised": "#c8dfe3"
  },
  {
    "id": "copper",
    "name": "Ember",
    "note": "Warm charcoal · apricot orange",
    "base": "#211412",
    "panel": "#30201b",
    "raised": "#453027",
    "accent": "#ffb17b",
    "lightAccent": "#934521",
    "lightBase": "#eddfd4",
    "lightPanel": "#f6ece1",
    "lightRaised": "#e3cfbe"
  },
  {
    "id": "stone",
    "name": "Sandstone",
    "note": "Walnut · golden amber",
    "base": "#211d16",
    "panel": "#302b21",
    "raised": "#423b2c",
    "accent": "#e4c06d",
    "lightAccent": "#745317",
    "lightBase": "#e8dfcd",
    "lightPanel": "#f3ecdf",
    "lightRaised": "#dcd0b9"
  },
  {
    "id": "olive",
    "name": "Matcha",
    "note": "Moss green · bright chartreuse",
    "base": "#181c11",
    "panel": "#252d1b",
    "raised": "#37412a",
    "accent": "#c0dc7c",
    "lightAccent": "#4d651e",
    "lightBase": "#e2e7d3",
    "lightPanel": "#eff2e3",
    "lightRaised": "#d2dbbb"
  },
  {
    "id": "classic",
    "name": "Terminal",
    "note": "Near black · phosphor green",
    "base": "#080e0a",
    "panel": "#101d15",
    "raised": "#1b3022",
    "accent": "#72ed9c",
    "lightAccent": "#20643b",
    "lightBase": "#dce7e0",
    "lightPanel": "#e9f2ec",
    "lightRaised": "#cbded1"
  },
{
  "id": "aurora",
  "name": "Aurora",
  "note": "Soft gradient · mint into violet",
  "base": "#0d1622",
  "panel": "#172333",
  "raised": "#273448",
  "accent": "#96f0d2",
  "lightAccent": "#246354",
  "lightBase": "#dce5ee",
  "lightPanel": "#edf3f8",
  "lightRaised": "#d0dce9"
},
{
  "id": "sunset",
  "name": "Afterglow",
  "note": "Soft gradient · coral into golden peach",
  "base": "#21131e",
  "panel": "#30202c",
  "raised": "#44303b",
  "accent": "#ffc19c",
  "lightAccent": "#8b3d39",
  "lightBase": "#edddd9",
  "lightPanel": "#f9eee5",
  "lightRaised": "#e8cdc6"
},
{
  "id": "noir",
  "name": "Noir Gold",
  "note": "High contrast · black and champagne",
  "base": "#050607",
  "panel": "#101215",
  "raised": "#22262b",
  "accent": "#f4d18b",
  "lightAccent": "#735013",
  "lightBase": "#e1ded5",
  "lightPanel": "#f4f0e5",
  "lightRaised": "#d8d0bf"
},
{
  "id": "blueprint",
  "name": "Blueprint",
  "note": "High contrast · midnight and vivid ice",
  "base": "#030f25",
  "panel": "#0b1d36",
  "raised": "#18334e",
  "accent": "#78d6ff",
  "lightAccent": "#145c87",
  "lightBase": "#d6e3ed",
  "lightPanel": "#eaf4fb",
  "lightRaised": "#bfd5e5"
},
{
  "id": "synthwave",
  "name": "Synthwave",
  "note": "Creative gradient · pink and electric blue",
  "base": "#140d25",
  "panel": "#20162f",
  "raised": "#332442",
  "accent": "#ffacf0",
  "lightAccent": "#8d286e",
  "lightBase": "#e8ddee",
  "lightPanel": "#f7edf9",
  "lightRaised": "#dfcde6"
}
] as const;
export type StudioPalette = (typeof studioPalettes)[number]["id"];
export function readStudioPalette(value: unknown): StudioPalette {
  const legacy: Record<string, StudioPalette> = {
    navy: "graphite", slate: "graphite", mono: "silver",
    clay: "copper", espresso: "stone", burgundy: "plum",
  };
  if (typeof value === "string" && Object.hasOwn(legacy, value)) return legacy[value];
  return studioPalettes.some((p) => p.id === value)
    ? (value as StudioPalette)
    : "silver";
}
export const studioEditorTheme = (palette: StudioPalette, light: boolean) =>
  `framescript-${palette}-${light ? "light" : "dark"}`;

// Keep decorative gradients separate from solid editor and control colors.
export function studioPaletteFinish(id: StudioPalette, light: boolean): Record<string, string> {
  const colors: Partial<Record<StudioPalette, [string, string]>> = {
    aurora: ["#5ad9b0", "#a58bfa"],
    sunset: ["#ec7c91", "#edb869"],
    synthwave: ["#ec7cdd", "#638cf5"],
  };
  const pair = colors[id];
  const tokens = studioPaletteTokens(id, light);
  const strength = light ? 0.09 : 0.14;
  return {
    "--chrome-gradient": pair ? `linear-gradient(115deg, ${blend(tokens["--surface"], pair[0], strength)}, ${tokens["--surface"]} 52%, ${blend(tokens["--surface"], pair[1], strength)})` : "none",
    "--workspace-gradient": pair ? `linear-gradient(135deg, ${blend(tokens["--base"], pair[0], strength)}, ${tokens["--base"]} 55%, ${blend(tokens["--base"], pair[1], strength)})` : "none",
  };
}
function blend(a: string, b: string, weight: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - weight) +
            parseInt(b.slice(i, i + 2), 16) * weight,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function studioPaletteTokens(
  id: StudioPalette,
  light: boolean,
): Record<string, string> {
  const p = studioPalettes.find((p) => p.id === id)!;
  const classic = id === "classic";
  const panel = light ? p.lightPanel : p.panel;
  const raised = light ? p.lightRaised : p.raised;
  const base = light ? p.lightBase : p.base;
  const text = light ? "#202830" : "#edf0f5";
  const muted = light ? "#4a535b" : "#bec5ce";
  const accent = light ? p.lightAccent : p.accent;
  const wave = classic
    ? light
      ? "#12668c"
      : "#00b6e8"
    : blend(accent, muted, 0.45);
  return {
    "--base": base,
    "--surface": panel,
    "--raised": raised,
    "--input": light ? blend(panel, base, 0.35) : blend(p.base, p.panel, 0.55),
    "--editor": panel,
    "--stage": light ? blend(base, p.lightAccent, 0.12) : p.base,
    "--border": light ? blend(base, p.lightAccent, 0.32) : blend(raised, "#ffffff", 0.14),
    "--subtle-border": light ? blend(base, p.lightAccent, 0.17) : blend(raised, "#ffffff", 0.07),
    "--text": text,
    "--secondary": light ? "#454b53" : "#c6cbd0",
    "--muted": muted,
    "--accent": accent,
    "--accent-strong": accent,
    "--accent-wash": classic
      ? light
        ? "#def1f2"
        : "#17363a"
      : blend(panel, accent, light ? 0.1 : 0.13),
    "--on-accent": light ? "#ffffff" : p.base,
    "--hover": blend(raised, accent, 0.08),
    "--panel-header": classic && !light ? "#242424" : raised,
    "--timeline-background": panel,
    "--audio-voice-tone": wave,
    "--audio-music-tone": classic
      ? light
        ? "#14787e"
        : "#57ced0"
      : blend(wave, accent, 0.4),
    "--audio-sfx-tone": classic
      ? light
        ? "#386b8a"
        : "#73b3d6"
      : blend(wave, muted, 0.4),
    "--visual-fill": blend(panel, accent, light ? 0.12 : 0.2),
    "--visual-border": blend(panel, accent, 0.55),
    "--text-clip-fill":
      classic && !light ? "#984735" : blend(panel, accent, 0.24),
    "--text-clip-color": text,
    "--voice-fill": blend(panel, wave, light ? 0.12 : 0.16),
    "--music-fill": blend(panel, accent, 0.16),
    "--sfx-fill": blend(panel, muted, 0.16),
    "--voice-header": blend(panel, wave, 0.25),
    "--music-header": blend(panel, accent, 0.25),
    "--sfx-header": blend(panel, muted, 0.25),
  };
}
