import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

export function ExportHelp({
  id,
  label,
  children,
  choices,
  selected,
  note,
}: {
  id: string;
  label: string;
  children: ReactNode;
  choices: { value: string; title: string; detail: string; example: string }[];
  selected: string;
  note: string;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinned = useRef(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    maxHeight: number;
  } | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const close = () => {
    pinned.current = false;
    clear();
    setPosition(null);
  };
  const open = () => {
    clear();
    const box = anchor.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(360, innerWidth - 32);
    const right = box.right + width + 24 <= innerWidth;
    const left = box.left - width - 8 >= 16;
    let maxHeight = Math.min(420, innerHeight - 32);
    let top = Math.max(16, Math.min(box.top, innerHeight - maxHeight - 16));
    if (!right && !left) {
      const below = innerHeight - box.bottom - 24;
      if (below >= 180) {
        maxHeight = Math.min(maxHeight, below);
        top = box.bottom + 8;
      } else {
        maxHeight = Math.max(60, Math.min(maxHeight, box.top - 24));
        top = Math.max(16, box.top - maxHeight - 8);
      }
    }
    setPosition({
      left: right
        ? box.right + 8
        : left
          ? box.left - width - 8
          : Math.max(16, Math.min(box.left, innerWidth - width - 16)),
      top,
      maxHeight,
    });
  };
  const schedule = () => {
    clear();
    timer.current = setTimeout(open, 500);
  };
  const scheduleClose = () => {
    if (pinned.current) return;
    clear();
    timer.current = setTimeout(() => setPosition(null), 150);
  };
  useEffect(() => () => clear(), []);
  useEffect(() => {
    if (!position) return;
    const onScroll = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".export-help-tooltip")
      )
        return;
      open();
    };
    const onOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !anchor.current?.contains(target) &&
        !target.closest(".export-help-tooltip")
      )
        close();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onOutside, true);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onOutside, true);
    };
  }, [!!position]);
  return (
    <div
      ref={anchor}
      className="export-help-field"
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") schedule();
      }}
      onPointerLeave={scheduleClose}
      onFocusCapture={schedule}
      onBlurCapture={close}
      onPointerDown={(e) => {
        if (!(e.target as Element).closest(".export-help-trigger")) close();
      }}
      onKeyDownCapture={(e) => {
        if (e.key === "Escape" && position) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      {children}
      <button
        type="button"
        className="export-help-trigger"
        aria-label={`About ${label.toLowerCase()}`}
        aria-describedby={position ? id : undefined}
        onClick={() => {
          if (position) close();
          else {
            pinned.current = true;
            open();
          }
        }}
      >
        <CircleHelp size={14} />
      </button>
      {position &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="export-help-tooltip"
            style={position}
            onPointerEnter={clear}
            onPointerLeave={scheduleClose}
          >
            <strong>{label}: which should I choose?</strong>
            {choices.map((choice) => (
              <section
                key={choice.value}
                data-selected={choice.value === selected}
              >
                <b>
                  {choice.title}
                  {choice.value === selected ? " · selected" : ""}
                </b>
                <p>{choice.detail}</p>
                <small>Example: {choice.example}</small>
              </section>
            ))}
            <p className="export-help-note">{note}</p>
          </div>,
          document.body,
        )}
    </div>
  );
}
