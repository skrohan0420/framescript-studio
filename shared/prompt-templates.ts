export const promptTemplates = [
  {
    id: "canvas",
    name: "Canvas animation",
    brief:
      "Create a polished procedural Canvas 2D animation with actual visual objects, lighting, motion and composition.",
  },
  {
    id: "motion",
    name: "Motion graphics",
    brief:
      "Create responsive HTML/CSS motion graphics with layered shapes, illustrations and deliberate transitions.",
  },
  {
    id: "explain",
    name: "Explainer / infographic",
    brief:
      "Explain the supplied narration through accurate visual relationships, diagrams and clearly staged motion. Use labels only when requested.",
  },
  {
    id: "type",
    name: "Kinetic typography",
    brief:
      "Animate the supplied on-screen text with readable typography and intentional timing. Keep narration and displayed text distinct.",
  },
  {
    id: "depth",
    name: "Perspective / parallax",
    brief:
      "Create layered HTML/CSS perspective and parallax with depth, a camera-like move and transform-style: preserve-3d. Do not require a 3D library.",
  },
  {
    id: "repair",
    name: "Repair existing code",
    brief:
      "Repair the supplied code for FrameScript. Preserve the intended visuals and behavior while fixing errors, layout, deterministic seeking and playback integration.",
  },
] as const;

