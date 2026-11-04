import { documentFor } from "../shared/runtime";
import { sceneOffset } from "../shared/workflow";
import type { Project } from "../shared/project";
import { keyboardChord } from "./shortcuts";

export type PreviewQuality = "auto" | "1080" | "full";
export type ConsoleData =
  | null
  | boolean
  | number
  | string
  | ConsoleData[]
  | { [key: string]: ConsoleData };
export type PreviewConsoleEntry = {
  level: "log" | "info" | "debug" | "warn" | "error" | "command" | "result";
  text: string;
  pretty?: string;
  structured?: string;
  table?: boolean;
};
export function previewScale(
  quality: PreviewQuality,
  height: number,
  displayedHeight: number,
  deviceScale = 1,
) {
  if (quality === "full") return 1;
  const target =
    quality === "1080"
      ? 1080
      : Math.min(
          1080,
          Math.max(360, Math.ceil((displayedHeight * deviceScale) / 180) * 180),
        );
  return Math.min(1, target / height);
}

// Injected only into editor iframes. Logical scene coordinates remain unchanged.
function previewRuntime(
  scale: number,
  shortcuts?: string[],
  chordFor?: typeof keyboardChord,
) {
  const w = window as any;
  if (shortcuts && chordFor) {
    w.__fsWorkspaceKeys = true;
    window.addEventListener(
      "keydown",
      (event) => {
        if (
          !event.isTrusted ||
          event.defaultPrevented ||
          (event.target as HTMLElement)?.closest?.(
            "input,textarea,select,[contenteditable]",
          )
        )
          return;
        const chord = chordFor(event);
        if (!chord || !shortcuts.includes(chord)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        parent.postMessage(
          {
            framescript: true,
            type: "preview-shortcut",
            value: { chord, repeat: event.repeat },
          },
          "*",
        );
      },
      true,
    );
  }
  let messages: PreviewConsoleEntry[] = [];
  let flushTimer = 0;
  const flushConsole = () => {
    window.clearTimeout(flushTimer);
    flushTimer = 0;
    if (!messages.length) return;
    parent.postMessage(
      { framescript: true, type: "preview-console", value: messages },
      "*",
    );
    messages = [];
  };
  window.addEventListener("error", flushConsole);
  window.addEventListener("unhandledrejection", flushConsole);
  const inspect = (
    value: unknown,
    depth = 0,
  ): { text: string; pretty: string } => {
    if (
      value === null ||
      typeof value !== "object" ||
      depth >= 2 ||
      value instanceof Error
    ) {
      const text =
        value && typeof value === "object" && !(value instanceof Error)
          ? Array.isArray(value)
            ? "[…]"
            : "{…}"
          : String(value).slice(0, 1000);
      const pretty =
        depth && typeof value === "string" ? JSON.stringify(text) : text;
      return { text, pretty };
    }
    const array = Array.isArray(value);
    const keys = Object.keys(value);
    const values = keys.slice(0, 12).map((key) => {
      const entry = Object.getOwnPropertyDescriptor(value, key);
      const item =
        entry && "value" in entry
          ? inspect(entry.value, depth + 1)
          : { text: "[Getter]", pretty: "[Getter]" };
      return array
        ? item
        : {
            text: `${key}: ${item.text}`,
            pretty: `${JSON.stringify(key)}: ${item.pretty}`,
          };
    });
    if (keys.length > values.length) values.push({ text: "…", pretty: "…" });
    const [open, close] = array ? ["[", "]"] : ["{", "}"];
    const indent = "  ".repeat(depth + 1);
    return {
      text: open + values.map((item) => item.text).join(", ") + close,
      pretty: values.length
        ? open +
          "\n" +
          indent +
          values.map((item) => item.pretty).join(",\n" + indent) +
          "\n" +
          "  ".repeat(depth) +
          close
        : open + close,
    };
  };
  const snapshot = (value: object): string | undefined => {
    const seen = new WeakSet<object>();
    const queue: {
      item: object;
      output: Record<string, ConsoleData> | ConsoleData[];
      depth: number;
    }[] = [];
    let remaining = 2000;
    let characters = 180000;
    const visit = (item: unknown, depth: number): ConsoleData => {
      if (
        item === null ||
        typeof item === "boolean" ||
        (typeof item === "number" && Number.isFinite(item))
      )
        return item;
      if (typeof item !== "object" || item instanceof Error) {
        const text = String(item).slice(
          0,
          Math.max(0, Math.min(4000, characters)),
        );
        characters -= text.length;
        return text;
      }
      if (seen.has(item)) return "[Repeated or circular reference]";
      if (depth >= 12) return "[Snapshot depth limit]";
      seen.add(item);
      const output: Record<string, ConsoleData> | ConsoleData[] = Array.isArray(
        item,
      )
        ? []
        : Object.create(null);
      queue.push({ item, output, depth });
      return output;
    };
    try {
      const root = visit(value, 0);
      for (const { item, output, depth } of queue) {
        const keys = Object.keys(item);
        let captured = 0;
        for (const key of keys) {
          if (remaining <= 0 || characters <= 0) break;
          remaining--;
          characters -= Math.min(160, key.length);
          const descriptor = Object.getOwnPropertyDescriptor(item, key);
          const entry =
            descriptor && "value" in descriptor
              ? visit(descriptor.value, depth + 1)
              : "[Getter]";
          if (Array.isArray(output)) output.push(entry);
          else output[key.slice(0, 160)] = entry;
          captured++;
        }
        if (captured < keys.length) {
          const notice = `[Snapshot limit: ${keys.length - captured} properties omitted]`;
          if (Array.isArray(output)) output.push(notice);
          else if (!("…" in output)) output["…"] = notice;
        }
      }
      const json = JSON.stringify(root);
      return json.length <= 256000 ? json : undefined;
    } catch {
      return undefined;
    }
  };
  const record = (
    level: PreviewConsoleEntry["level"],
    args: unknown[],
    table = false,
  ) => {
    if (messages.length >= 50) return;
    let structured: string | undefined;
    const values = args.slice(0, 20).map((value) => {
      try {
        if (
          typeof value === "string" &&
          value.length <= 256000 &&
          /^[\s]*[\[{]/.test(value)
        ) {
          try {
            const parsed = JSON.parse(value);
            structured ??= value;
            return {
              text: value,
              pretty: JSON.stringify(parsed, null, 2),
            };
          } catch {
            /* Leave ordinary strings as typed. */
          }
        }
        if (value && typeof value === "object" && !(value instanceof Error))
          structured ??= snapshot(value);
        return inspect(value);
      } catch {
        return {
          text: "[Uninspectable value]",
          pretty: "[Uninspectable value]",
        };
      }
    });
    const text = values
      .map((value) => value.text)
      .join(" ")
      .slice(0, 4000);
    const pretty = values
      .map((value) => value.pretty)
      .join(" ")
      .slice(0, 8000);
    messages.push({
      level,
      text,
      ...(pretty !== text && { pretty }),
      structured,
      table,
    });
    if (!flushTimer) flushTimer = window.setTimeout(flushConsole, 50);
  };
  for (const method of [
    "log",
    "info",
    "debug",
    "warn",
    "error",
    "table",
  ] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args);
      record(method === "table" ? "log" : method, args, method === "table");
    };
  }
  w.__fsConsoleReport = (level: "result" | "error", value: unknown) => {
    if (level === "result" && value instanceof Promise) {
      void value.then(
        (result) => record("result", [result]),
        (error) => record("error", [error]),
      );
    } else {
      record(level, [value]);
    }
  };
  window.addEventListener("message", (event) => {
    if (
      event.source !== parent ||
      !event.data?.framescript ||
      event.data.type !== "preview-console-eval" ||
      typeof event.data.value !== "string" ||
      event.data.value.length > 5000
    )
      return;
    if (w.__fsConsoleTarget) {
      const target = w.__fsConsoleTarget();
      if (target) target.postMessage(event.data, "*");
      else record("error", ["The active timeline preview is still loading."]);
      return;
    }
    const command = document.createElement("script");
    command.textContent = event.data.value;
    document.head.append(command);
    command.remove();
  });
  let three: any;
  Object.defineProperty(w, "THREE", {
    configurable: true,
    get: () => three,
    set: (value) => {
      const Original = value.WebGLRenderer;
      class PreviewRenderer extends Original {
        constructor(options: any = {}) {
          super({
            ...options,
            preserveDrawingBuffer:
              scale < 1 ? false : options.preserveDrawingBuffer,
          });
          const setRatio = this.setPixelRatio.bind(this);
          this.setPixelRatio = (ratio: number) =>
            setRatio(Math.min(1, ratio) * scale);
          const setBuffer = this.setDrawingBufferSize.bind(this);
          this.setDrawingBufferSize = (
            width: number,
            height: number,
            ratio: number,
          ) => setBuffer(width, height, Math.min(1, ratio) * scale);
          this.setPixelRatio(1);
        }
      }
      three = { ...value, WebGLRenderer: PreviewRenderer };
    },
  });
  let latest = 0,
    scheduled = false;
  window.addEventListener(
    "message",
    (event) => {
      if (
        event.source !== parent ||
        !event.data?.framescript ||
        event.data.type !== "seek"
      )
        return;
      event.stopImmediatePropagation();
      latest = event.data.value;
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        try {
          w.__fsSeek?.(latest);
        } finally {
          parent.postMessage(
            { framescript: true, type: "preview-seek-done" },
            "*",
          );
        }
      });
    },
    true,
  );
}

