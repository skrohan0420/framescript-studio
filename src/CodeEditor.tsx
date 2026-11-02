import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.all";
import "monaco-editor/esm/vs/language/css/monaco.contribution";
import "monaco-editor/esm/vs/language/html/monaco.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/html/html.contribution";
import "monaco-editor/esm/vs/basic-languages/css/css.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
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

export default Editor;
