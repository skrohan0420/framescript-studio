import Editor, {
  DiffEditor,
  loader,
  type DiffEditorProps,
} from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type { EditorProps } from "@monaco-editor/react";
import { DefaultLinesDiffComputer } from "monaco-editor/esm/vs/editor/common/diff/defaultLinesDiffComputer/defaultLinesDiffComputer.js";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.all";
import "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess";
import "monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess";
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

export type SourceEditorProps = EditorProps & { gutterBaseline?: string };

export default function SourceEditor({
  gutterBaseline,
  onMount,
  ...props
}: SourceEditorProps) {
  const [instance, setInstance] =
    useState<monaco.editor.IStandaloneCodeEditor>();
  useEffect(() => {
    if (!instance || gutterBaseline === undefined) return;
    const markers = instance.createDecorationsCollection();
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const model = instance.getModel();
        if (!model || model.getValue() === gutterBaseline) {
          markers.clear();
          return;
        }
        const lines = model.getLinesContent();
        const { changes } = new DefaultLinesDiffComputer().computeDiff(
          gutterBaseline.split(/\r\n|\r|\n/),
          lines,
          {
            ignoreTrimWhitespace: false,
            maxComputationTimeMs: 30,
            computeMoves: false,
          },
        );
        markers.set(
          changes.map(({ original, modified }) => {
            const removed =
              modified.startLineNumber === modified.endLineNumberExclusive;
            const added =
              original.startLineNumber === original.endLineNumberExclusive;
            const atEnd = modified.startLineNumber > lines.length;
            const start = Math.min(modified.startLineNumber, lines.length);
            const end = removed ? start : modified.endLineNumberExclusive - 1;
            const kind = removed ? "removed" : added ? "added" : "modified";
            return {
              range: new monaco.Range(start, 1, end, 1),
              options: {
                linesDecorationsClassName: `code-gutter-${kind}${atEnd ? " code-gutter-at-end" : ""}`,
                linesDecorationsTooltip: `${kind[0].toUpperCase()}${kind.slice(1)} code`,
              },
            };
          }),
        );
      }, 120);
    };
    const content = instance.onDidChangeModelContent(update);
    const model = instance.onDidChangeModel(update);
    update();
    return () => {
      clearTimeout(timer);
      content.dispose();
      model.dispose();
      markers.clear();
    };
  }, [instance, gutterBaseline]);
  return (
    <Editor
      {...props}
      onMount={(editor, api) => {
        setInstance(editor);
        onMount?.(editor, api);
      }}
    />
  );
}

export type ChangesEditorProps = DiffEditorProps & {
  onChange: (value: string) => void;
};

export function ChangesEditor({
  onChange,
  onMount,
  ...props
}: ChangesEditorProps) {
  const current = useRef({ value: props.modified, onChange });
  current.current = { value: props.modified, onChange };
  return (
    <DiffEditor
      {...props}
      onMount={(diff, api) => {
        const modified = diff.getModifiedEditor();
        modified.onDidChangeModelContent(() => {
          const value = modified.getValue();
          if (value !== current.current.value) current.current.onChange(value);
        });
        onMount?.(diff, api);
      }}
    />
  );
}