function lazyComposition(
  scenes: { start: number; duration: number; document: string }[],
) {
  const w = window as any;
  const loaded = new Map<number, HTMLIFrameElement>();
  let current = 0,
    time = 0;
  w.__fsConsoleTarget = () => loaded.get(current)?.contentWindow;
  const seek = (index: number) =>
    loaded.get(index)?.contentWindow?.postMessage(
      {
        framescript: true,
        type: "seek",
        value: Math.max(0, time - scenes[index].start),
      },
      "*",
    );
  w.renderFrame = (value: number) => {
    time = value;
    current = scenes.findIndex(
      (scene) => time >= scene.start && time < scene.start + scene.duration,
    );
    if (current < 0) current = scenes.length - 1;
    const wanted = new Set(
      [current, current + 1].filter((index) => index < scenes.length),
    );
    for (const [index, frame] of loaded)
      if (!wanted.has(index)) {
        frame.remove();
        loaded.delete(index);
      }
    for (const index of wanted) {
      let frame = loaded.get(index);
      if (!frame) {
        frame = document.createElement("iframe");
        frame.title = `Timeline preview ${index + 1}`;
        frame.sandbox.add("allow-scripts");
        frame.srcdoc = scenes[index].document;
        frame.addEventListener("load", () => seek(index));
        loaded.set(index, frame);
        document.body.append(frame);
      }
      frame.style.visibility = index === current ? "visible" : "hidden";
    }
    seek(current);
  };
  window.addEventListener("message", (event) => {
    if (!event.data?.framescript) return;
    const entry = [...loaded].find(
      ([, frame]) => frame.contentWindow === event.source,
    );
    if (!entry) return;
    if (event.data.type === "ready") seek(entry[0]);
    if (
      entry[0] === current &&
      ["error", "preview-console", "preview-shortcut"].includes(event.data.type)
    )
      parent.postMessage(event.data, "*");
  });
}

