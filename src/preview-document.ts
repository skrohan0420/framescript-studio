import { documentFor } from "../shared/runtime";
import { sceneOffset } from "../shared/workflow";
import type { Project } from "../shared/project";

export type PreviewQuality = "auto" | "1080" | "full";
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
function previewRuntime(scale: number) {
  const w = window as any;
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
    if (entry[0] === current && event.data.type === "error")
      parent.postMessage(event.data, "*");
  });
}

export function previewDocument(
  project: Project,
  scale: number,
  textEditing: boolean,
  composition?: Project,
  sourceOffset?: number,
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
    `(()=>{const __name=(fn)=>fn;(${previewRuntime.toString()})(${scale});})()`.replace(
      /\r?\n/g,
      " ",
    );
  return source.replace("<head>", `<head><script>${script}</script>`);
}
