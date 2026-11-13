import { studioPalettes, studioPaletteTokens, studioEditorTheme } from "./studio-palettes";
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
for (const palette of studioPalettes) for (const light of [false, true]) {
  const tokens = studioPaletteTokens(palette.id, light);
  monaco.editor.defineTheme(studioEditorTheme(palette.id, light), {
    base: light ? "vs" : "vs-dark", inherit: true,
    rules: light ? [] : [{ token: "comment", foreground: tokens["--muted"].slice(1) }, { token: "tag", foreground: tokens["--accent"].slice(1) }, { token: "string", foreground: "C5B79A" }, { token: "keyword", foreground: "A2B4C8" }],
    colors: {
      "editor.background": tokens["--editor"], "editor.foreground": tokens["--text"],
      "editorLineNumber.foreground": tokens["--muted"], "editorLineNumber.activeForeground": tokens["--text"],
      "editor.lineHighlightBackground": tokens["--raised"], "editor.selectionBackground": tokens["--visual-fill"],
      "editorCursor.foreground": tokens["--accent"], "editorIndentGuide.background1": tokens["--subtle-border"],
    },
  });
}

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