export function previewDocument(
  project: Project,
  scale: number,
  textEditing: boolean,
  composition?: Project,
  sourceOffset?: number,
  shortcuts?: string[],
): string {
  let p = project;
  if (composition?.workflow?.scenes.length) {
    const scenes = composition.workflow.scenes.map((scene) => ({
      start: sceneOffset(composition, scene.id),
      duration: scene.duration,
      document: previewDocument(
        {
          ...composition,
          workflow: undefined,
          html: scene.html,
          css: scene.css,
          js: scene.js,
          settings: { ...composition.settings, duration: scene.duration },
        },
        scale,
        false,
        undefined,
        scene.sourceOffset,
        shortcuts,
      ),
    }));
    p = {
      ...project,
      html: "",
      css: "body{margin:0;position:relative}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}",
      js: `const __name=(fn)=>fn;(${lazyComposition.toString()})(${JSON.stringify(scenes)})`,
      workflow: undefined,
    };
  }
  const source = documentFor(p, { textEditing, sourceOffset });
  // A single line keeps existing user-code line mapping intact.
  const script =
    `(()=>{const __name=(fn)=>fn;(${previewRuntime.toString()})(${scale},${JSON.stringify(shortcuts)},(${keyboardChord.toString()}));})()`.replace(
      /\r?\n/g,
      " ",
    );
  return source.replace("<head>", () => `<head><script>${script}</script>`);
}
