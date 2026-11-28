import { z } from "zod";
import type { AnimationDirection } from "./animation-techniques";

export const renderingModeSchema = z.enum(["auto", "2d", "2.5d", "3d"]);

export function renderingRequirement(config: AnimationDirection, structured = false) {
  const mode = config.renderingMode ?? "auto";
  if (structured) return mode === "3d" || mode === "2.5d"
    ? "RENDERING CAPABILITY CONFLICT: This native structured output cannot deliver the requested depth renderer. Explain the limitation and ask for Full HTML document or Separate HTML, CSS, and JavaScript output before generating; do not claim native shapes are true 3D."
    : "RENDERING: Use only the supported native 2D shapes and tracks.";
  if (mode === "auto") return "RENDERING: The director chooses 2D, 2.5D or true 3D within output capabilities. Include the approach and rationale in the final specification.";
  if (mode === "2d") return "CONFIGURED RENDERING — 2D REQUIRED\nUse Canvas 2D, inline SVG or HTML/CSS. Do not use Three.js or WebGL. Preserve this choice in identity, proposals and implementation.";
  if (mode === "2.5d") return "CONFIGURED RENDERING — 2.5D REQUIRED\nUse layered depth, occlusion, perspective and parallax. Preserve this choice in identity, proposals and implementation.";
  return `CONFIGURED RENDERING — TRUE 3D REQUIRED
Use the bundled window.THREE and window.FrameScript3D for actual three-dimensional geometry, materials, lights and a perspective camera. Canvas 2D drawings, flat discs, stacked vector shapes, CSS zooms and billboard-only scenes do not satisfy this requirement.
Build forms with visible volume and curved-surface shading, using materials, light softness, color regions and shadow treatment appropriate to the selected reference style. For luminous stars, retain a readable spherical surface and restrained emission/glow; avoid lighting or emission that washes away their volume. Separate foreground, subject and background in depth. Use restrained camera travel or object rotation when it reveals form, with parallax and occlusion that demonstrate spatial relationships. Keep silhouettes readable and motion tied to narration.
This configured rendering choice takes precedence over conflicting flat/2D appearance only where it demands flat geometry or removes spatial depth. It does not override the reference's art direction: preserve graphic color blocking, simplified shapes, broad shading, palette, composition and explanatory clarity on real 3D forms. Rendering and reference style are joint requirements: 3D controls construction; the selected reference controls appearance. Do not replace the selected look with generic cinematic realism, glossy product rendering or unrelated 3D styling. Preserve supplied scientific facts, identity colors, narration timing and object continuity.
Every identity option, director proposal, final specification and implementation must respect this requirement. Do not silently fall back to 2D; identify an actual capability conflict if one exists.`;
}

export function reference3DArtDirection(config: AnimationDirection & { referenceStyle?: string; referenceInfluence?: string }) {
  if (config.renderingMode !== "3d" || !config.referenceStyle?.trim()) return "";
  const authority = `REFERENCE-LED 3D ART DIRECTION
The selected reference is the visual foundation, not an optional accent added after making generic 3D. Reference influence: ${config.referenceInfluence || "Balanced"}. Preserve the requested influence while adapting the reference's shape language, color relationships, materials, composition and motion to real 3D geometry. Any older instruction to stay flat applies to graphic simplicity and color treatment, not to removing volume. In the final specification, explain how the reference is expressed in geometry, materials/lighting, palette, framing and motion. Check the result at a wide view and a close-up: recognizable reference principles and real depth must both remain visible.`;
  if (!/^Kurzgesagt(?:-inspired)?\b/i.test(config.referenceStyle)) return authority;
  return `${authority}
SELECTED PRESET EXPANSION — STYLIZED 3D SCIENCE TREATMENT
KURZGESAGT-INSPIRED ART DIRECTION ON TRUE 3D GEOMETRY
- Shape language: simplified rounded geometric subjects, bold clean silhouettes, readable proportions and carefully placed graphic surface details. Use actual volumetric meshes and curved surfaces, with detail organized into a few large readable masses. Avoid faceted low-poly substitutions or intricate realistic anatomy unless the brief requests them.
- Color design: rich complementary colors and large, clean color regions; consistent background/subject/accent roles and warm/cool separation. Preserve locked project colors. Cosmic settings may use deep navy/violet backgrounds, warm luminous subjects and restrained cool accents when appropriate to the narration. These are suggested roles, not claims about an official palette.
- Materials and light: matte or toon-like materials with broad, controlled shading regions and selective soft highlights. Preserve the illustrated color blocking on rounded 3D forms. Use MeshToonMaterial or carefully lit diffuse materials where suitable, with lighting that reveals volume without bleaching saturated colors. Keep metalness near zero for illustrated subjects; no default glossy plastic, chrome or physically realistic surface noise. For stars, constrain bloom/emission so the colored spherical surface and graphic layers remain readable.
- Environments and composition: layered, simplified environmental shapes placed at real foreground/midground/background depths, purposeful negative space and a dominant explanatory subject. Keep scenes visually designed and diagrammatically clear. Use gentle perspective, restrained camera angles, occlusion and modest parallax; avoid wide-angle distortion and constant dramatic orbits that make the scene resemble a generic space simulation.
- Motion and storytelling: smooth motivated transformations, staged comparisons, readable reveals and holds aligned with narration. Keep recurring subjects recognizable through scale changes and transitions. Motion should explain the science rather than advertise the renderer.
- Preserve this treatment across every shot and continuation. Strong influence means these principles remain clearly visible throughout; subtle influence uses selected accents. Create original artwork, subjects and compositions; do not copy logos, mascots or specific existing frames. Do not flatten the geometry to achieve the illustrated look.
STYLE ACCEPTANCE: actual 3D volume and depth; simplified rounded silhouettes; rich clean color blocking; restrained matte/toon shading; clear educational staging. If the result looks like generic glossy or photorealistic 3D, revise materials, palette, detail and framing while keeping its 3D geometry.`;
}
