import { useEffect, useRef, useState } from "react";
import { documentFor } from "../shared/runtime";
import { useStudio } from "./store";
import type { Project } from "../shared/project";
export function Preview({
  run,
  select,
  onSelect,
  onReady,
  onVisual,
  zoom,
  projectOverride,
}: {
  run: number;
  select: boolean;
  onSelect: (s: any) => void;
  onReady: (s: any) => void;
  onVisual: (s: any) => void;
  zoom: number;
  projectOverride?: Project;
}) {
  const { project: storedProject, revision, time, setError } = useStudio();
  const project = projectOverride ?? storedProject;
  const [active, setActive] = useState("");
  const [candidate, setCandidate] = useState("");
  const [candidateKey, setCandidateKey] = useState(0);
  const activeRef = useRef<HTMLIFrameElement>(null),
    candidateRef = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setFit(
        Math.min(
          (r.width - 56) / project.settings.width,
          (r.height - 56) / project.settings.height,
        ),
      );
    });
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [project.settings.width, project.settings.height]);
  useEffect(() => {
    const id = setTimeout(() => {
      setError("");
      setCandidate(documentFor(project));
      setCandidateKey((k) => k + 1);
    }, 500);
    return () => clearTimeout(id);
  }, [revision, run, projectOverride]);
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.framescript) return;
      const pending = e.source === candidateRef.current?.contentWindow;
      const visible = e.source === activeRef.current?.contentWindow;
      if (!pending && !visible) return;
      if (e.data.type === "error") {
        setError(String(e.data.value));
        if (pending) setCandidate("");
      }
      if (e.data.type === "ready" && pending) {
        setActive(candidate);
        setCandidate("");
        onReady(e.data.value);
      }
      if (e.data.type === "selection" && visible) onSelect(e.data.value);
      if (e.data.type === "visual" && visible) onVisual(e.data.value);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [candidate, onSelect, onReady, onVisual]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "seek", value: time },
      "*",
    );
  }, [time, active]);
  useEffect(() => {
    activeRef.current?.contentWindow?.postMessage(
      { framescript: true, type: "select", value: select },
      "*",
    );
  }, [select, active]);
  const s = Math.max(0.01, fit * zoom);
  const frameStyle = {
    width: project.settings.width,
    height: project.settings.height,
    transform: `scale(${s})`,
    transformOrigin: "top left",
  };
  return (
    <div ref={box} className="preview-area">
      <div
        className="canvas-wrap"
        style={{
          width: project.settings.width * s,
          height: project.settings.height * s,
        }}
      >
        <iframe
          title="Animation preview"
          ref={activeRef}
          sandbox="allow-scripts"
          srcDoc={active}
          style={frameStyle}
          onLoad={() => {
            activeRef.current?.contentWindow?.postMessage(
              { framescript: true, type: "seek", value: timeRef.current },
              "*",
            );
            activeRef.current?.contentWindow?.postMessage(
              { framescript: true, type: "select", value: select },
              "*",
            );
          }}
        />
        {candidate && (
          <iframe
            key={candidateKey}
            title="Validating animation"
            className="candidate"
            ref={candidateRef}
            sandbox="allow-scripts"
            srcDoc={candidate}
            style={frameStyle}
          />
        )}
      </div>
      <span className="canvas-note">
        {project.settings.width} × {project.settings.height} ·{" "}
        {project.settings.background === "transparent" ? "ALPHA" : "RGB"} ·{" "}
        {Math.round(s * 100)}%
      </span>
    </div>
  );
}
