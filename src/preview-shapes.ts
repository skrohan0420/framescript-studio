import type { StructuredEditScene } from "../shared/structured-star";

type Shape = NonNullable<StructuredEditScene["objects"]>[number];
export type PreviewShapePick = {
  clipId: string;
  sceneId: string;
  revision: number;
  objectId: string | null;
};
type ShapeSource = Omit<PreviewShapePick, "objectId"> & {
  width: number;
  height: number;
  objects: Shape[];
};

// Serialized into the sandbox. Pointer coordinates are already local to
// the iframe, including when the editor scales it or nests it in the timeline.
export function previewShapes(
  { width, height, objects, ...source }: ShapeSource,
  evaluate: (
    object: Shape,
    seconds: number,
  ) => Pick<Shape, "x" | "y" | "opacity">,
) {
  const w = window as any;
  const frontToBack = objects.slice().reverse();
  let picking = false;
  let selected: Shape | undefined;
  let outline: HTMLDivElement | undefined;
  const canvas = () => document.querySelector("canvas");
  const bounds = (shape: Shape) => {
    const { x, y, opacity } = evaluate(shape, w.__fsTime());
    const ellipse = shape.kind === "circle";
    return {
      left: ellipse ? x - shape.width / 2 : x,
      top: ellipse ? y - shape.height / 2 : y,
      width: shape.width,
      height: shape.height,
      opacity,
    };
  };
  const updateOutline = () => {
    const rect = selected && canvas()?.getBoundingClientRect();
    if (!selected || !rect?.width || !rect.height) {
      outline?.remove();
      return;
    }
    const box = bounds(selected);
    if (!outline) {
      outline = document.createElement("div");
      outline.dataset.fsShapeOutline = "";
      outline.setAttribute("aria-hidden", "true");
      outline.style.cssText =
        "position:fixed;pointer-events:none;z-index:2147483647;outline:2px solid #68afff";
    }
    outline.dataset.fsShapeOutline = selected.id;
    if (!outline.isConnected) document.body.append(outline);
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    Object.assign(outline.style, {
      left: rect.left + box.left * scaleX + "px",
      top: rect.top + box.top * scaleY + "px",
      width: box.width * scaleX + "px",
      height: box.height * scaleY + "px",
    });
  };
  w.__fsShapeOutline = updateOutline;
  w.__fsPickShape = (event: MouseEvent) => {
    const target = picking && canvas();
    if (!target || event.target !== target) return false;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const x = ((event.clientX - rect.left) * width) / rect.width;
    const y = ((event.clientY - rect.top) * height) / rect.height;
    const hit = frontToBack.find((shape) => {
      const box = bounds(shape);
      if (box.opacity <= 0) return false;
      const u = (x - box.left) / box.width;
      const v = (y - box.top) / box.height;
      return shape.kind === "rectangle"
        ? u >= 0 && u <= 1 && v >= 0 && v <= 1
        : (2 * u - 1) ** 2 + (2 * v - 1) ** 2 <= 1;
    });
    w.__fsClearElementSelection();
    parent.postMessage(
      {
        framescript: true,
        type: "shape-pick",
        value: { ...source, objectId: hit?.id ?? null },
      },
      "*",
    );
    return true;
  };
  window.addEventListener("message", (event) => {
    if (event.source !== parent || !event.data?.framescript) return;
    const { type, value } = event.data;
    if (type === "select" || type === "select-shapes") picking = value === true;
    if (type === "shape-selection") {
      selected =
        value?.clipId === source.clipId
          ? objects.find((shape) => shape.id === value.objectId)
          : undefined;
      if (selected) w.__fsClearElementSelection();
      updateOutline();
    }
  });
}