export type PromptDraft = {
  template: string;
  script: string;
  timedNarration?: string;
  duration: number;
  bgm?: boolean;
  sfx?: boolean;
  style: string;
  visuals: string;
  camera: string;
  screenText: string;
  notes: string;
  format: "document" | "separate";
};
export function buildCodePrompt(
  draft: PromptDraft,
  width: number,
  height: number,
  code?: { html: string; css: string; js: string },
) {
  const template =
    promptTemplates.find((item) => item.id === draft.template) ??
    promptTemplates[0];
  const audioTracks = [
    ...(draft.bgm
      ? [
          {
            id: "bgm",
            name: "Scene soundtrack",
            lane: "music",
            start: 0,
            length: draft.duration,
            duration: 4,
            loop: true,
            volume: 0.25,
            notes: [
              {
                at: 0,
                duration: 3.9,
                frequency: 130.81,
                wave: "sine",
                gain: 0.12,
              },
              {
                at: 0,
                duration: 3.9,
                frequency: 164.81,
                wave: "sine",
                gain: 0.08,
              },
              {
                at: 0,
                duration: 3.9,
                frequency: 196,
                wave: "triangle",
                gain: 0.05,
              },
            ],
          },
        ]
      : []),
    ...(draft.sfx
      ? [
          {
            id: "sfx-1",
            name: "Scene accent",
            lane: "sfx",
            start: draft.duration / 2,
            length: Math.min(0.4, draft.duration / 2),
            duration: 0.4,
            loop: false,
            volume: 0.65,
            notes: [
              {
                at: 0,
                duration: 0.35,
                frequency: 500,
                endFrequency: 90,
                wave: "sine",
                gain: 0.4,
              },
            ],
          },
        ]
      : []),
  ];
  return `You are creating animation code for FrameScript Studio, a local HTML/CSS/JavaScript video editor.

TASK: ${template.brief}

CREATIVE BRIEF
Duration: ${draft.duration} seconds.
Canvas: ${width} × ${height} pixels. Use the whole frame.
Narration / script (context, not automatically on-screen text):
${draft.script.trim() || "No narration supplied."}
${
  draft.timedNarration?.trim()
    ? `
TIMED NARRATION — SCENE-LOCAL SECONDS
${draft.timedNarration.trim()}

Treat these timestamps as the timing authority. Stage visual actions, reveals, emphasis and transitions at the corresponding spoken phrases. Keep pauses and gaps; do not distribute the narration evenly or shift the cues to zero. Use these scene-local cue times directly in renderFrame(timeInSeconds). Keep the specified scene duration. These cues provide narration context, not permission to add on-screen text; follow the on-screen text requirement below.
`
    : ""
}

Visual subjects and action:
${draft.visuals.trim() || "Choose visuals that support the narration."}
Style: ${draft.style.trim() || "Clean, cinematic motion graphics with a consistent palette."}
Camera / framing: ${draft.camera.trim() || "Intentional framing; smooth movement only when it helps the animation."}
On-screen text: ${draft.screenText.trim() || "None. Do not add titles, captions or labels."}
Additional requirements: ${draft.notes.trim() || "None."}
Background music (BGM): ${draft.bgm ? "Required as actual synthesized soundtrack data inside the generated code, not a written plan." : "Not requested."}
Sound effects (SFX): ${draft.sfx ? "Required as actual synthesized sound cues inside the generated code, synchronized to visual actions and narration." : "Not requested."}
${
  audioTracks.length
    ? `
GENERATED SOUNDTRACK CONTRACT
Include exactly one inert <script type="application/json" id="framescript-audio"> inside the HTML body. FrameScript reads this JSON when the code is imported, synthesizes real WAV audio, and creates editable music/SFX timeline tracks for playback and export. This script is data, not executable JavaScript.
Use the following valid structure, but COMPOSE appropriate chords, rhythm, melodies and sound cues to suit this specific scene. Change frequencies, note times, gains and cue placement to match the visuals and timed narration. Do not merely return this example unchanged or describe audio in prose:
<script type="application/json" id="framescript-audio">${JSON.stringify({ tracks: audioTracks })}</script>
Each track requires a unique id, name, lane (music or sfx), start (scene-local seconds), length (timeline seconds), loop and volume (0–1). For a custom score provide duration (source audio seconds, 0.05–30) and notes (at, duration, frequency in Hz, optional endFrequency for sweeps, wave: sine/triangle/square/noise, gain 0–1). Note times are relative to the track source and every note must fit its source duration. Overlapping notes make chords. A looping BGM score can cover the entire scene using its length. Keep source audio durations across all tracks at most 60 seconds, at most 8 tracks and 256 notes per track. Keep cue starts and ends within the scene. Do not generate a voiceover; the editor already supplies narration. Never call AudioContext, new Audio(), autoplay or play() inside the scene. Audio timing comes from this manifest and the managed timeline.
`
    : ""
}

FRAMESCRIPT REQUIREMENTS — FOLLOW EXACTLY
1. Expose window.renderFrame = function(timeInSeconds) { ... }. Time is in SECONDS, from 0 to ${draft.duration}. This is the only animation clock; the editor calls it for play, pause, scrubbing, split clips and frame-by-frame export. Do not use renderAt(milliseconds) instead.
2. Every renderFrame(t) call must draw the complete correct frame for t, independent of prior calls. Seeking backward, jumping ahead and rendering the same t twice must work. Show meaningful visuals at t=0 and clamp times outside the intended duration safely.
3. Do not start requestAnimationFrame loops, setInterval, setTimeout, autoplay, performance.now() or Date.now() driven animation. Do not call play() automatically. Do not use unseeded Math.random() while rendering; precompute deterministic geometry or use a seeded generator.
4. For Canvas 2D, clear/reset drawing state appropriately and draw all layers each frame. For DOM/CSS, derive transforms/styles from t, or explicitly set and pause animation.currentTime=t*1000. Avoid competing animation clocks and cumulative transforms.
5. HTML, CSS and JavaScript must be self-contained. No external files, style.css links, script.js references, CDN imports, module scripts, fetch calls, frameworks, packages, images or fonts that need downloading. Use inline classic JavaScript and procedural visuals, CSS or inline SVG.
6. The editor plays audio through managed timeline tracks. ${audioTracks.length ? "Provide the required soundtrack manifest above, but never play audio directly inside the iframe." : "Do not add audio or narration."} Do not create playback controls, replay buttons, editor panels, player chrome or debug overlays inside the output frame.
7. html, body and the visual root must fill the frame with margin:0, padding:0 and overflow:hidden. Do not cap the animation at a smaller width or add letterboxing. Keep Canvas backing resolution aligned with the ${width}×${height} output; handle other viewport sizes gracefully.
8. Define renderFrame at top level before the document load event. Access DOM elements after they exist. All selectors must match real HTML elements. Use valid CSS and JavaScript, no placeholders, missing functions, TODOs or pseudocode.
9. Keep rendering practical for a modest computer. Prefer bounded object counts, cached geometry and simple effects. Do not produce an empty gradient or text-only placeholder when a visual animation is requested.
10. When on-screen text is requested, use real HTML text elements with CSS or Web Animations where practical, so FrameScript can capture reusable typography styles and keyframes. Keep each reusable text treatment in its own element. Avoid drawing text into Canvas unless essential to the requested effect.

${
  code
    ? `EXISTING CODE TO REPAIR / ADAPT
HTML:
${code.html}
CSS:
${code.css}
JavaScript:
${code.js}
`
    : ""
}
OUTPUT FORMAT
${draft.format === "document" ? "Return exactly ONE complete HTML document in one html code block, with inline <style> in <head> and an inline classic <script> after the body elements. FrameScript will split those into its HTML, CSS and JavaScript tabs, retaining the soundtrack JSON in HTML. Do not reference separate files." : "Return exactly THREE clearly labeled code blocks: HTML (body markup, including the inert soundtrack JSON script when requested), CSS, and JavaScript. Do not put <style> or executable <script> tags in the HTML block. The user will paste each block into the corresponding editor tab."}
Before answering, verify selectors, frame-zero visibility, deterministic renderFrame(0), renderFrame(${draft.duration / 2}), renderFrame(${draft.duration}), and then a backward seek to renderFrame(0). Return complete working code without extra commentary.`;
}
