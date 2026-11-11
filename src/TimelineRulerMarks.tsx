import {
  memo,
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from "react";

export const TimelineRulerMarks = memo(function TimelineRulerMarks({
  duration,
  pixelsPerSecond,
  fps,
  viewport,
}: {
  duration: number;
  pixelsPerSecond: number;
  fps: number;
  viewport: RefObject<HTMLDivElement | null>;
}) {
  const [visible, setVisible] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setVisible({ left: element.scrollLeft, width: element.clientWidth }),
      );
    };
    setVisible({ left: element.scrollLeft, width: element.clientWidth });
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [viewport]);
  const idealStep = 85 / pixelsPerSecond;
  const magnitude = 10 ** Math.floor(Math.log10(idealStep));
  const step = Math.max(
    1 / fps,
    [1, 2, 5, 10]
      .map((factor) => factor * magnitude)
      .find((value) => value >= idealStep)!,
  );
  const first = Math.max(
    0,
    Math.floor((visible.left - 96) / pixelsPerSecond / step) - 1,
  );
  const endTime = Math.max(
    Math.min(600, Math.ceil((duration + 10) / 5) * 5),
    Math.ceil(Math.max(0, visible.width - 96) / pixelsPerSecond / step) * step,
  );
  const last = Math.min(
    Math.floor(endTime / step + 1e-9),
    Math.ceil((visible.left + visible.width - 96) / pixelsPerSecond / step) + 1,
  );
  const width = endTime * pixelsPerSecond;
  useLayoutEffect(() => {
    viewport.current?.style.setProperty(
      "--timeline-ruler-space",
      `${Math.max(0, width - duration * pixelsPerSecond)}px`,
    );
  }, [width, duration, pixelsPerSecond, viewport]);
  return (
    <div className="timeline-ruler-marks" style={{ width }}>
      {Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => {
        const time = (first + index) * step;
        const atEnd = Math.abs(time - endTime) < 1e-9;
        return (
          <span
            key={first + index}
            className={atEnd ? "ruler-mark-end" : undefined}
            style={{ left: time * pixelsPerSecond }}
          >
            {time.toFixed(3).replace(/\.?0+$/, "")}s
          </span>
        );
      })}
    </div>
  );
});
