import type { Project } from "./project";
// This function is serialized verbatim into the unprivileged document.
function runtime(replay = false, standalone = false, duration = 10, speed = 1) {
  const w = window as any;
  let current = 0;
  let selection = false;
  let selected: HTMLElement | null = null;
  let failed = false;
  const send = (type: string, value: unknown) =>
    parent.postMessage({ framescript: true, type, value }, "*");
  window.addEventListener("error", (e) => {
    failed = true;
    send("error", e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    failed = true;
    send("error", String(e.reason));
  });
  w.__fsSeek = (time: number) => {
    current = time;
    document.getAnimations().forEach((a) => {
      a.pause();
      a.currentTime = time * 1000;
    });
    if (typeof w.renderFrame === "function") w.renderFrame(time);
  };
  window.addEventListener("message", (e) => {
    if (e.source !== parent || !e.data?.framescript) return;
    const { type, value } = e.data;
    if (type === "seek") w.__fsSeek(value);
    if (type === "select") selection = value;
  });
  document.addEventListener(
    "click",
    (e) => {
      if (!selection) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as HTMLElement;
      if (selected) selected.style.outline = "";
      selected = el;
      el.style.outline = "2px solid #68afff";
      const s = getComputedStyle(el);
      send("selection", {
        id: el.id,
        tag: el.tagName,
        text: el.textContent?.slice(0, 500),
        width: s.width,
        height: s.height,
        left: s.left,
        top: s.top,
        background: s.backgroundColor,
        opacity: s.opacity,
        fontSize: s.fontSize,
        borderRadius: s.borderRadius,
        transform: s.transform,
      });
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target as HTMLElement;
      if (
        !selection ||
        !el.id ||
        e.button !== 0 ||
        !(el instanceof HTMLElement)
      )
        return;
      const x = e.clientX,
        y = e.clientY,
        left = el.offsetLeft,
        top = el.offsetTop,
        width = el.offsetWidth,
        height = el.offsetHeight,
        resize = e.shiftKey;
      let moved = false;
      const styles: Record<string, string> = {};
      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - x,
          dy = ev.clientY - y;
        if (Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        if (resize) {
          styles.width = Math.max(1, width + dx) + "px";
          styles.height = Math.max(1, height + dy) + "px";
        } else {
          styles.position = "absolute";
          styles.left = left + dx + "px";
          styles.top = top + dy + "px";
        }
        Object.entries(styles).forEach(([k, v]) => el.style.setProperty(k, v));
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (moved) send("visual", { id: el.id, styles });
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up, { once: true });
    },
    true,
  );
  window.addEventListener("load", () => {
    if (!replay) w.__fsSeek(0);
    if (!failed)
      send("ready", {
        animations: document.getAnimations().map((a) => ({
          name: (a as CSSAnimation).animationName ?? "Web animation",
          duration: a.effect?.getTiming().duration,
        })),
        contract: typeof w.renderFrame === "function",
      });
    if (standalone) {
      const start = performance.now();
      const tick = (now: number) => {
        w.__fsSeek((((now - start) / 1000) * speed) % duration);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
  w.__fsTime = () => current;
}
export function documentFor(
  p: Project,
  options?: { export?: boolean; transparent?: boolean; standalone?: boolean },
) {
  let html = p.html,
    css = p.css,
    js = p.js;
  for (const a of p.assets) {
    const key = `asset://${a.id}`;
    // Imported SVG data URLs may contain literal markup/quotes. Keep them safe
    // inside both a scene attribute and the master's nested srcdoc attribute.
    const data = a.data.replace(
      /["'<>&\s]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
    );
    html = html.split(key).join(data);
    css = css.split(key).join(data);
    js = js.split(key).join(data);
  }
  const remote = p.settings.network ? " https: http:" : "";
  const csp = `default-src 'none'; frame-src about:; script-src 'unsafe-inline'${remote}; style-src 'unsafe-inline'${remote}; img-src data: blob:${remote}; font-src data:${remote}; media-src data:; connect-src${remote || " 'none'"}; base-uri 'none'; form-action 'none';`;
  const safe = (s: string, tag: string) =>
    s.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
  return `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:${options?.transparent ? "transparent" : p.settings.background}}${safe(css, "style")}</style><script>(()=>{const __name=(fn)=>fn;(${runtime.toString()})(${!!options?.export && p.settings.timing === "replay"},${!!options?.standalone},${p.settings.duration},${p.settings.speed})})()</script></head><body>${html}<script>${safe(js, "script")}</script></body></html>`;
}
