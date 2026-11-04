# Unified Timeline System

## Goal and dependencies

Use one authoritative clock across scenes, narration, music, SFX, text, effects and animated properties. Depends on scene IDs and timing contracts from requirement 8. Existing clip edits and source offsets provide migration inputs.

## Work required

- Specify integer ticks or rational time, exact frame and sample conversions, rounding and boundary ownership. Define conversions between project time and source time through trims, offsets and speed changes.
- Define tracks, clips, keyframes, track ordering, links, groups, transitions and overlap semantics. Expose APIs for typography, continuity, audio and structured patches.
- Implement collapsible lanes, zoom, snapping, move, trim, split, multi-select, locking, grouping, ripple and non-ripple editing. Make edits transactional for undo and redo.
- Virtualize large timelines and keep scrubbing responsive. Use shared timing rules for preview and export.

## Deliverables and acceptance

Deliver the timebase specification, schemas, command model and timeline UI. Test long timelines, speed changes, trim/split boundaries, snapping, linked edits and overlapping scenes. Verify audio and picture stay aligned in preview and export, and undo/redo restores the exact prior state.
