import type { z } from "zod";
import type { editSceneSchema } from "./structured-edit";

export type StructuredEditScene = z.infer<typeof editSceneSchema>;

// Keep picking and rendering on the same interpolation without changing
// the generated source stored in existing projects.
export function structuredShapeValuesSource(fps: number) {
  return `const values = { x: object.x, y: object.y, opacity: object.opacity };
    for (const track of object.tracks) {
      const progress = track.keyframe.frame === 0 ? 1 : Math.max(0, Math.min(1, seconds * ${fps} / track.keyframe.frame));
      values[track.property] += (track.keyframe.value - values[track.property]) * progress;
    }`;
}

export function matchesStructuredSceneCode(
  source: { html: string; css: string; js: string },
  scene: StructuredEditScene,
) {
  const code = structuredStarCode(scene);
  return source.html === code.html && source.css === code.css && source.js === code.js;
}

const renderer = `function renderStar(context, { glowIntensity }) {
  const { width, height } = context.canvas;
  const x = width / 2;
  const y = height / 2;
  context.fillStyle = "#080d20";
  context.fillRect(0, 0, width, height);
  const halo = context.createRadialGradient(x, y, 0, x, y, 100);
  halo.addColorStop(0, "rgba(128, 181, 255, " + glowIntensity + ")");
  halo.addColorStop(1, "rgba(128, 181, 255, 0)");
  context.fillStyle = halo;
  context.fillRect(x - 100, y - 100, 200, 200);
  context.beginPath();
  context.arc(x, y, 10, 0, Math.PI * 2);
  context.fillStyle = "#eef5ff";
  context.fill();
}`;
export const starModuleSource = renderer + "\nexport { renderStar };\n";

export function structuredStarCode(scene: StructuredEditScene) {
  const { star, label } = scene;
  const keyframe = star?.keyframe;
  const labelScript = label
    ? `\ndocument.querySelector("#galaxy-label").textContent = ${JSON.stringify(label.text).replaceAll("<", "\\u003c")};`
    : "";
  const code = {
    html: `<canvas width="${scene.width}" height="${scene.height}"></canvas>${label ? '<span id="galaxy-label"></span>' : ""}`,
    css: "body{margin:0}span{position:absolute;bottom:24px;width:100%;text-align:center;color:white;font:24px sans-serif}",
    js: `${star ? renderer + "\n" : ""}const context = document.querySelector("canvas").getContext("2d");${labelScript}`,
  };
  if (star && keyframe) {
    code.js += `\nwindow.renderFrame = seconds => {
  const position = Math.min(1, seconds * ${scene.fps} / ${Math.max(1, keyframe.frame)});
  renderStar(context, { glowIntensity: ${keyframe.frame === 0 ? keyframe.value : `${star.glowIntensity} + (${keyframe.value} - ${star.glowIntensity}) * position`} });
};`;
  } else {
    code.js += `\nwindow.renderFrame = () => {
  context.fillStyle = "#080d20";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
};`;
  }
  const extension = scene.continuation;
  if (extension && star && keyframe) {
    const from =
      keyframe.frame === 0
        ? keyframe.value
        : star.glowIntensity +
          (keyframe.value - star.glowIntensity) *
            Math.min(1, extension.startFrame / keyframe.frame);
    code.js += `\nconst originalFrame = window.renderFrame;
window.renderFrame = seconds => {
  originalFrame(seconds);
  if (seconds * ${scene.fps} >= ${extension.startFrame}) {
    const progress = Math.max(0, Math.min(1, (seconds * ${scene.fps} - ${extension.startFrame}) / ${extension.endFrame - extension.startFrame}));
    renderStar(context, { glowIntensity: ${from} + (${extension.value} - ${from}) * progress });
  }
};`;
  }
  if (scene.objects?.length)
    code.js += `\nconst nativeObjects = ${JSON.stringify(scene.objects).replaceAll("<", "\\u003c")};
const frameBeforeObjects = window.renderFrame;
window.renderFrame = seconds => {
  frameBeforeObjects(seconds);
  for (const object of nativeObjects) {
    ${structuredShapeValuesSource(scene.fps)}
    context.save();
    context.globalAlpha = values.opacity;
    context.fillStyle = object.color;
    if (object.kind === "rectangle") context.fillRect(values.x, values.y, object.width, object.height);
    else {
      context.beginPath();
      context.ellipse(values.x, values.y, object.width / 2, object.height / 2, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
};`;
  return code;
}
