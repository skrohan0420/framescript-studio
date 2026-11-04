import type { Project } from "./project";
import { typographyRuntime } from "./typography-runtime";
import { threeSource } from "./three-source.generated";
import { threeRuntime } from "./three-runtime";
import { directCanvas } from "./direct-canvas";
// This function is serialized verbatim into the unprivileged document.
function runtime(
  replay = false,
  standalone = false,
  duration = 10,
  speed = 1,
  sourceOffset = 0,
) {
  const w = window as any;
  let current = 0;
  let selection = false;
  let selected: HTMLElement | null = null;
  let failed = false;
  const send = (type: string, value: unknown) =>
    parent.postMessage({ framescript: true, type, value }, "*");
  window.addEventListener("keydown", (event) => {
    if (
      standalone ||
      event.code !== "Space" ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (event.target as HTMLElement)?.closest(
        "input, textarea, select, [contenteditable]",
      )
    )
      return;
    event.preventDefault();
    if (!event.repeat) send("toggle-play", null);
  });
  const userLocation = (file: string, line: number, column: number) => {
    const first = w.__fsUserLine;
    if (file === location.href && line >= first && line <= w.__fsUserLastLine)
      return { line: line - first + 1, column: column || 1 };
  };
  window.addEventListener("error", (e) => {
    failed = true;
    send("error", {
      message: e.message,
      ...userLocation(e.filename, e.lineno, e.colno),
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    failed = true;
    let source;
    for (const frame of String(e.reason?.stack ?? "")
      .split("\n")
      .slice(1)) {
      const match = /:(\d+):(\d+)\)?\s*$/.exec(frame);
      if (!match || !frame.slice(0, match.index).endsWith(location.href))
        continue;
      source = userLocation(location.href, Number(match[1]), Number(match[2]));
      if (source) break;
    }
    send("error", { message: String(e.reason), ...source });
  });
  w.__fsSeek = (time: number) => {
    time += sourceOffset;
    current = time;
    document.getAnimations().forEach((a) => {
      a.pause();
      a.currentTime = time * 1000;
    });
    if (typeof w.renderFrame === "function") w.renderFrame(time);
    w.__fsTypography?.(time);
  };
  window.addEventListener("message", (e) => {
    if (
      e.data?.framescript &&
      e.data.type === "toggle-play" &&
      [...document.querySelectorAll("iframe")].some(
        (frame) => frame.contentWindow === e.source,
      )
    ) {
      if (!standalone) send("toggle-play", null);
      return;
    }
    if (e.source !== parent || !e.data?.framescript) return;
    const { type, value } = e.data;
    if (type === "seek") w.__fsSeek(value);
    if (type === "select") selection = value;
  });
  document.addEventListener(
    "click",
    (e) => {
      if ((e.target as HTMLElement)?.closest?.("[data-fs-text]")) return;
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
        thumbnail: (() => {
          try {
            const source = document.querySelector("canvas");
            if (!source?.width || !source.height) return undefined;
            const image = document.createElement("canvas");
            image.width = 384;
            image.height = 216;
            const context = image.getContext("2d")!;
            context.fillStyle = getComputedStyle(document.body).backgroundColor;
            context.fillRect(0, 0, 384, 216);
            context.drawImage(source, 0, 0, 384, 216);
            return image.toDataURL("image/jpeg", 0.7);
          } catch {
            return undefined;
          }
        })(),
        typography: w.__fsCaptureText?.() ?? [],
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
  options?: {
    export?: boolean;
    exportTransportOrigin?: string;
    transparent?: boolean;
    standalone?: boolean;
    sourceOffset?: number;
    textEditing?: boolean;
  },
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
  const transport =
    options?.export &&
    /^https?:\/\/127\.0\.0\.1:\d+$/.test(options.exportTransportOrigin ?? "")
      ? ` ${options.exportTransportOrigin}`
      : "";
  const csp = `default-src 'none'; frame-src about:; script-src 'unsafe-inline'${remote}; style-src 'unsafe-inline'${remote}; img-src data: blob:${remote}; font-src data:${remote}; media-src data:; connect-src${remote + transport || " 'none'"}; base-uri 'none'; form-action 'none';`;
  const safe = (s: string, tag: string) =>
    s.replace(new RegExp(`</${tag}`, "gi"), `<\\/${tag}`);
  const sourceOffset =
    options?.sourceOffset ??
    p.workflow?.scenes.find((scene) => scene.id === p.workflow?.selectedId)
      ?.sourceOffset ??
    0;
  const prefix = `<!doctype html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:${options?.transparent ? "transparent" : p.settings.background}}${safe(css, "style")}</style><script>(()=>{const __name=(fn)=>fn;(${typographyRuntime.toString()})(${options?.textEditing !== false && !options?.export && !options?.standalone && !p.workflow?.scenes.find((scene) => scene.id === p.workflow?.selectedId)?.locked});(${runtime.toString()})(${!!options?.export && p.settings.timing === "replay"},${!!options?.standalone},${p.settings.duration},${p.settings.speed},${sourceOffset})})()</script></head><body>${html}`;
  const three = /\b(?:THREE|FrameScript3D)\b/.test(js)
    ? `<script>${safe(threeSource, "script")}</script><script>(()=>{const __name=(fn)=>fn;(${threeRuntime.toString()})()})()</script>`
    : "";
  const captureHelper = `<script>(()=>{const __name=(fn)=>fn;window.__fsDirectCanvas=(${directCanvas.toString()})})()</script>`;
  const firstLine =
    (prefix + three + captureHelper).split(/\r\n|\r|\n/).length + 1;
  const lastLine = firstLine + js.split(/\r\n|\r|\n/).length;
  // Keep browser coordinates document-relative so one offset works for both parse and runtime errors.
  return `${prefix}${three}${captureHelper}<script>window.__fsUserLine=${firstLine};window.__fsUserLastLine=${lastLine}</script><script>\n${safe(js, "script")}\n</script></body></html>`;
}
