import React from "react";
import { createRoot } from "react-dom/client";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { App } from "./App";
import "./style.css";
(self as any).MonacoEnvironment = {
  getWorker: (_: unknown, label: string) =>
    label === "css"
      ? new CssWorker()
      : label === "html"
        ? new HtmlWorker()
        : ["typescript", "javascript"].includes(label)
          ? new TsWorker()
          : new EditorWorker(),
};
loader.config({ monaco });
monaco.editor.defineTheme("framescript-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "8291A3" },
    { token: "tag", foreground: "70B7FF" },
    { token: "attribute.name", foreground: "A8D9BE" },
    { token: "string", foreground: "DDBE8A" },
    { token: "keyword", foreground: "80BFFF" },
  ],
  colors: {
    "editor.background": "#151B23",
    "editor.foreground": "#DCE5EF",
    "editorLineNumber.foreground": "#738397",
    "editorLineNumber.activeForeground": "#DCE5EF",
    "editor.lineHighlightBackground": "#202A36",
    "editor.selectionBackground": "#294D76",
    "editorCursor.foreground": "#80BFFF",
    "editorIndentGuide.background1": "#2B3644",
  },
});
monaco.editor.defineTheme("framescript-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#FFFFFF",
    "editor.foreground": "#243246",
    "editorLineNumber.foreground": "#77869A",
    "editor.lineHighlightBackground": "#F1F5F9",
    "editor.selectionBackground": "#D7E9FF",
    "editorCursor.foreground": "#1769CC",
  },
});
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>Workspace error</h1>
        <p>{this.state.error}</p>
        <button onClick={() => location.reload()}>
          Reload and recover autosave
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
export { Editor };
