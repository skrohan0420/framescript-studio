import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { templateDetails } from "../shared/prompt-templates";

export function PromptTemplateChoice({
  id,
  name,
  selected,
  onSelect,
  children,
  details: providedDetails,
  actionLabel,
}: {
  id: string;
  name: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  details?: { detail: string; example: string };
  actionLabel?: string;
}) {
  const tooltipId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPosition(null);
  };
  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const box = button.current?.getBoundingClientRect();
      if (!box) return;
      const width = Math.min(310, window.innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
        top: box.top > 230 ? box.top - 8 : box.bottom + 8,
      });
    }, 500);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!position) return;
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [position]);
  const above =
    !!position &&
    !!button.current &&
    button.current.getBoundingClientRect().top > 230;
  const details = providedDetails ?? templateDetails[id];
  return (
    <>
      <button
        ref={button}
        aria-label={actionLabel ?? `Use ${name} template`}
        aria-pressed={selected}
        aria-describedby={position ? tooltipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") schedule();
        }}
        onPointerLeave={close}
        onFocus={schedule}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "Escape" && position) {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
        onClick={() => {
          close();
          onSelect();
        }}
      >
        {children}
      </button>
      {position &&
        createPortal(
          <div
            role="tooltip"
            id={tooltipId}
            className="prompt-template-tooltip"
            style={{
              left: position.left,
              top: position.top,
              transform: above ? "translateY(-100%)" : undefined,
            }}
          >
            <strong>{name}</strong>
            <p>{details.detail}</p>
            <span>Example</span>
            <p>{details.example}</p>
            <small>
              Changes the generated prompt. It does not edit your current scene.
            </small>
          </div>,
          document.body,
        )}
    </>
  );
}
