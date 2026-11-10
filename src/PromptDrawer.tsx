import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

const defaultWidthKey = "framescript.prompt-width.v1";
const minimumWidth = 560;
export function PromptDrawer({
  open,
  obscured = false,
  id = "prompt-builder-panel",
  label = "Prompt builder panel",
  onClose,
  children,
}: {
  open: boolean;
  obscured?: boolean;
  id?: string;
  label?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const widthKey =
    id === "prompt-builder-panel" ? defaultWidthKey : defaultWidthKey + "." + id;
  const [present, setPresent] = useState(open);
  const [resizing, setResizing] = useState(false);
  const [preferred, setPreferred] = useState(() => {
    try {
      const value = Number(
        localStorage.getItem(widthKey) ?? localStorage.getItem(defaultWidthKey),
      );
      return Number.isFinite(value) && value > 0
        ? Math.max(minimumWidth, Math.min(value, 3000))
        : 820;
    } catch {
      return 820;
    }
  });
  const [available, setAvailable] = useState(
    Math.max(1, window.innerWidth - 12),
  );
  const panel = useRef<HTMLElement>(null);
  const gesture = useRef<{
    x: number;
    width: number;
    previous: number;
    pointer: number;
  } | null>(null);
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const timer = setTimeout(() => setPresent(false), 180);
    return () => clearTimeout(timer);
  }, [open]);
  useEffect(() => {
    const parent = panel.current?.parentElement;
    if (!parent) return;
    const measure = () => setAvailable(parent.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [present]);
  useEffect(() => {
    try {
      localStorage.setItem(widthKey, String(preferred));
    } catch {}
  }, [preferred, widthKey]);
  const minimum = Math.min(minimumWidth, available);
  const width = Math.min(Math.max(minimumWidth, preferred), available);
  const clamp = (value: number) =>
    Math.min(available, Math.max(minimum, value));
  if (!present) return null;
  return (
    <aside
      ref={panel}
      id={id}
      className="prompt-drawer"
      data-state={open ? "open" : "closing"}
      data-resizing={open && resizing ? "" : undefined}
      data-flush={available - width < 32}
      aria-label={label}
      style={{ width, visibility: obscured ? "hidden" : undefined }}
      inert={!open || obscured}
    >
      <button
        type="button"
        className="prompt-drawer-edge-close"
        title="Close prompt builder"
        aria-label="Collapse prompt drawer"
        onClick={onClose}
      >
        <ChevronRight size={15} aria-hidden="true" />
      </button>
      <div
        role="separator"
        aria-label="Resize prompt builder"
        aria-orientation="vertical"
        aria-valuemin={minimum}
        aria-valuemax={available}
        aria-valuenow={Math.round(width)}
        aria-valuetext={`${Math.round(width)} pixels wide`}
        tabIndex={0}
        className="prompt-drawer-resizer"
        title="Drag to resize · Left/Right arrows · double-click to reset"
        onDoubleClick={() => setPreferred(820)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          setPreferred(
            event.key === "Home"
              ? minimum
              : event.key === "End"
                ? available
                : clamp(
                    width +
                      (event.key === "ArrowLeft" ? 1 : -1) *
                        (event.shiftKey ? 80 : 20),
                  ),
          );
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          gesture.current = {
            x: event.clientX,
            width,
            previous: preferred,
            pointer: event.pointerId,
          };
          setResizing(true);
        }}
        onPointerMove={(event) => {
          const drag = gesture.current;
          if (drag && drag.pointer === event.pointerId)
            setPreferred(clamp(drag.width + drag.x - event.clientX));
        }}
        onPointerUp={(event) => {
          gesture.current = null;
          setResizing(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          if (gesture.current) setPreferred(gesture.current.previous);
          gesture.current = null;
          setResizing(false);
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
          setResizing(false);
        }}
      >
        <span />
      </div>
      {children}
    </aside>
  );
}
