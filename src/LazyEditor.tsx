import { lazy, Suspense } from "react";
import type { EditorProps } from "@monaco-editor/react";
const Editor = lazy(() => import("./CodeEditor"));
export default function LazyEditor(props: EditorProps) {
  return (
    <Suspense
      fallback={
        <div role="status" className="editor-loading">
          Loading code editor…
        </div>
      }
    >
      <Editor {...props} />
    </Suspense>
  );
}
