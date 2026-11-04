# FrameScript Studio development plan and tracker

## Approach

Use the [copy-ready development prompts](development-prompts.md) to start or resume a stage in a new chat.

Build in small, testable workflows. Start with the creator handoff in [Requirement 7](07-ai-prompt-package.md), then define the minimum scene and result contract in [Requirement 8](08-scene-architecture.md) needed to complete that workflow. Develop and test them together through the [first structured AI Edit milestone](first-edit-milestone.md). Expand supported operations after the first workflow passes its release checks.

Keep requirements in their numbered files, implementation evidence and status in this tracker, and concrete inputs and expected results in fixtures. Review routine, reversible implementation decisions in the normal code review. Record decisions that change compatibility, stored data or creator-visible behavior in the decision log and link the relevant requirement.

## Stages and exit checks

### Stage 0 — Baseline and scope

- Identify the preview, project persistence, clip targeting, export and undo entry points to reuse.
- Record the baseline commit, test commands and outcomes. Track environmental limits separately from product failures. Earlier local checks encountered missing Playwright Chromium and restricted loopback access. Recheck both before counting the rendering or integration gates as verified.
- Freeze the initial test scenario to one untrimmed clip at normal speed, a Canvas star with a declared glow parameter and a native label.
- Exit when the first fixture's scope is agreed and baseline evidence and test prerequisites are recorded.

### Stage 1 — Specify the first round trip

- Define the example outgoing ZIP, copied prompt, saved request, source scene, preview image and expected result. Include the request ID, base revision, allowed operation and keyframe ID.
- Define the minimum versioned schemas and one patch operation. Create a valid fixture and invalid fixtures for wrong scope, stale revisions and invalid values.
- Exit when a validator can distinguish the valid and invalid fixture results and the expected project changes are written down.

### Stage 2 — Build the outgoing Edit handoff

- Wire Edit / Update from the clip into the task builder. Freeze the source, prompt, assets and required capture in one export snapshot.
- Add package review, Download ZIP and Copy prompt. Persist enough task information to match a result after reopening the project.
- Exit when a fresh AI session can understand the task from the package and prompt, and changing the brief or source requires a fresh export for the updated prompt.

### Stage 3 — Build result intake and review

- Support paste, upload or both. Match the request and validate the result and its declared dependencies before preview.
- Show the target, base revision, affected time range when known and before/after preview at the same playhead. Offer appropriate recovery for malformed, incomplete and stale results.
- Apply the reviewed result as one undoable change. Recheck revision and scope at Apply.
- Exit when the creator can import, review, apply, undo and redo the glow change through the normal editor flow. Invalid, stale and discarded results must leave the project intact.

### Stage 4 — Verify the complete Edit milestone

