# AI Directed Text Animation and Smart Labeling

## Goal and dependencies

Import AI-authored titles, captions, object labels, callouts and kinetic typography as editable text. Depends on the scene architecture (8), package contract (7) and timeline (4). Reuse existing typography presets and prompt text controls where applicable.

## Work required

- Define native text nodes with stable IDs, content, style tokens, safe margins, anchors, entrance and exit behavior and keyframes.
- Map narration cues to text timing. Represent inferred phrase timing separately from verified word timestamps. Preserve explicit wording and text inclusion settings.
- Support object anchors, camera-aware placement and rules for collision or occlusion. Provide editable presets and per-item overrides.
- Define font resolution, fallback and measurement so preview and export agree. Publish the AI output rules and expose editable text through the inspector and timeline.

## Deliverables and acceptance

Deliver the schema, renderer, presets, inspector, timeline integration and placement workflow. Verify that a generated label can be moved, restyled, retimed and deleted independently. Test anchors, safe margins, reading time and font fallback. Verify that the import preserves supplied text and only creates requested text items.
