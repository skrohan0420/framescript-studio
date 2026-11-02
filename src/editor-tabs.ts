const key = "framescript.editor-tabs.v1";
export function readEditorTabs(): {
  leftView?: string;
  rightTab?: string;
  codeTab?: string;
} {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
export function saveEditorTabs(
  leftView: string,
  rightTab: string,
  codeTab: string,
) {
  try {
    localStorage.setItem(key, JSON.stringify({ leftView, rightTab, codeTab }));
  } catch {}
}
