import type { PointerEvent as ReactPointerEvent } from "react";

type TimelineMovement = {
  deltaX: number;
  clientX: number;
  clientY: number;
  altKey: boolean;
};

export function startTimelineDrag(
  event: ReactPointerEvent<HTMLElement>,
  options: {
    onMove: (movement: TimelineMovement) => void;
    onEnd: (commit: boolean) => void;
    extraScroll?: number;
  },
) {
  const target = event.currentTarget;
  const viewport = target.closest<HTMLElement>(".timeline-track-scroll");
  const startX = event.clientX;
  const startY = event.clientY;
  const initialScroll = viewport?.scrollLeft ?? 0;
  const initialPadding = viewport?.style.paddingRight ?? "";
  const padding = viewport
    ? parseFloat(getComputedStyle(viewport).paddingRight) || 0
    : 0;
  const listeners = new AbortController();
  let pointer = { clientX: startX, clientY: startY, altKey: event.altKey };
  let moved = false;
  let finished = false;
  let frame = 0;
  let previousTime = 0;
  let addedPadding = 0;
  let dirty = false;
  const finish = (commit: boolean) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    listeners.abort();
    if (target.hasPointerCapture(event.pointerId))
      target.releasePointerCapture(event.pointerId);
    options.onEnd(commit && moved);
    // Let the committed timeline width render before removing temporary scroll space.
    if (viewport && addedPadding)
      requestAnimationFrame(() => {
        if (viewport.style.paddingRight === `${padding + addedPadding}px`)
          viewport.style.paddingRight = initialPadding;
      });
  };
  const tick = (time: number) => {
    if (!target.isConnected) {
      finish(false);
      return;
    }
    const elapsed = Math.min(32, previousTime ? time - previousTime : 16);
    previousTime = time;
    let scrolled = false;
    if (moved && viewport) {
      const bounds = viewport.getBoundingClientRect();
      const left = bounds.left + 96;
      const right = bounds.right - 8;
      const within =
        pointer.clientY >= bounds.top - 24 &&
        pointer.clientY <= bounds.bottom + 24;
      const speed = within
        ? pointer.clientX < left + 36
          ? -Math.min(1, (left + 36 - pointer.clientX) / 36)
          : pointer.clientX > right - 36
            ? Math.min(1, (pointer.clientX - right + 36) / 36)
            : 0
        : 0;
      if (speed) {
        const delta = speed * 0.65 * elapsed;
        const available =
          viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft;
        if (delta > available && addedPadding < (options.extraScroll ?? 0)) {
          addedPadding = Math.min(
            options.extraScroll!,
            addedPadding + Math.max(48, delta),
          );
          viewport.style.paddingRight = `${padding + addedPadding}px`;
        }
        const before = viewport.scrollLeft;
        viewport.scrollLeft += delta;
        scrolled = before !== viewport.scrollLeft;
      }
    }
    if (moved && (dirty || scrolled)) {
      options.onMove({
        ...pointer,
        deltaX:
          pointer.clientX -
          startX +
          (viewport?.scrollLeft ?? 0) -
          initialScroll,
      });
      dirty = false;
    }
    frame = requestAnimationFrame(tick);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return;
    pointer = { clientX: e.clientX, clientY: e.clientY, altKey: e.altKey };
    moved ||= Math.hypot(e.clientX - startX, e.clientY - startY) >= 3;
    dirty = true;
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return;
    if (!target.isConnected) {
      finish(false);
      return;
    }
    if (e.type === "pointerup" && moved) {
      move(e);
      options.onMove({
        ...pointer,
        deltaX:
          pointer.clientX -
          startX +
          (viewport?.scrollLeft ?? 0) -
          initialScroll,
      });
    }
    finish(e.type === "pointerup");
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    } else if (e.key === "Alt") {
      pointer.altKey = e.type === "keydown";
      dirty = true;
    }
  };
  const signal = listeners.signal;
  viewport?.addEventListener(
    "scroll",
    () => {
      dirty = true;
    },
    { signal },
  );
  window.addEventListener("pointermove", move, { signal });
  window.addEventListener("pointerup", end, { signal });
  window.addEventListener("pointercancel", end, { signal });
  window.addEventListener("keydown", key, { signal, capture: true });
  window.addEventListener("keyup", key, { signal, capture: true });
  window.addEventListener("blur", () => finish(false), { signal });
  window.addEventListener("resize", () => finish(false), { signal });
  target.addEventListener("lostpointercapture", () => finish(false), {
    signal,
  });
  target.setPointerCapture(event.pointerId);
  frame = requestAnimationFrame(tick);
  return () => finish(false);
}
