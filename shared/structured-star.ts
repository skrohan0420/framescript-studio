import type { z } from "zod";
import type { editSceneSchema } from "./structured-edit";

export type StructuredEditScene = z.infer<typeof editSceneSchema>;

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
  const keyframe = scene.star.keyframe;
  return {
    html: `<canvas width="${scene.width}" height="${scene.height}"></canvas><span id="galaxy-label"></span>`,
    css: "body{margin:0}span{position:absolute;bottom:24px;width:100%;text-align:center;color:white;font:24px sans-serif}",
    js: `${renderer}
const context = document.querySelector("canvas").getContext("2d");
document.querySelector("#galaxy-label").textContent = ${JSON.stringify(scene.label.text).replaceAll("<", "\\u003c")};
window.renderFrame = seconds => {
  const position = Math.min(1, seconds * ${scene.fps} / ${Math.max(1, keyframe.frame)});
  renderStar(context, { glowIntensity: ${keyframe.frame === 0 ? keyframe.value : `${scene.star.glowIntensity} + (${keyframe.value} - ${scene.star.glowIntensity}) * position`} });
};`,
  };
}
