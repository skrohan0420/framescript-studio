# FrameScript Studio development prompts

Use these prompts to start or resume a development stage in a new Codex chat. Paste the shared instructions and one stage prompt. If work is already underway, add the current branch, relevant commit or PR, and any known blocker. The [development plan](development-plan.md) defines stage status and exit checks.

## Shared instructions

```text
Work in the FrameScript Studio repository. Read any applicable repository instructions, then read docs/requirements/README.md, development-plan.md, first-edit-milestone.md and the relevant numbered requirements in that folder.

Inspect the current branch, working tree, existing implementation and tracker before changing anything. Resume from the latest verified state and preserve existing user changes. Work on the selected stage and reuse existing editor, preview, persistence and export paths where appropriate. Make routine reversible decisions and record any that affect stored data, compatibility or creator-visible behavior. Escalate only genuine blockers or decisions that cannot be safely inferred.

Verify through normal entry points where applicable. Record commands, results, fixture and commit references, and any checks blocked by the environment. Update docs/requirements/development-plan.md with the current status, issues, decisions and next action. Mark the stage Done only when its exit checks have evidence. Finish with what changed, what was verified and the next concrete action.
```

## Stage 0 — Baseline and scope

```text
Run Stage 0 from the development plan. Record the baseline branch and commit, working-tree state, and entry points for project persistence, clip targeting, preview, export and undo. Check the installed test prerequisites, including Playwright Chromium and loopback access. Run the relevant baseline tests and distinguish product failures from environment blockers. Confirm the first fixture scope of one untrimmed clip at normal speed with a Canvas star, native label and editable glow track. Record evidence and any work needed before integration verification.
```

## Stage 1 — Specify the first round trip

```text
Run Stage 1 using the first Edit milestone. Make a reproducible fixture for the outgoing ZIP contents, copied prompt, saved request, source scene, preview evidence and expected AI result. Define the minimum versioned contracts and one supported operation that changes the existing glow-peak keyframe from 0.6 to 0.8 at scene time 3.2 seconds. Preserve its time and unrelated content. Cover request ID, scene ID, base revision, allowed scope, stable keyframe ID and value constraints. Verify the validator accepts the expected result and rejects stale revisions, wrong scope and invalid values. Record what the fixture proves and which broader contract decisions remain open.
```

## Stage 2 — Build the outgoing Edit handoff

```text
Run Stage 2 using the Stage 1 fixture and Requirement 7. Connect Edit / Update to the selected clip. Show the exact source revision and package contents. Generate Download ZIP, Copy prompt and the saved request from one frozen snapshot. Required preview evidence must match the packaged source revision. Persist the request so it can be matched after reopening. Verify that changed task inputs require a fresh ZIP before copying the updated prompt and that the original request remains identifiable. Use the manual prompt-only workflow.
```

## Stage 3 — Build result intake and review

```text
Run Stage 3. Accept pasted results, uploaded result files or both in the same flow. Match the request and validate target, revision, operation scope, values and dependencies before review. Show the keyframe change and affected interpolation range when known. Preview before and after at the same playhead without mutating the project. Provide specific recovery for malformed, incomplete and stale results. Recheck validity at Apply and commit the whole reviewed candidate as one undoable transaction. Verify Discard, undo and redo, and a result that becomes stale while under review.
```

## Stage 4 — Verify the complete Edit milestone

```text
Run Stage 4 through the normal editor workflow. Use the ZIP and copied prompt in a fresh AI session and record whether the first result imports and performs the requested edit without repair. If the handoff must be performed by the creator, prepare the actual package and prompt, then record the outstanding check and the exact steps to complete it. Verify the keyframe change, repeat and backward seeks, preview/export timing, invalid-result rejection and legacy import, preview and export. Record the tested commit, fixture, commands and observed results. Keep the milestone in verification if any required evidence is missing.
```

## Stage 5 — Expand in separate workflows

```text
Run Stage 5 one workflow at a time. Start by defining and testing project-to-source timing and handoffs for shared, split, trimmed and speed-adjusted clips under Requirements 4 and 7. Verify clip-only relinking, shared-source impact and overlap handling. Then deliver Generate and Extend as separate round trips, each with its own package, valid and invalid results, review and undo checks. Compare focused and full context in representative handoffs before setting package budgets or a long-scene threshold. Record evidence for each workflow before moving on to typography, continuity and audio in roadmap dependency order. Include the applicable migration, recovery, security, accessibility and performance checks before release.
```
