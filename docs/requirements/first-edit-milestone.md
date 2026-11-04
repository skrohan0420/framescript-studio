# First structured AI edit milestone

## Status and scope

Proposed first integration milestone for [Requirement 7](07-ai-prompt-package.md) and [Requirement 8](08-scene-architecture.md). The workflow and expected behavior are documented here for future reference. Example field names and version values are provisional until FSSF v1 is published.

Use one Fireworks Galaxy scene with a Canvas star, a native text label and one editable glow track. Place it in one untrimmed clip at normal speed. The star instance `star-core` exposes `glowIntensity` as a keyframeable number from 0 to 1. The existing keyframe `glow-peak` is at scene time 3.2 seconds and has a value of 0.6. The task changes that value to 0.8 and preserves the keyframe time, label and unrelated properties.

## Outgoing handoff

Regenerate the [fixture](../../tests/fixtures/structured-edit/round-trip.json) with `node node_modules/tsx/dist/cli.mjs scripts/build-structured-edit-fixture.ts` from the repository root with Playwright Chromium available. The [generator](../../scripts/build-structured-edit-fixture.ts) writes the sample ZIP, copied prompt, saved request, expected patch, review candidate and importable `fireworks-galaxy.frame` under `test-results/structured-edit-fixture`. To try the editor workflow, open that .frame file, select the visual clip and use **Edit / Update** in the timeline. Both paths use FrameScript's PNG renderer for the packaged keyframe.

Open **Edit / Update** from the clip. Capture the preview at 3.2 seconds and package it with the source scene at revision 14. Include `TASK.md`, `OUTPUT_CONTRACT.md`, `manifest.json`, the scene and its declared module and asset dependencies, the preview frame and the patch schema. Generate the short copied prompt and `TASK.md` from the same task. The creator attaches the ZIP and pastes the prompt into a fresh AI session.

> Edit Fireworks Galaxy, revision 14. Increase the star's glow at 3.2s to 0.8. Keep the keyframe time, label and other properties as they are. Read TASK.md in the attached ZIP and inspect the preview frame it lists. Return a patch following OUTPUT_CONTRACT.md. If you cannot access a required file, name it before proceeding.

## Incoming result

Keep the exported task snapshot linked to its request ID. If the scene advances beyond revision 14 before the result returns, show that the AI worked from revision 14 and offer a fresh export. See [export snapshot rules](07-ai-prompt-package.md#export-snapshot-and-source-revision).

The creator can paste the result, upload it as a file, or combine pasted result text with supporting uploads. The first Edit fixture is self-contained JSON. The result echoes the request ID so FrameScript can find the saved task and validate its scope.

Allow one operation in this fixture. Update the value of an existing keyframe identified by stable ID. Use the timestamp as task context. Resolve the edit against the declared scene, revision, instance, property and keyframe IDs.

```json
{
  "contractVersion": "1",
  "type": "scene-patch",
  "requestId": "fireworks-glow-edit-001",
  "sceneId": "fireworks-galaxy",
  "baseRevision": 14,
  "operations": [
    {
      "op": "set-keyframe-value",
      "nodeId": "star-core",
      "property": "glowIntensity",
      "keyframeId": "glow-peak",
      "value": 0.8
    }
  ]
}
```

Validate the revision, operation scope and value before review. Show the base and current revision and the glow change at 3.2 seconds from 0.6 to 0.8. Show the affected interpolation range when known. Compare the original and candidate at the same playhead time without changing the project. Recheck the revision before applying the whole reviewed result as one undoable transaction. Discard leaves the project intact.

## Acceptance checks

1. A fresh AI session produces a result that imports without manual repair.
2. Applying it changes exactly one stored keyframe value. Undo restores 0.6 and redo restores 0.8.
3. Repeated, forward and backward seeks to 3.2 seconds agree. Preview and export reflect the new glow at the intended time.
4. A stale revision, a value of 1.4 or an operation that targets the label fails before changing the project.

## Next design discussion

Keep the first fixture on one clip. A follow-up shared-source fixture should exercise the [clip ownership and extension defaults](07-ai-prompt-package.md#clip-ownership-and-extension-defaults). Use [Requirement 4 timeline semantics](04-unified-timeline.md) to specify project-to-source time mapping and handoff behavior for split, trimmed and speed-adjusted clips.
