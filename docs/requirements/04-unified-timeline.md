# Unified Timeline System

## Goal and dependencies

Use one authoritative clock across scenes, narration, music, SFX, text, effects and animated properties. Depends on scene IDs and timing contracts from requirement 8. Existing clip edits and source offsets provide migration inputs.

## Work required

- Specify integer ticks or rational time, exact frame and sample conversions, rounding and boundary ownership. Define conversions between project time and source time through trims, offsets and speed changes.
- Define tracks, clips, keyframes, track ordering, links, groups, transitions and overlap semantics. Expose APIs for typography, continuity, audio and structured patches.
- Implement collapsible lanes, zoom, snapping, move, trim, split, multi-select, locking, grouping, ripple and non-ripple editing. Make edits transactional for undo and redo.
- Virtualize large timelines and keep scrubbing responsive. Use shared timing rules for preview and export.

## Deliverables and acceptance

### Structured Edit clip timing

The current editor stores clip duration and source offset in seconds. In combined preview, subtract the clip's project start to get clip-local time. Add the source offset to get source time. Playback speed changes elapsed playback time. For example, a source keyframe at 3.200s is 1.200s into a clip with a 2.000s source offset, and playback reaches that point after 0.600 seconds at 2× from the clip start.

Use a half-open source interval for Edit eligibility. A keyframe at a cut belongs to the clip starting there. Keep the keyframe frame index and stable ID in the patch. A changed trim invalidates the saved task. Clip-only Apply forks the structured source ID if another clip shares it, and Undo restores the previous source link. This is the existing-editor bridge for the structured Edit workflow. The canonical timebase and Extend handoff remain part of the unified timeline work.

Deliver the timebase specification, schemas, command model and timeline UI. Test long timelines, speed changes, trim/split boundaries, snapping, linked edits and overlapping scenes. Verify audio and picture stay aligned in preview and export, and undo/redo restores the exact prior state.
