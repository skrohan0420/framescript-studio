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
    "editor.background": "#141417",
    "editor.foreground": "#F4F4F5",
    "editorLineNumber.foreground": "#A5A5AF",
    "editorLineNumber.activeForeground": "#F4F4F5",
    "editor.lineHighlightBackground": "#242428",
    "editor.selectionBackground": "#26413D",
    "editorCursor.foreground": "#39D8C7",
    "editorIndentGuide.background1": "#343439",
  },
});
monaco.editor.defineTheme("framescript-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#FBFBFC",
    "editor.foreground": "#19191D",
    "editorLineNumber.foreground": "#62626C",
    "editor.lineHighlightBackground": "#EFEFF2",
    "editor.selectionBackground": "#D6EBE5",
    "editorCursor.foreground": "#06766B",
  },
});

export default Editor;
