# Universal AI Prompt Package

## Goal and dependencies

Provide a repeatable ZIP handoff for manual AI workflows and a validated path back into the editor. Depends on the scene architecture (8) and basic asset handling. The existing prompt builder supplies the creative brief and legacy render contract.

The [AI-generated scene and code contract](08-scene-architecture.md#ai-generated-scene-and-code-contract) defines the output FrameScript can interpret and edit. The package must communicate that versioned contract through `OUTPUT_CONTRACT.md`, and the importer must validate generated results against the declared version.

## Self-contained packages for Generate Edit and Extend

This version must support three entry points backed by one package contract. **Generate** uses the existing Prompt Builder and its creative format selector. **Edit / Update** and **Extend** open dedicated panels from contextual scene, clip or timeline actions. Carry the selected target, source revision and playhead position into the panel automatically. Show what the action will affect before packaging. Offer **Repair existing code** as an Edit preset.

A package is self-contained when an AI can understand the task and produce the requested result from the included files without prior chat history, local file paths or missing attachments. Include all context needed for the selected task, including source or example code, images, runtime dependencies and rendered preview frames as applicable. Use one package format and shared export, context selection and validation flows across the three modes.

### Generate a new scene

- **Package:** Creative brief, narration and timing when supplied, output dimensions, frame rate, target duration, renderer capabilities and selected references. References can include images, example code and preview frames. Include any runtime assets the new scene is expected to use.
- **Result:** A complete new scene with its own stable IDs and any required modules or assets. Import adds the new scene.
- **Continuity:** When generating a separate scene that follows an existing one, optionally include the previous scene's final frame and selected boundary state from [Requirement 1](01-scene-continuity.md).

### Edit an existing scene

- **Panel:** Show the selected scene, clip or timeline target and let the creator scope the edit to the whole scene or a time range. If clips share scene source, make clear whether the change affects only the selected clip or every instance using that source. Offer current-frame capture and additional frames that show the issue.
- **Package:** Target scene ID and exact base revision, current structured scene or HTML/CSS/JavaScript source, declared modules and runtime assets, requested changes, permitted scope, locked content and relevant preview frames. Attach example code or images when they explain the change.
- **Result:** A validated patch targeting named elements or properties by stable ID. For legacy code, allow revised source when the selected contract supports it and show the proposed change for review.
- **Preservation:** Keep unrelated content intact. Check the target and revision before application. A stale result requires a fresh package or explicit reconciliation and review.

### Extend an existing scene

- **Panel:** Show the selected target, actual handoff timestamp, requested added duration and the segment that will be preserved. If a clip is trimmed, distinguish revealing existing source time from generating new animation. Package an AI extension when the creator chooses to generate new material.
- **Package:** Target scene ID and exact base revision, current source and runtime dependencies, original duration, requested added duration, continuation brief and narration cues where supplied. Include a handoff frame from the packaged revision and relevant object, camera and motion state when available. A frame shortly before the handoff can show motion direction.
- **Result:** An extension to the same scene with the new duration and any declared changes at the handoff. Preserve the existing segment by default. Any requested changes to the existing segment must be in scope and visible in review.
- **Timing:** Identify the original endpoint, extension interval and whether narration cues use project or scene time. Check the target and revision before application using the same stale-result rules as Edit.

### Clip ownership and extension defaults

- When Edit or Extend starts from a clip, default to **This clip only**. If other clips share the source, create a separate scene version and relink only the selected clip when applying the result. When the clip is the sole user of the source, update it in place. When the action starts from a scene, target the shared source and show the affected placements.
- Offer **All clips using this scene** as an explicit shared-source choice. Save the selected clip, source revision and chosen scope with the request. The AI returns changes against the packaged source. FrameScript controls scene versioning, clip relinking and timeline placement.
- Extend grows only the selected placement by default, even when the source is extended for all clips. Preserve the other placements' starts, trims, speeds and durations. A scene-level extension without a selected placement changes the source duration only.
- If extending the selected placement would overlap a following clip, show the overlap and block Apply until the creator resolves it. Preserve downstream positions by default. An explicit timeline move or overlap choice must be reflected in the candidate before Apply.
- Recheck the selected clip's source link and the relevant placement impact at Apply. If the clip was removed or relinked, require a fresh task. If the affected placements changed and the source revision and task remain valid, refresh the impact and require review again. Commit source changes, any relink and timeline changes as one undoable transaction.

## Focused context for long scenes

- Use a scene duration threshold of **X minutes** to offer focused packaging. Determine X after testing representative projects and reviewing package sizes and AI result quality. Check actual source complexity, asset size, captures and context budgets for every package, including short scenes.
- For a long **Edit**, default to the selected time range when available. Include relevant objects, tracks, code, assets and frames, together with a short summary of the wider scene. Keep the requested edit scope visible even when its dependencies reach outside the range.
- For a long **Extend**, focus on the handoff. Include the final frame, a nearby frame showing motion when useful, available object and camera state, the source and assets needed for continuity, and instructions for the added time. Preserve the earlier segment when applying the result.
- Use declared dependencies to isolate structured scene context. For legacy HTML/CSS/JavaScript, include the full source when dependencies cannot be safely isolated and the source fits the budget. When required context exceeds the budget, identify what makes it too large and offer ways to reduce optional context. Block export if a self-contained package still cannot fit.

## ZIP structure

Generate, Edit and Extend use the same outgoing ZIP layout. The three root files are required. Include task-specific context and dependencies when applicable, include only schemas relevant to the selected mode, and omit empty folders.

```text
framescript-prompt.zip
├── TASK.md
├── manifest.json
├── OUTPUT_CONTRACT.md
├── context/
│   ├── brief.json
│   ├── narration.srt
│   └── handoff.json
├── source/
│   └── scene.json or HTML/CSS/JS and modules
├── assets/
│   └── runtime dependencies
├── references/
│   ├── images/
│   ├── example-code/
│   └── preview-frames/
└── schemas/
    └── supported output schemas
```

- **`TASK.md`** is the complete human-readable assignment. Include the request, target and revision where applicable, time range or handoff, what to preserve, which files to inspect and why, and what to return. List required evidence separately from optional references.
- **`manifest.json`** identifies the package type, task mode, package and contract versions, timing and output settings, and target scene, base revision and permitted scope where applicable. Each file entry identifies its path, role and hash.
- **`OUTPUT_CONTRACT.md` and `schemas/`** specify the allowed result for the selected mode and the schema and module interface it must follow.
- **`context/`, `source/`, `assets/` and `references/`** separate task and timing information, authoritative scene source, runtime dependencies and guidance. A reference image informs the result. A runtime image is a declared dependency that the renderer must resolve.

## Pasted prompt rules

The prompt-only workflow offers **Download ZIP** and **Copy prompt**. The creator attaches the ZIP and pastes the short prompt into the same AI message. Generate both the copied text and `TASK.md` from the same task data so their scope, filenames, target and expected result agree. Keep the ZIP usable on its own by putting the full assignment in `TASK.md`.

1. Lead with Generate, Edit or Extend and the creator's actual request. Name the target when applicable.
2. State the permitted scope and what to preserve. Include the relevant time range, handoff or added duration when it affects the task.
3. Tell the AI to open the attached ZIP and read `TASK.md` first. Name the key source or screenshot paths and what to inspect. Keep supporting details in the ZIP.
4. Specify the result required by `OUTPUT_CONTRACT.md`. Generate returns a new scene. Edit returns a patch or the supported legacy result. Extend returns an extension to the selected scene. Include the base revision for Edit and Extend.
5. If the AI cannot open the ZIP or access required evidence, ask it to name the file it needs before proceeding. Offer extraction instructions so the creator can attach that file directly.

### Example pasted Edit prompt

> Edit the Fireworks Galaxy scene. Move `galaxy-label` above `galaxy-marker` from 3.2s to 4.5s. Preserve the wording, animation timing and unrelated objects.
>
> Open the attached ZIP and read `TASK.md` first. Inspect `references/preview-frames/issue-3.200s.png` and the scene source listed in the task. Return a patch against revision 14 following `OUTPUT_CONTRACT.md`. If you cannot access a required file, name it before proceeding.

## Preview capture and package review

- Add **Capture current frame** to include the rendered frame from the live preview at the current playhead position. Allow selecting multiple frames and assigning roles such as **Show the issue**, **Match this look** and **Continue from here**.
- Record the source scene ID, scene revision and timestamp with its time basis for each capture. For Extend, capture the handoff from the same revision included as source. Flag a mismatch if the preview shows the last successful render while newer source is selected for packaging. Let the creator rerender, recapture or explicitly include the older image as a labeled reference when it is optional.
- Show **Package contents** before export. List code, assets, images and captured frames with their roles. Block export when required context is missing or a runtime dependency is unresolved, and identify what the creator needs to supply. Provide extraction instructions for AI tools that cannot read ZIPs directly.

### Export snapshot and source revision

1. Freeze the task at export. Generate the ZIP, copied prompt and locally saved request from the same immutable snapshot of the brief, source and included files. If any of those inputs changes, require a new ZIP export before copying the updated prompt. Keep the original exported task available for matching its result.
2. For Edit and Extend, display the exact revision being packaged. If newer edits are unapplied, let the creator explicitly use the last applied revision or apply the newer edits and successfully render them before capturing and packaging.
3. Require preview captures used as evidence to match the packaged source revision. Allow an older frame as optional comparison material when clearly labeled with its revision.
4. Retain the exported task snapshot for review. If the scene changes while the AI is working, show the revision its result was based on and offer a fresh export from the current revision. Apply the existing stale-result checks before any project change.

## Work required

### Task identity and context checklist

- Assign each exported task a request ID. Save its mode, target, base revision where applicable, allowed scope and expected result contract locally so the task can be matched after reopening the editor. Include the ID in the ZIP manifest and require the AI result to echo it. Validate against the locally recorded task.
- Give each mode a minimum context checklist. Generate requires the brief and output settings. Edit requires the target revision, scoped instructions and relevant source. Extend also requires the continuation brief, added duration and handoff evidence. Include declared runtime dependencies where needed.
- In **Package contents**, distinguish evidence the AI must inspect, optional guidance and assets required to run the scene. Focused packaging may reduce optional context while retaining required evidence and dependencies.

### Bring an AI result back into FrameScript

- Offer **Paste AI result** and **Upload result files** in the same review flow. The creator may use either or both for one task. For example, they can paste the structured result and upload the modules or assets it declares. A complete result ZIP can also be uploaded. Validate all supplied parts as one result and surface conflicting or missing parts before review.
- Match the result to the original request, then validate its contract, target, revision, scope and dependencies. Show the proposed changes before **Apply**. Keep the project intact until the creator applies a valid result.
- For malformed or invalid results, explain the issue and offer **Copy repair prompt**. If the AI cannot access a required ZIP file, identify the file and provide extraction instructions. If the result is stale, offer to export a fresh task from the current revision.

### Review before applying

Use one review screen for Generate, Edit and Extend, with a summary specific to the task.

1. For Edit and Extend, show the target scene and selected clip when applicable, the AI's base revision and the current revision. Keep stale results viewable, disable **Apply** and offer **Export fresh task**. Recheck the revision at Apply in case the project changed during review.
2. Show the proposed changes and their impact. For a keyframe edit, show its time and old and new values. Show the affected interpolation range when it can be determined. List other clips that use the same source and indicate which would be affected under the selected edit scope.
3. Preview the candidate without changing the project. For Edit, compare before and after at the same playhead time. For Extend, start at the handoff and allow scrubbing across it. For Generate, show the proposed new scene and its duration.
4. Offer **Apply** and **Discard** for the whole reviewed result. Apply the same candidate that was previewed as one undoable transaction. To revise part of the result, refine the request and review the returned candidate.

- Define distinct versioned manifests for outgoing handoffs and incoming results. Include optional images, code, prior-scene references, assets and schemas only when used.
- Record IDs, roles, targets, scope, relative paths, hashes, MIME types, sizes and provenance. Distinguish reference-only files from runtime dependencies. State whether reference code may be inspected, adapted or reused.
- Compile the prompt from the scene contract, creative brief, narration timing, renderer capabilities and selected references. Offer an extraction workflow for AI tools without ZIP support.
- Define the incoming scene or patch, optional modules and assets, and continuity or generation metadata. Validate manifest type and version, dependencies, paths, hashes and formats before applying changes.
- Set archive, expanded-size and context limits. Check for traversal, ZIP bombs, malformed manifests and exposed secrets. Keep reference files outside the execution path. Present import diagnostics and allow human review.

## Deliverables and acceptance

The [first structured AI edit milestone](first-edit-milestone.md) records the proposed initial package, pasted prompt and expected result.

Deliver the manifest schemas, deterministic ZIP exporter, importer, prompt compiler, reference selector and validation report. Verify that a reference-free package works, references resolve to their intended targets, repeated exports have equivalent logical contents and hashes, and invalid or incompatible packages produce actionable errors.

1. Export each mode and use it in a fresh AI session with only the package contents. Validate and import each corresponding result.
2. Verify that Generate adds a new scene. Include a case with no optional references and a case with an image, example code and a captured frame.
3. Verify that Edit changes only the requested properties and preserves unrelated content. Include a legacy repair result that can be reviewed before application.
4. Verify that Extend increases the duration of the same scene, preserves the original segment and uses the packaged handoff at the expected time.
5. Verify that capture metadata identifies the correct frame and source revision, and that the builder surfaces a preview/source mismatch and missing required context.
6. Verify that stale, wrong-target, invalid or out-of-scope Edit and Extend results cannot silently change the project.
7. Verify that Edit and Extend open from contextual actions with the correct target, revision and playhead. Cover shared source scope and the distinction between revealing trimmed source time and generating new animation.
8. Verify focused packaging for a long structured scene, full-source fallback for legacy code with inseparable dependencies, and an actionable error when required context exceeds the budget. Include a short scene with large assets to verify that budget checks also apply below the duration threshold.
9. Verify that the copied prompt and ZIP agree on mode, target, scope, required file paths and output. Verify that the task is readable from the ZIP alone and that the prompt explains what to do when the receiving tool cannot access a required file.
10. Verify paste-only, upload-only and combined result imports. Check that a reopened workspace can match the request, that a result for a different task on the same revision is rejected, and that malformed, incomplete and stale results offer the appropriate recovery action.
11. Verify that changing the brief, source or included files after export requires a fresh ZIP before copying an updated prompt. Test packaging the last applied revision while newer edits are pending, applying and recapturing the newer revision, rejecting a mismatched required capture, and reviewing a stale result against its original snapshot.
12. Verify that review previews leave the project intact, that each mode opens at the appropriate view, and that shared clip usage and known interpolation effects are visible. Verify that a result that becomes stale during review cannot apply, Discard leaves the project intact, and one Undo reverts the entire applied result.
13. With two clips sharing a scene, verify that a clip-only Edit affects one placement and a shared-source Edit affects both. Verify that Extend grows only the selected placement by default, that a new overlap requires resolution before Apply, and that Undo restores the original source links and durations. Cover a relinked clip and a changed list of affected placements during review.
