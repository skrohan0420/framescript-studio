# Scene Continuity Integration

## Goal and dependencies

Carry selected objects and visual intent between scenes. Depends on the scene architecture (8), package contract (7) and unified timeline (4). Current combined preview can sequence scenes.

## Seamless HTML/CSS/JavaScript extensions

Use **Extend → Direction** to ask the AI to carry the previous visual through the handoff. Send the copied prompt and ZIP together. The ZIP contains the previous source and its last visible frame. Use the source to recover the animation state and the frame to check the appearance.

- Reuse the renderer and drawing code for persistent objects. Carry forward the camera, transforms, materials, textures, blending, lighting, and seeded particle layout wherever they affect the handoff.
- Start the extension's local clock at zero and map that time to the original handoff state. Continue the direction and speed of existing motion through the boundary. Let the next narration cue determine when the new visual beat begins.
- In **Review**, step through the last outgoing frame and the first two incoming frames. Check that brightness, framing, and object placement change only as expected from one frame of motion. Play across the join at normal speed before applying.

In the galaxy example, the original Three.js scene used feathered textures and additive blending. A continuation with solid Canvas 2D dots changed the apparent brightness even though the nominal star size and opacity matched. Keep the Three.js galaxy, camera, and particle materials through the handoff, then animate the new beats on those same objects.

## Work required

- Define a versioned handoff manifest for persistent object IDs, start/end transforms, velocity, camera state and direction, lighting, palette and environment. Specify which fields are required and which the creator can override.
- Capture outgoing boundary state and optional reference frames. Compile a next-scene brief with the relevant state, assets and references.
- Support cuts, dissolves, overlaps, match cuts and explicit handoff rules. Use the same transition composition in preview and export.
- Validate incoming and outgoing state. Surface differences at the boundary and provide overrides for intentional changes. Define how persistent IDs and intentional cuts are represented.

## Deliverables and acceptance

Deliver the continuity manifest, boundary capture and inspection, transition compositor and next-scene prompt compiler. Verify that a persistent object carries position and motion through a planned handoff, that intentional cuts remain available, and that overlapping transitions render consistently in preview and export. Include a multi-scene astronomy fixture with a moving object and a camera handoff.
