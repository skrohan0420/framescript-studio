// Serialized into both preview and export documents; keep this function self-contained.
export function typographyRuntime(editable = false) {
  const w = window as any;
  let selectedId: string | null = null;
  let editorScale = 1;
  let guides: HTMLDivElement[] = [];
  const showGuides = (x: number | null, y: number | null) => {
    if (!guides.length)
      guides = [0, 1].map(() => {
        const line = document.createElement("div");
        line.dataset.fsGuide = "true";
        Object.assign(line.style, {
          position: "fixed",
          zIndex: "2147483647",
          pointerEvents: "none",
          background: "#f4a2ff",
        });
        document.body.append(line);
        return line;
      });
    const [vertical, horizontal] = guides;
    Object.assign(vertical.style, {
      display: x === null ? "none" : "block",
      left: `${x}%`,
      top: "0",
      width: `${1 / editorScale}px`,
      height: "100%",
    });
    Object.assign(horizontal.style, {
      display: y === null ? "none" : "block",
      top: `${y}%`,
      left: "0",
      height: `${1 / editorScale}px`,
      width: "100%",
    });
  };
  const send = (type: string, value: unknown) =>
    parent.postMessage({ framescript: true, type, value }, "*");
  const selectText = (id: string | null) => {
    selectedId = id;
    for (const node of document.querySelectorAll<HTMLElement>(
      "[data-fs-text]",
    )) {
      const selected = editable && node.id === id;
      node.style.outline = selected ? "2px solid #36d7e7" : "";
      const handle = node.querySelector<HTMLElement>("[data-fs-resize]");
      if (handle) handle.style.display = selected ? "block" : "none";
    }
  };
  window.addEventListener("message", (event) => {
    if (event.source !== parent || !event.data?.framescript) return;
    if (event.data.type === "select-text") selectText(event.data.value);
    if (
      event.data.type === "editor-scale" &&
      Number.isFinite(event.data.value)
    ) {
      editorScale = Math.max(0.01, event.data.value);
      for (const handle of document.querySelectorAll<HTMLElement>(
        "[data-fs-resize]",
      ))
        Object.assign(handle.style, {
          width: `${12 / editorScale}px`,
          height: `${12 / editorScale}px`,
          right: `${-6 / editorScale}px`,
          bottom: `${-6 / editorScale}px`,
          borderWidth: `${1 / editorScale}px`,
        });
    }
  });
  if (editable)
    window.addEventListener("keydown", (event) => {
      if (
        !selectedId ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target as HTMLElement)?.closest?.(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if (
        !["Delete", "Backspace", "w"].includes(
          event.key.toLowerCase() === "w" ? "w" : event.key,
        )
      )
        return;
      event.preventDefault();
      send("text-key", { id: selectedId, key: event.key });
    });
  if (editable)
    document.addEventListener(
      "dblclick",
      (event) => {
        const node = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-fs-text]",
        );
        if (!node) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        selectText(node.id);
        send("text-open", { id: node.id });
      },
      true,
    );
  if (editable)
    document.addEventListener(
      "pointerdown",
      (event) => {
        const target = event.target as HTMLElement;
        const node = target.closest<HTMLElement>("[data-fs-text]");
        if (!node || event.button !== 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        let data: any;
        try {
          data = JSON.parse(node.dataset.fsText!);
        } catch {
          return;
        }
        const text = node.firstElementChild as HTMLElement;
        const resize = !!target.closest("[data-fs-resize]") || event.shiftKey;
        const startX = event.clientX,
          startY = event.clientY;
        const initialSize = data.size;
        selectText(data.id);
        send("text-start", { id: data.id });
        node.setPointerCapture(event.pointerId);
        let moved = false;
        const move = (e: PointerEvent) => {
          const dx = e.clientX - startX,
            dy = e.clientY - startY;
          if (Math.abs(dx) + Math.abs(dy) < 2) return;
          moved = true;
          if (resize) {
            data.size = Math.min(
              400,
              Math.max(8, initialSize + dy * 0.7 + dx * 0.3),
            );
            text.style.fontSize = `${data.size}px`;
          } else {
            const original = JSON.parse(node.dataset.fsText!);
            data.x = Math.min(
              100,
              Math.max(0, original.x + (dx / innerWidth) * 100),
            );
            data.y = Math.min(
              100,
              Math.max(0, original.y + (dy / innerHeight) * 100),
            );
            let guideX: number | null = null,
              guideY: number | null = null;
            if (!e.altKey) {
              const xs = [0, 10, 50, 90, 100],
                ys = [0, 10, 50, 90, 100];
              for (const other of document.querySelectorAll<HTMLElement>(
                "[data-fs-text]",
              )) {
                if (other === node || other.style.display === "none") continue;
                xs.push((other.offsetLeft / innerWidth) * 100);
                ys.push((other.offsetTop / innerHeight) * 100);
              }
              let tx = (8 / (innerWidth * editorScale)) * 100,
                ty = (8 / (innerHeight * editorScale)) * 100;
              for (const x of xs)
                if (Math.abs(data.x - x) <= tx) {
                  tx = Math.abs(data.x - x);
                  guideX = x;
                }
              for (const y of ys)
                if (Math.abs(data.y - y) <= ty) {
                  ty = Math.abs(data.y - y);
                  guideY = y;
                }
              if (guideX !== null) data.x = guideX;
              if (guideY !== null) data.y = guideY;
            }
            showGuides(guideX, guideY);
            node.style.left = `${data.x}%`;
            node.style.top = `${data.y}%`;
          }
        };
        const end = (e: PointerEvent) => {
          showGuides(null, null);
          node.removeEventListener("pointermove", move);
          node.removeEventListener("pointerup", end);
          node.removeEventListener("pointercancel", end);
          node.removeEventListener("lostpointercapture", end);
          if (e.type === "pointerup" && moved)
            send("text-edit", {
              id: data.id,
              x: data.x,
              y: data.y,
              size: data.size,
            });
          else if (e.type !== "pointerup") {
            const original = JSON.parse(node.dataset.fsText!);
            node.style.left = `${original.x}%`;
            node.style.top = `${original.y}%`;
            text.style.fontSize = `${original.size}px`;
          }
        };
        node.addEventListener("pointermove", move);
        node.addEventListener("pointerup", end);
        node.addEventListener("pointercancel", end);
        node.addEventListener("lostpointercapture", end);
      },
      true,
    );
  let layers:
    | {
        node: HTMLElement;
        animation: Animation;
        start: number;
        end: number;
        motionStart: number;
      }[]
    | null = null;
  w.__fsTypography = (time: number) => {
    if (!layers) {
      layers = [];
      for (const node of document.querySelectorAll<HTMLElement>(
        "[data-fs-text]",
      )) {
        try {
          const data = JSON.parse(node.dataset.fsText!);
          const text = node.firstElementChild as HTMLElement;
          if (!text || !Array.isArray(data.template.frames)) continue;
          const styles = {
            position: "fixed",
            left: `${data.x}%`,
            top: `${data.y}%`,
            width: `${data.width}%`,
            transform: "translate(-50%,-50%)",
            zIndex: "2147483000",
            margin: "0",
            padding: "0",
            pointerEvents: "none",
          };
          for (const [key, value] of Object.entries(styles))
            (node.style as any)[key] = value;
          Object.assign(text.style, {
            ...data.template.appearance,
            display: "block",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontFamily: data.font,
            fontWeight: data.template.weight,
            fontSize: `${data.size}px`,
            color: data.color,
            textAlign: data.align,
            lineHeight: "1.15",
            pointerEvents: editable ? "auto" : "none",
            cursor: editable ? "move" : "default",
            userSelect: "none",
          });
          if (editable) {
            const handle = document.createElement("button");
            handle.dataset.fsResize = "true";
            handle.setAttribute("aria-label", "Scale text");
            handle.title = "Drag to scale text · Shift+drag also scales";
            Object.assign(handle.style, {
              display: "none",
              position: "absolute",
              right: "-12px",
              bottom: "-12px",
              width: "24px",
              height: "24px",
              border: "2px solid white",
              borderRadius: "4px",
              padding: "0",
              background: "#0799ab",
              pointerEvents: "auto",
              cursor: "nwse-resize",
              zIndex: "2147483647",
            });
            node.append(handle);
          }
          const animation = text.animate(data.template.frames, {
            duration: data.entrance * 1000,
            fill: "both",
            easing: data.template.easing ?? "cubic-bezier(.2,.8,.2,1)",
          });
          animation.pause();
          layers.push({
            node,
            animation,
            start: data.start,
            end: data.end,
            motionStart: data.motionStart ?? data.start,
          });
          selectText(selectedId);
        } catch {
          /* Ignore malformed user-edited layers. */
        }
      }
    }
    for (const layer of layers) {
      layer.node.style.setProperty(
        "display",
        time >= layer.start && time < layer.end ? "block" : "none",
        "important",
      );
      layer.animation.currentTime = Math.max(
        0,
        (time - layer.motionStart) * 1000,
      );
    }
  };
  w.__fsCaptureText = () => {
    const results: unknown[] = [];
    const allowed = [
      "opacity",
      "transform",
      "filter",
      "letterSpacing",
      "clipPath",
      "offset",
      "color",
      "textShadow",
      "easing",
    ];
    for (const element of document.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,p,span,div,blockquote",
    )) {
      if (results.length >= 40) break;
      if (
        element.closest("[data-fs-text]") ||
        element.children.length ||
        !element.textContent?.trim()
      )
        continue;
      const style = getComputedStyle(element);
      if (style.display === "none") continue;
      const animation = element
        .getAnimations()
        .find((item) => item.effect instanceof KeyframeEffect);
      const frames =
        animation && animation.effect instanceof KeyframeEffect
          ? animation.effect
              .getKeyframes()
              .slice(0, 30)
              .map((frame) =>
                Object.fromEntries(
                  Object.entries(frame).filter(([key]) =>
                    allowed.includes(key),
                  ),
                ),
              )
          : [{ opacity: 0 }, { opacity: 1 }];
      results.push({
        name: element.textContent.trim().slice(0, 45),
        sample: element.textContent.trim().slice(0, 500),
        font: style.fontFamily.slice(0, 200),
        weight: style.fontWeight,
        color: style.color,
        appearance: {
          fontStyle: style.fontStyle,
          textTransform: style.textTransform,
          textShadow: style.textShadow,
          letterSpacing: style.letterSpacing,
          WebkitTextStroke: style.webkitTextStroke,
        },
        frames,
        easing: animation?.effect?.getTiming().easing ?? "ease-out",
      });
    }
    return results;
  };
}
