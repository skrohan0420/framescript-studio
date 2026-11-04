import { useEffect, useRef, useState } from "react";
import type { CodeSnapshot } from "../shared/rpc";
import SyntaxWorker from "./code-syntax.worker?worker";
import type {
  Location,
  ProblemLanguage,
  SyntaxProblem,
  SyntaxRequest,
  SyntaxResult,
} from "./code-syntax.worker";

export type { ProblemLanguage } from "./code-syntax.worker";

const labels = {
  html: "HTML",
  css: "CSS",
  js: "JavaScript",
  all: "Combined HTML",
};

export function useCodeSyntax(
  { html, css, js }: CodeSnapshot,
  enabled: boolean,
  combinedHtml?: string,
) {
  const worker = useRef<Worker | null>(null);
  const request = useRef(0);
  const immediate = useRef(false);
  const [check, setCheck] = useState(0);
  const [problems, setProblems] = useState<SyntaxProblem[]>([]);
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let instance: Worker;
    const fail = () => {
      setFailure(true);
      setChecking(false);
    };
    try {
      instance = new SyntaxWorker();
    } catch {
      fail();
      return;
    }
    worker.current = instance;
    setFailure(false);
    instance.onmessage = ({ data }: MessageEvent<SyntaxResult>) => {
      if (data.id !== request.current) return;
      setProblems(data.problems);
      setChecking(false);
    };
    instance.onerror = fail;
    return () => {
      instance.terminate();
      worker.current = null;
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !worker.current) return;
    const id = ++request.current;
    const delay = immediate.current ? 0 : 450;
    immediate.current = false;
    setChecking(true);
    const timer = setTimeout(
      () =>
        worker.current?.postMessage({
          id,
          code: { html, css, js },
          combinedHtml,
        } satisfies SyntaxRequest),
      delay,
    );
    return () => {
      clearTimeout(timer);
      request.current++;
    };
  }, [enabled, html, css, js, combinedHtml, check]);
  return {
    problems,
    checking,
    failure,
    checkNow: () => {
      immediate.current = true;
      setCheck((count) => count + 1);
    },
  };
}

export function CodeProblems({
  syntax,
  parseError,
  previewError,
  previewLocation,
  projectError,
  onJump,
}: {
  syntax: ReturnType<typeof useCodeSyntax>;
  parseError: string;
  previewError: string;
  previewLocation?: Location;
  projectError: string;
  onJump: (language: ProblemLanguage, location: Location) => void;
}) {
  const { problems, failure, checking, checkNow } = syntax;
  return (
    <section className="code-problems" aria-label="Code problems">
      <header>
        <strong>Problems</strong>
        <button onClick={checkNow} disabled={failure}>
          Check syntax
        </button>
      </header>
      {failure && <p role="alert">The syntax checker couldn’t load.</p>}
      {!failure && checking && <p role="status">Checking syntax…</p>}
      {!failure && !checking && problems.length === 0 && !parseError && (
        <p role="status">No syntax errors found.</p>
      )}
      {parseError && (
        <p className="code-problem-message">Combined document · {parseError}</p>
      )}
      {problems.map(({ language, location, message }, index) => (
        <p key={`${language}-${index}`} className="code-problem-message">
          {location ? (
            <button
              disabled={checking}
              onClick={() => onJump(language, location)}
            >
              {labels[language]} · Line {location.line}, column{" "}
              {location.column}
            </button>
          ) : (
            <strong>{labels[language]}</strong>
          )}
          <span>{message}</span>
        </p>
      ))}
      {previewError && (
        <p className="code-problem-message">
          {previewLocation ? (
            <button onClick={() => onJump("js", previewLocation)}>
              Preview error · Line {previewLocation.line}, column{" "}
              {previewLocation.column}
            </button>
          ) : (
            <strong>Preview error</strong>
          )}
          <span>{previewError}</span>
        </p>
      )}
      {projectError && (
        <p className="code-problem-message">
          <strong>Project error</strong>
          <span>{projectError}</span>
        </p>
      )}
    </section>
  );
}
