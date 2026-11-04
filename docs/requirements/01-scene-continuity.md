# Scene Continuity Integration

## Goal and dependencies

Carry selected objects and visual intent between scenes. Depends on the scene architecture (8), package contract (7) and unified timeline (4). Current combined preview can sequence scenes.

## Work required

- Define a versioned handoff manifest for persistent object IDs, start/end transforms, velocity, camera state and direction, lighting, palette and environment. Specify which fields are required and which the creator can override.
- Capture outgoing boundary state and optional reference frames. Compile a next-scene brief with the relevant state, assets and references.
- Support cuts, dissolves, overlaps, match cuts and explicit handoff rules. Use the same transition composition in preview and export.
- Validate incoming and outgoing state. Surface differences at the boundary and provide overrides for intentional changes. Define how persistent IDs and intentional cuts are represented.

## Deliverables and acceptance

Deliver the continuity manifest, boundary capture and inspection, transition compositor and next-scene prompt compiler. Verify that a persistent object carries position and motion through a planned handoff, that intentional cuts remain available, and that overlapping transitions render consistently in preview and export. Include a multi-scene astronomy fixture with a moving object and a camera handoff.