- Run a real prompt-only handoff and record whether the first result imports and satisfies the task without repair.
- Verify repeated and backward seeks, preview/export timing and legacy import, preview and export. Save reproducible test evidence with the commit under test.
- Exit when the [milestone acceptance checks](first-edit-milestone.md#acceptance-checks) pass. Track environmental blockers explicitly until the affected checks can run.

### Stage 5 — Expand in separate workflows

- Define project-to-source time and handoff rules with [Requirement 4](04-unified-timeline.md). Add fixtures for shared source, clip-only relinking, trims, splits, speed changes and extension overlaps.
- Add Generate and Extend end to end. Verify each mode's package, result, review and undo behavior separately. Compare focused and full context in representative AI handoffs before fixing package limits or a long-scene threshold.
- Once those workflows are stable, sequence typography, continuity and audio through their documented dependencies. Continue UX and accessibility work throughout. Confirm migration, recovery, security and performance checks before release.

## Progress tracker

Use **Planned**, **In progress**, **Blocked**, **In verification** or **Done**. Mark a stage Done when its exit checks have evidence. Record partial checks under the active stage.

- **Stage 0 — Done.** Baseline, reusable entry points and test prerequisites recorded below.
- **Stage 1 — Done.** The versioned Edit fixture, candidate validator and sample ZIP are verified. Stage 2 can wire the outgoing workflow into the editor.
- **Stage 2 — Planned.** Depends on Stage 1's outgoing contract and fixture.
- **Stage 3 — Planned.** Depends on the expected result and saved task contract.
- **Stage 4 — Planned.** Depends on the full round trip and a working test environment.
- **Stage 5 — Planned.** Depends on evidence from the first Edit milestone.

### Stage 0 baseline evidence

- **4 November 2026.** Branch `codex/structured-ai-edit`, baseline commit `06538ef47fb0552ce715a4cce0e8a282fb23328b`, clean working tree before this tracker update. Node v26.12.1 and bundled FFmpeg were available.
- **TypeScript.** `node node_modules/typescript/bin/tsc --noEmit` passed.
- **Baseline suite.** `node node_modules/vitest/vitest.mjs run --reporter=dot` passed all 146 tests across 37 files with approved access to the host environment. The sandboxed run passed 129 and failed 17. Six OAuth fixture tests hit loopback `EACCES`, and 11 rendering tests could not find Chromium in the sandbox browser cache. All 17 passed on rerun with host access. Use the verified host setup for later browser and loopback checks.
- **Persistence.** [Editor workspace load](../../src/App.tsx#L605) and [project save](../../src/App.tsx#L815) use the bridge. [Server RPC](../../server/index.ts#L410) dispatches workspace and project operations backed by the [database](../../server/database.ts#L234).
- **Clip targeting and undo.** [Timeline actions](../../src/Timeline.tsx#L230) already route visual splits through shared timeline logic. Reuse the [project store history](../../src/store.ts#L191) for undoable edits.
- **Preview and export.** The [editor preview](../../src/App.tsx#L3186) renders in a [sandboxed iframe](../../src/Preview.tsx#L537), with the [shared runtime](../../shared/runtime.ts#L70) evaluating `renderFrame(time)`. Export starts from the [editor action](../../src/App.tsx#L1195) and reaches the [render worker](../../server/export-worker.ts#L7).
- **Scope decision.** Use the [first Edit milestone](first-edit-milestone.md) as written. One untrimmed clip at normal speed, a Canvas star, native label and one glow keyframe edit. Stage 1 defines the versioned schema and fixtures. The browser end-to-end and live AI handoff gates belong to Stage 4.

### Stage 1 verification evidence

- **4 November 2026.** Implemented on `codex/structured-ai-edit` from baseline report commit `a3f4825`. [Shared schemas and candidate validator](../../shared/structured-edit.ts) enforce a single scoped keyframe-value operation against the saved request and current scene revision.
- The fixture uses frame 96 at 30 fps for 3.2 seconds. Its provisional scene format models one Canvas module instance and one native label. The candidate changes only glow from 0.6 to 0.8. The committed project revision is left to the future Apply transaction.
- `node node_modules/vitest/vitest.mjs run tests/structured-edit.test.ts` passed all 10 tests. Coverage includes stale response and current scene revisions, wrong request and scene, edits to the label or another keyframe, invalid or unrequested values, and attempts to change timing. TypeScript passed with `node node_modules/typescript/bin/tsc --noEmit`.
- `node node_modules/tsx/dist/cli.mjs scripts/build-structured-edit-fixture.ts` generated the ZIP, copied prompt, saved request and expected result and candidate under `test-results/structured-edit-fixture`. Used host Chromium to render the baseline PNG. Verified that the ZIP contained exactly the listed payload files plus its manifest and that all payload SHA-256 hashes matched.
- Next action is Stage 2. Reuse the fixture to wire the editor entry point and freeze a real task snapshot. Production capture, persistent request storage, result review and the live AI round trip remain later-stage checks.

### Progress report template

- Date and reporting period
- Stage and status
- Completed work and associated commit or PR
- Tests run and results, including skipped or blocked checks
- Open problems and decisions
- Next concrete action and owner when assigned

### Problem report template

- Issue ID, date, stage and status
- Impact and classification such as product defect, design question or environment blocker
- Reproduction steps with commit, fixture or request ID, and environment
- Expected behavior, actual behavior and relevant evidence
- Next action, owner when assigned and workaround if available
- Fix reference and verification result when resolved

### Decision log template

- Date, decision and status
- Reason and trade-off
- Affected requirements, fixtures or compatibility guarantees
- Follow-up and the condition that would reopen the decision

## Open items to track

- The narrow Stage 1 fixture contract is defined. Broader FSSF v1 fields, the production module interface and additional patch operations remain open.
- Rendering and loopback test prerequisites are verified with host access. Use that setup for the applicable Stage 4 checks.
- Project-to-source time, shared-source fixtures and extension handoff rules for nontrivial clips. Resolve before expanding those workflows.
- Package budgets and long-scene threshold. Set after measuring representative handoffs and first-result success.

Update the tracker when a stage starts, a blocker appears or clears, or a stage passes its exit checks. Link test evidence and issue records so the next session can resume from the last verified state.
