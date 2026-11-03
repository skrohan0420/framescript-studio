import { Component, lazy, Suspense, type ReactNode } from "react";
import type { EditorProps } from "@monaco-editor/react";
const Editor = lazy(() => import("./CodeEditor"));
// A failed optional editor download must not replace the entire workspace with
// the root error screen or interrupt preview and autosave.
class EditorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="editor-loading" role="status">
        <p>
          The code editor couldn’t load. Your preview and workspace are still
          available.
        </p>
        <button type="button" onClick={() => location.reload()}>
          Reload workspace to retry
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function LazyEditor(props: EditorProps) {
  return (
    <EditorBoundary>
      <Suspense
        fallback={
          <div role="status" className="editor-loading">
            Loading code editor…
          </div>
        }
      >
        <Editor {...props} />
      </Suspense>
    </EditorBoundary>
  );
}
