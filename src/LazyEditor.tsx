import { Component, lazy, Suspense, type ReactNode } from "react";
import type { ChangesEditorProps, SourceEditorProps } from "./CodeEditor";
import { StatusActivity } from "./editor-status";
const Editor = lazy(() => import("./CodeEditor"));
const Changes = lazy(() =>
  import("./CodeEditor").then((module) => ({ default: module.ChangesEditor })),
);
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
function EditorLoader({ children }: { children: ReactNode }) {
  return (
    <EditorBoundary>
      <Suspense
        fallback={<StatusActivity message="Loading code editor…" />}
      >
        {children}
      </Suspense>
    </EditorBoundary>
  );
}
export default function LazyEditor(props: SourceEditorProps) {
  return (
    <EditorLoader>
      <Editor {...props} />
    </EditorLoader>
  );
}
export function LazyChangesEditor(props: ChangesEditorProps) {
  return (
    <EditorLoader>
      <Changes {...props} />
    </EditorLoader>
  );
}
