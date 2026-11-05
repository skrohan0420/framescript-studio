# Visual scene editing and creative freedom

Recorded from the creator discussion on 5 November 2026. This document captures the requested direction and proposed implementation sequence. It is a planned extension, not a claim that a full visual editor exists or a commitment to its first-release scope.

## Purpose and roadmap ownership

Let creators select elements in the live preview, edit their declared properties in the right panel and manipulate them directly. Routine adjustments should not require an external AI round trip. AI remains useful for creating scenes, redesigning compositions and authoring complex behavior.

Requirement 8 owns the scene representation, editable properties, selection interfaces and deterministic evaluation. Requirement 3 owns the inspector and interaction UX. Requirement 4 owns animation/keyframe timing. Requirement 7 must export the latest visually edited state in every subsequent AI package. This does not change the agreed production ZIP plus prompt → generated code workflow.

## Selection from the preview

- Clicking a supported element selects its stable object or module-instance ID, highlights its bounds and opens its properties in the right panel. Synchronize selection with an object list so obscured or very small elements remain accessible.
- Convert pointer coordinates through preview scaling, letterboxing and scene transforms into source coordinates. Resolve overlapping elements consistently with the scene's draw order; respect locks.
- Canvas is a raster surface, so selection requires scene hit testing or a supported picking mechanism, not inspection of pixels alone. Native nodes must expose geometry/transforms. Procedural modules must declare selectable objects or regions, bounds and hit-test behavior if they support internal selection.
- Expose a module as a whole when its internals are not separately addressable. Do not promise that every visible particle or arbitrary generated-code variable is individually editable.

## Right-panel properties

Generate controls from typed, declared editable properties and their constraints. Candidate controls include:

- Shapes: position, width, height, fill, border, opacity and rotation.
- Text: content, font, size, color, alignment and spacing.
- Images: position, dimensions, crop and opacity.
- Procedural modules: declared parameters such as glow, particle count or speed.

These are planned capabilities; individual controls become available only when their scene/module contract supports them. Show units, bounds, animation status and validation feedback. Unsupported properties must not appear editable. Preserve unrelated properties and stable IDs.

## Direct manipulation and history

Provide drag-to-move, resize and rotation handles, followed by snapping and alignment aids. Update the same underlying values used by the inspector. Define anchors, local/world coordinates, aspect-ratio behavior and transformed-object handling before enabling those interactions.

Pause or otherwise stabilize playback during manipulation using an explicit interaction policy. Provide keyboard alternatives and cancellation. Preview movement responsively, then commit one completed gesture as one Undo step; cancel restores the pre-gesture state. Undo/Redo must restore data, keyframes and any affected source links together.

For shared source clips, reuse the existing clip-only/shared-source ownership rules. Make the affected placements visible before modifying shared data; respect locked content and recheck the target when committing.

## Animated properties

Distinguish base-value editing from editing or adding a keyframe at the current playhead. Do not silently choose whether dragging modifies an animation or its underlying value. Show the active mode, whether the property is animated and which keyframe/value will change.

Use the authoritative project-to-source time conversion, including clip placement, trim, source offset and playback semantics. Specify frame rounding, interpolation and behavior between keyframes. The inspector, handles, timeline, preview and export must resolve the same value at the same source time.

## Authoritative data and generated code

Visual edits update authoritative scene data or declared module parameters. The supported renderer/code projection reflects that state. Do not implement structured editing through fragile text replacements in generated JavaScript.

Persist the edited state through save/reopen and include it in the next AI ZIP as the current source revision. Invalidate outdated exported prompts when relevant source changes. Generated code and included JSON metadata must agree with the same scene state; reuse Requirement 8 validation and Requirement 7 revision/scope checks.

## Creativity and standardization

Standardize how content connects to FrameScript: stable IDs, time, dependencies, editable property declarations, module lifecycle and validation. Allow artistic freedom in composition, visual style, drawing techniques and supported procedural behavior.

A narrow vocabulary can restrict creative output. The current mandatory star and small shape set are temporary milestone constraints, not the intended production vocabulary. Native nodes should cover common editing needs while procedural modules support more complex visuals.

There is a real tradeoff between procedural freedom and editable coverage. A complex galaxy can expose a few useful parameters without exposing every particle as a node. Choose meaningful controls rather than requiring every implementation detail to be individually editable.

The AI must satisfy both the creative brief and the code contract. Concise schemas, valid examples, reusable modules and actionable diagnostics can reduce that burden but do not guarantee unchanged creative quality. Test visual quality and variety as well as schema validity. Do not narrow the contract merely to maximize validation success.

## Proposed development order

1. General scene objects, stable IDs and typed editable properties; remove the mandatory-star restriction from the production scene model.
2. Object list and contextual right-panel inspector with validated changes and Undo/Redo.
3. Preview selection, hit testing and selection bounds.
4. Dragging, resizing and rotation, then snapping/alignment and keyboard interactions.
5. Keyframe-aware inspector/manipulation modes connected to the timeline.
6. Module-level and optional internal procedural selection and declared controls.

This is a sequencing proposal. Before each increment, record supported node types, interactions and acceptance evidence in the development tracker. A complete visual editor adds work beyond the current implementation; revise the earlier time/line estimates after agreeing the production-release scope.

## Acceptance checks

- Select native objects from a scaled preview and the object list; verify correct selection under overlap and transforms, and correct inspector values.
- Edit supported shape, text, image and module properties as each becomes available. Reject invalid values and preserve unrelated content.
- Drag/resize/rotate at different preview scales. Verify source-coordinate results, locks, cancellation, one-step Undo and Redo.
- Edit animated properties in both modes, with trims and shared clips. Verify intended keyframe/base changes and interpolation in preview and export.
- Save/reopen, export an AI package and verify that it includes the visually edited state and correct revision. Reject stale AI results.
- Check repeated/backward seeks and preview/export consistency after visual edits. Verify procedural selection only where declared.
- Compare representative creative tasks for output quality, variety, contract success and editable coverage. Measure how many routine changes can be completed without AI and whether controls remain responsive on representative scenes.

## Decisions still needed before implementation

Choose the first supported node/property set, selection/picking mechanism, coordinate and anchor conventions, animation-editing interaction policy and procedural selection capabilities. Define performance targets and representative test scenes. These implementation choices remain open; the requested visual-editing direction is recorded above.
