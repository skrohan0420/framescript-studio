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

- **Stage 0 — Planned.** Next action is to record the baseline commit and verify the test prerequisites.
- **Stage 1 — Planned.** The illustrative patch is documented. The versioned schemas and fixtures are pending.
- **Stage 2 — Planned.** Depends on Stage 1's outgoing contract and fixture.
- **Stage 3 — Planned.** Depends on the expected result and saved task contract.
- **Stage 4 — Planned.** Depends on the full round trip and a working test environment.
- **Stage 5 — Planned.** Depends on evidence from the first Edit milestone.

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

- Exact FSSF v1 fields, module interface and patch schema. Resolve for the baseline in Stage 1.
- Rendering and loopback test prerequisites. Verify in Stage 0 and resolve before the applicable Stage 4 checks.
- Project-to-source time, shared-source fixtures and extension handoff rules for nontrivial clips. Resolve before expanding those workflows.
- Package budgets and long-scene threshold. Set after measuring representative handoffs and first-result success.

Update the tracker when a stage starts, a blocker appears or clears, or a stage passes its exit checks. Link test evidence and issue records so the next session can resume from the last verified state.
