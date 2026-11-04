export const shortcuts = {
  save: ["Project", "Save and apply code", "Mod+KeyS"],
  saveCopy: ["Project", "Save a .frame copy", "Mod+Shift+KeyS"],
  newProject: ["Project", "New project", "Mod+Alt+KeyN"],
  openProject: ["Project", "Open project file", "Mod+Alt+KeyO"],
  home: ["Project", "Save and return home", "Mod+Alt+KeyH"],
  export: ["Project", "Open export settings", "Mod+Alt+KeyE"],
  settings: ["Project", "Open project settings", "Mod+Comma"],
  shortcuts: ["Project", "Open keyboard shortcuts", "Shift+F1"],
  undo: ["Project", "Undo project edit", "Mod+Alt+KeyZ"],
  redo: ["Project", "Redo project edit", "Mod+Alt+Shift+KeyZ"],
  recovery: ["Project", "Open recovery history", "Mod+Alt+KeyR"],
  play: ["Preview and timeline", "Play or pause", "Space"],
  run: ["Preview and timeline", "Run preview", "Mod+Enter"],
  previousFrame: ["Preview and timeline", "Previous frame", "ArrowLeft"],
  nextFrame: ["Preview and timeline", "Next frame", "ArrowRight"],
  stop: ["Preview and timeline", "Stop and rewind", "Shift+Space"],
  fullscreen: [
    "Preview and timeline",
    "Toggle fullscreen preview",
    "Alt+Enter",
  ],
  split: ["Preview and timeline", "Split at playhead", "KeyW"],
  deleteText: ["Preview and timeline", "Delete selected text layer", "Delete"],
  snapping: ["Preview and timeline", "Toggle timeline snapping", "KeyG"],
  timeline: ["Preview and timeline", "Show or hide timeline", "Mod+Alt+KeyT"],
  rulers: ["Preview and timeline", "Toggle preview rulers", "Alt+KeyR"],
  fit: ["Preview and timeline", "Fit preview to panel", "Alt+Digit0"],
  zoomIn: ["Preview and timeline", "Zoom preview in", "Alt+Equal"],
  zoomOut: ["Preview and timeline", "Zoom preview out", "Alt+Minus"],
  combinedPreview: [
    "Preview and timeline",
    "Toggle combined timeline preview",
    "Mod+Alt+KeyB",
  ],
  code: ["Panels", "Open code panel", "Mod+Alt+KeyC"],
  media: ["Panels", "Open media panel", "Mod+Alt+KeyI"],
  importMedia: ["Panels", "Import images", "Mod+Alt+Shift+KeyI"],
  audio: ["Panels", "Open audio panel", "Mod+Alt+KeyA"],
  prompts: ["Panels", "Open prompt builder", "Mod+Alt+KeyP"],
  typography: ["Panels", "Open typography panel", "Mod+Alt+KeyY"],
  theme: ["Panels", "Toggle light or dark theme", "Mod+Alt+KeyJ"],
  expand: ["Code editor", "Toggle expanded editor", "Mod+Alt+KeyM"],
  all: ["Code editor", "Show combined source", "Alt+Digit1"],
  html: ["Code editor", "Show HTML", "Alt+Digit2"],
  css: ["Code editor", "Show CSS", "Alt+Digit3"],
  js: ["Code editor", "Show JavaScript", "Alt+Digit4"],
  splitCode: ["Code editor", "Show split code editors", "Alt+Digit5"],
  find: ["Code editor", "Find in code", "Mod+KeyF"],
  replace: ["Code editor", "Replace in code", "Mod+KeyH"],
  goToLine: ["Code editor", "Go to line", "Mod+KeyG"],
  commands: ["Code editor", "Monaco command palette", "F1"],
  format: ["Code editor", "Format document", "Alt+Shift+KeyF"],
  diff: ["Code editor", "Toggle code diff", "Mod+Alt+KeyD"],
  history: ["Code editor", "Open code history", "Mod+Alt+KeyV"],
  problems: ["Code editor", "Toggle Problems", "Mod+Shift+KeyM"],
  console: ["Code editor", "Toggle preview Console", "Mod+Alt+KeyL"],
  terminal: ["Code editor", "Toggle PowerShell Terminal", "Mod+Alt+Backquote"],
  wrap: ["Code editor", "Toggle word wrap", "Alt+KeyZ"],
  pasteDocument: [
    "Code editor",
    "Open full HTML paste dialog",
    "Mod+Alt+Shift+KeyV",
  ],
} as const;

export type ShortcutId = keyof typeof shortcuts;
export type ShortcutOverrides = Partial<Record<ShortcutId, string | null>>;
export const shortcutIds = Object.keys(shortcuts) as ShortcutId[];
export const previewShortcutIds = new Set<ShortcutId>([
  "play",
  "previousFrame",
  "nextFrame",
  "stop",
  "rulers",
  "fit",
  "zoomIn",
  "zoomOut",
]);
export const shortcutBinding = (
  id: ShortcutId,
  overrides: ShortcutOverrides,
) => (overrides[id] === undefined ? shortcuts[id][2] : overrides[id]);

export function keyboardChord(
  event: Pick<
    KeyboardEvent,
    | "code"
    | "key"
    | "ctrlKey"
    | "metaKey"
    | "altKey"
    | "shiftKey"
    | "isComposing"
  >,
) {
  if (
    event.isComposing ||
    /^(Control|Alt|Shift|Meta|Dead|Process|Unidentified|CapsLock)$/.test(
      event.key,
    )
  )
    return null;
  const key = event.key;
  const code =
    event.code ||
    (/^[a-z]$/i.test(key)
      ? `Key${key.toUpperCase()}`
      : /^[0-9]$/.test(key)
        ? `Digit${key}`
        : key === " "
          ? "Space"
          : key);
  if (
    !/^(Key[A-Z]|Digit[0-9]|Numpad\w+|F(?:[1-9]|1[0-9]|2[0-4])|Arrow(?:Up|Down|Left|Right)|Space|Enter|Tab|Escape|Delete|Backspace|Home|End|PageUp|PageDown|Comma|Period|Slash|Backslash|Semicolon|Quote|BracketLeft|BracketRight|Backquote|Minus|Equal|Insert)$/.test(
      code,
    )
  )
    return null;
  return [
    event.ctrlKey || event.metaKey ? "Mod" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    code,
  ]
    .filter(Boolean)
    .join("+");
}

export function formatShortcut(chord: string) {
  const symbols: Record<string, string> = {
    Mod: /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backquote: "`",
    Minus: "−",
    Equal: "=",
    Escape: "Esc",
  };
  return chord
    .split("+")
    .map(
      (key) =>
        symbols[key] ?? key.replace(/^(Key|Digit)/, "").replace(/^Arrow/, ""),
    )
    .join("+");
}

export function readShortcutOverrides(value: unknown): ShortcutOverrides {
  if (!value || typeof value !== "object") return {};
  const result: ShortcutOverrides = {};
  const values = value as Record<string, unknown>;
  for (const id of shortcutIds) {
    const binding = values[id];
    if (
      binding === null ||
      (typeof binding === "string" &&
        /^(Mod\+)?(Alt\+)?(Shift\+)?[A-Za-z0-9]+$/.test(binding))
    )
      result[id] = binding;
  }
  return result;
}
