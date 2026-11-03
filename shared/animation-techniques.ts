export const animationTechniques = [
  {
    id: "transform",
    name: "Move & transform",
    detail:
      "Move, rotate, scale or fade a subject with a clear start and finish.",
    example: "A planet rotates as a satellite slides into view.",
    variants: ["Move", "Rotate", "Scale", "Fade"],
    control: "Distance / angle",
    placeholder: "e.g. move 20% right; rotate 90°",
  },
  {
    id: "stagger",
    name: "Stagger & sequence",
    detail: "Offset repeated actions so the audience can follow their order.",
    example: "Five cells activate one after another.",
    variants: ["Forward", "Reverse", "Center outward"],
    control: "Delay between objects",
    placeholder: "e.g. 0.15 seconds",
  },
  {
    id: "spring",
    name: "Spring & bounce",
    detail: "Add a controlled overshoot and readable settling motion.",
    example: "An assembled component lands with one gentle bounce.",
    variants: ["Gentle spring", "Bounce", "Elastic"],
    control: "Damping / bounce",
    placeholder: "e.g. one small overshoot, settle in 0.6s",
  },
  {
    id: "path",
    name: "Path motion",
    detail: "Follow a curve, orbit a subject or travel along a route.",
    example: "A particle follows a curved pipe into a chamber.",
    variants: ["Curve", "Orbit", "Route"],
    control: "Path / orientation",
    placeholder: "e.g. clockwise orbit, face direction of travel",
  },
  {
    id: "reveal",
    name: "Draw & reveal",
    detail: "Draw paths progressively or uncover parts with a mask.",
    example: "A circuit draws itself from the power source outward.",
    variants: ["Draw path", "Mask reveal", "Wipe"],
    control: "Reveal direction",
    placeholder: "e.g. left to right over 1.2 seconds",
  },
  {
    id: "parallax",
    name: "Depth & parallax",
    detail:
      "Separate foreground, subject and background movement to establish depth.",
    example: "Nearby trees move faster than mountains during a camera move.",
    variants: ["Subtle layers", "Deep layers", "Perspective"],
    control: "Depth separation",
    placeholder: "e.g. foreground 2× background movement",
  },
  {
    id: "camera",
    name: "Camera movement",
    detail:
      "Change framing to reveal information while keeping the subject readable.",
    example: "Orbit a molecule, then move closer to its central bond.",
    variants: ["Pan", "Push in / zoom", "Track subject", "Dolly", "Orbit"],
    control: "Framing / travel",
    placeholder: "e.g. wide to close-up; 30° clockwise orbit",
  },
  {
    id: "assembly",
    name: "Assembly & disassembly",
    detail: "Build a subject from parts or separate it into an exploded view.",
    example: "A battery separates into layers to show its internal structure.",
    variants: ["Assemble", "Exploded view", "Disassemble"],
    control: "Order / spacing",
    placeholder: "e.g. outer shell first, separate layers by one width",
  },
] as const;
export type TechniqueId = (typeof animationTechniques)[number]["id"];
export type TechniqueSelection = {
  id: TechniqueId;
  variant?: string;
  amount?: string;
  start?: number;
  duration?: number;
};
export type AnimationDirection = {
  renderingMode?: "auto" | "2d" | "2.5d" | "3d";
  animationTechniques?: TechniqueSelection[];
  animationIntensity?: string;
  animationEasing?: string;
  animationSync?: string;
};
export function restoreTechniques(value: unknown): TechniqueSelection[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (
      !item ||
      !animationTechniques.some((t) => t.id === item.id) ||
      seen.has(item.id)
    )
      return [];
    seen.add(item.id);
    return [
      {
        id: item.id,
        variant: typeof item.variant === "string" ? item.variant : undefined,
        amount: typeof item.amount === "string" ? item.amount : undefined,
        start: Number.isFinite(item.start)
          ? Math.max(0, item.start)
          : undefined,
        duration: Number.isFinite(item.duration)
          ? Math.max(0.05, item.duration)
          : undefined,
      },
    ];
  });
}
export function animationDirection(
  draft: AnimationDirection,
  duration: number,
) {
  const selections = restoreTechniques(draft.animationTechniques);
  const mode = draft.renderingMode ?? "auto";
  const renderer =
    mode === "3d"
      ? `RENDERING: True 3D using the bundled window.THREE and FrameScript3D helper. No imports or CDN scripts. Use procedural meshes, coherent lighting and perspective or orthographic cameras. FrameScript3D.create({canvas, width, height, background}) returns {scene,camera,renderer,render,dispose}. It uses pixel ratio 1 and preserveDrawingBuffer for export. Call view.render() at the END of every window.renderFrame(t). Do not use setAnimationLoop or requestAnimationFrame. Set every transform from absolute t; never use rotation += or mixer.update(delta). Use AnimationMixer.setTime(t) for any preloaded animation. Core Three.js only: addons, OrbitControls and GLTFLoader are not bundled. No external assets.`
      : mode === "2.5d"
        ? "RENDERING: 2.5D layered HTML/CSS or Canvas with perspective and parallax; no Three.js required."
        : mode === "2d"
          ? "RENDERING: 2D Canvas, inline SVG or HTML/CSS; do not use Three.js or WebGL."
          : "";
  if (!renderer && !selections.length) return "";
  return `${renderer}
RENDER EFFICIENCY: Initialize geometry, materials, textures and static paths once outside renderFrame. For repeated 3D objects sharing geometry/material, use THREE.InstancedMesh where appearance and ordering permit. Cache unchanged 2D backgrounds at full output resolution; invalidate them when their inputs change. Update transforms instead of rebuilding objects. Keep the requested antialiasing, effects, texture resolution and detail; do not use lower resolution or fewer frames as a performance shortcut.
${
  selections.length
    ? `SELECTED ANIMATION TECHNIQUES
Shared intensity: ${draft.animationIntensity || "Moderate"}. Shared easing: ${draft.animationEasing || "Smooth ease in/out"}. Synchronization: ${draft.animationSync || "Follow narration cues"}.
${selections
  .map((item) => {
    const technique = animationTechniques.find((t) => t.id === item.id)!;
    const start = Math.min(duration, item.start ?? 0);
    const length = Math.min(
      Math.max(0, duration - start),
      item.duration ?? duration - start,
    );
    return `- ${technique.name}: ${technique.detail} Variation: ${item.variant || technique.variants[0]}. ${technique.control}: ${item.amount?.trim() || "Adapt to subject and framing"}. Timing window: ${start}–${start + length}s. Individual settings override shared defaults.`;
  })
  .join("\n")}
Combine compatible techniques on separate transform groups. Preserve supplied narration timestamps; place accents within each requested window. Use readable holds. Adapt camera and path techniques to the selected rendering mode (2D pan/zoom versus 3D dolly/orbit). Evaluate motion analytically from t, including springs and stagger; no accumulated simulation state. Do not add unselected effects or any text unless Typography explicitly permits it.`
    : ""
}`;
}
