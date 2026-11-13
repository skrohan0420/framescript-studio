export const studioPalettes = [
  {
    id: "graphite",
    name: "Graphite / Blue",
    note: "Cool charcoal, steel blue",
    base: "#121416",
    panel: "#1b1e22",
    raised: "#25292e",
    accent: "#8ba3bd",
    lightAccent: "#425d7b",
  },
  {
    id: "stone",
    name: "Warm / Stone",
    note: "Warm neutrals, soft stone",
    base: "#171614",
    panel: "#22201d",
    raised: "#2c2925",
    accent: "#b7aa94",
    lightAccent: "#6b5b43",
  },
  {
    id: "silver",
    name: "Carbon / Silver",
    note: "Neutral charcoal, silver",
    base: "#101112",
    panel: "#1b1c1e",
    raised: "#26282b",
    accent: "#c7cbd0",
    lightAccent: "#50565e",
  },
  {
    id: "navy",
    name: "Deep Navy",
    note: "Dark ink, quiet blue",
    base: "#10141b",
    panel: "#19212b",
    raised: "#252f3c",
    accent: "#8b9db5",
    lightAccent: "#415774",
  },
  {
    id: "olive",
    name: "Muted Olive",
    note: "Forest charcoal, sage",
    base: "#141611",
    panel: "#1e221b",
    raised: "#2a3025",
    accent: "#a4ad91",
    lightAccent: "#53603b",
  },
  {
    id: "clay",
    name: "Clay / Sand",
    note: "Earth tones, muted clay",
    base: "#191412",
    panel: "#251f1b",
    raised: "#322a24",
    accent: "#c0a18d",
    lightAccent: "#785443",
  },
  {
    id: "plum",
    name: "Plum / Smoke",
    note: "Smoky charcoal, dusty plum",
    base: "#171318",
    panel: "#231d26",
    raised: "#302934",
    accent: "#b4a2bf",
    lightAccent: "#6d4f79",
  },
  {
    id: "burgundy",
    name: "Burgundy / Ash",
    note: "Wine charcoal, muted rose",
    base: "#1a1315",
    panel: "#281f22",
    raised: "#352a2e",
    accent: "#c3a0a8",
    lightAccent: "#7b4d5b",
  },
  {
    id: "forest",
    name: "Forest / Sage",
    note: "Deep forest, soft sage",
    base: "#101714",
    panel: "#1b2620",
    raised: "#27362d",
    accent: "#a0b8a9",
    lightAccent: "#3e6653",
  },
  {
    id: "slate",
    name: "Slate / Ice",
    note: "Cool slate, pale blue gray",
    base: "#13171a",
    panel: "#20272c",
    raised: "#2c353d",
    accent: "#a6bac9",
    lightAccent: "#446478",
  },
  {
    id: "copper",
    name: "Copper / Ink",
    note: "Dark brown, brushed copper",
    base: "#171412",
    panel: "#251f1b",
    raised: "#342a22",
    accent: "#c5a187",
    lightAccent: "#7b563b",
  },
  {
    id: "espresso",
    name: "Espresso / Cream",
    note: "Coffee surfaces, warm cream",
    base: "#191512",
    panel: "#28211c",
    raised: "#362e26",
    accent: "#c8b79f",
    lightAccent: "#6b5840",
  },
  {
    id: "ocean",
    name: "Ocean / Fog",
    note: "Blue charcoal, misted teal",
    base: "#101719",
    panel: "#1b272b",
    raised: "#28373c",
    accent: "#9cbabd",
    lightAccent: "#3b666c",
  },
  {
    id: "mono",
    name: "Black / White",
    note: "Near-black surfaces, neutral white",
    base: "#080808",
    panel: "#161616",
    raised: "#242424",
    accent: "#dedede",
    lightAccent: "#454545",
  },
  {
    id: "classic",
    name: "Classic / Cyan",
    note: "Black surfaces, cyan accent",
    base: "#000000",
    panel: "#1c1c1c",
    raised: "#262626",
    accent: "#00c1cd",
    lightAccent: "#006e77",
  },
] as const;
export type StudioPalette = (typeof studioPalettes)[number]["id"];
export function readStudioPalette(value: unknown): StudioPalette {
  return studioPalettes.some((p) => p.id === value)
    ? (value as StudioPalette)
    : "silver";
}
export const studioEditorTheme = (palette: StudioPalette, light: boolean) =>
  `framescript-${palette}-${light ? "light" : "dark"}`;
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
  const warm = [
    "stone",
    "clay",
    "olive",
    "burgundy",
    "copper",
    "espresso",
  ].includes(id);
  const classic = id === "classic";
  const panel = light ? (warm ? "#faf8f4" : "#ffffff") : p.panel;
  const raised = light ? (warm ? "#ece8e1" : "#e7eaee") : p.raised;
  const base = light ? (warm ? "#efede8" : "#eceef1") : p.base;
  const text = light ? "#202328" : "#e7e9ec";
  const muted = light ? (warm ? "#635b51" : "#59616a") : "#b0b4ba";
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
    "--input": light ? panel : blend(p.base, p.panel, 0.55),
    "--editor": classic ? (light ? "#fbfbfc" : "#171717") : panel,
    "--stage": light ? "#dfe1e4" : p.base,
    "--border": light ? "#92979e" : blend(raised, "#ffffff", 0.14),
    "--subtle-border": light ? "#d0d3d7" : blend(raised, "#ffffff", 0.07),
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
