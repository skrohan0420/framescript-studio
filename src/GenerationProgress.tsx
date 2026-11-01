import { useEffect, useRef } from "react";
import { Check, Code2, LoaderCircle, Square } from "lucide-react";

export function GenerationProgress({
  stage,
  seconds,
  characters,
  model,
  onCancel,
}: {
  stage: string;
  seconds: number;
  characters: number;
  model: string;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);
  const step = /validat/i.test(stage) ? 2 : characters > 0 ? 1 : 0;
  const labels = [
    "Waiting for the model",
    "Generating HTML, CSS & JavaScript",
    "Validating & updating the preview",
  ];
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <section
      ref={ref}
      className="generation-card"
      aria-label="Animation generation progress"
    >
      <div className="generation-heading">
        <span className="generation-icon">
          <Code2 size={18} />
        </span>
        <div>
          <strong>Building your animation</strong>
          <span className="generation-model" title={model}>
            {model || "AI assistant"}
          </span>
        </div>
        <span className="generation-live">
          <span />
          Live
        </span>
      </div>
      <p className="generation-stage" role="status" aria-live="polite">
        {stage}
      </p>
      <div
        className="generation-activity"
        role="progressbar"
        aria-label="Generation activity"
        aria-valuetext={stage}
      >
        <span />
      </div>
      <div className="generation-metrics" aria-live="off">
        <div>
          <span>Elapsed time</span>
          <strong>{elapsed}</strong>
        </div>
        <div>
          <span>Code received</span>
          <strong>
            {characters.toLocaleString()} <small>characters</small>
          </strong>
        </div>
      </div>
      <ol className="generation-steps">
        {labels.map((label, index) => (
          <li
            key={label}
            className={
              index < step ? "done" : index === step ? "current" : "upcoming"
            }
            aria-current={index === step ? "step" : undefined}
          >
            <span className="generation-step-icon">
              {index < step ? (
                <Check size={13} />
              ) : index === step ? (
                <LoaderCircle size={14} className="generation-spinner" />
              ) : (
                <span />
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <div className="generation-footer">
        <p>
          {step === 2
            ? "Checking the response before applying changes."
            : characters
              ? "Code is arriving. Your preview updates when validation finishes."
              : seconds >= 30
                ? "Still waiting for the first code. You can wait or cancel."
                : "Waiting for the first code from the model."}
        </p>
        <button onClick={onCancel} aria-label="Cancel generation">
          <Square size={12} />
          Cancel
        </button>
      </div>
    </section>
  );
}
