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
- **Stage 2 — Done.** The outgoing editor workflow and saved request passed the live AI handoff.
- **Stage 3 — Done.** JSON intake, candidate review, stale-result checks and undoable Apply are verified for the first Edit workflow.
- **Stage 4 — Done.** Automated parity and legacy checks passed. The first live AI patch imported and applied.
- **Stage 5 — In progress.** Edit, Generate and Extend have verified live built-in star workflows. Generate now supports optional references and basic native shapes; broader modules, focused long-scene context and release checks remain open.

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

### Stage 2 verification evidence

- **4 November 2026.** Implemented on `codex/structured-ai-edit` from `d2bf3a5`. Import the generated [Fireworks Galaxy fixture](first-edit-milestone.md#outgoing-handoff), select its visual clip and open **Edit / Update** in the timeline. This milestone supports the original untrimmed structured clip at normal speed. The panel shows the source revision, required frame and ZIP contents.
- **Download ZIP** captures the keyframe with FrameScript's PNG renderer using the same built-in scene projection as the preview. The ZIP, copied prompt and locally saved request are built from the same inputs. The saved request includes the clip and scope, source scene, manifest and prompt. Changes to the requested value require a fresh ZIP before Copy prompt is available.
- TypeScript and all 156 Vitest tests passed. The Stage 2 Playwright test verified the clip entry point, download, clipboard contents, prompt invalidation and request lookup after reload with the local server. The generated sample ZIP contained all six declared payloads with matching SHA-256 hashes.
- Outstanding handoff check. In a fresh AI chat, attach `test-results/structured-edit-fixture/fireworks-glow-edit.zip` and paste `copied-prompt.txt` from the same directory. Check that the AI can inspect the PNG and returns the requested keyframe patch. Compare the result with `expected-result.json` and record the outcome. Stage 3 handles editor-side result intake and review.

### Stage 3 verification evidence

- **4 November 2026.** Implemented on `codex/structured-ai-edit` from `69cd1e3`. In **Edit / Update**, open **Import AI result** and paste a JSON patch, upload a JSON file or provide matching copies. The first contract is self-contained and has a 64 KB input limit. Supporting files and result ZIPs are follow-up work for contracts that need dependencies.
- New exported requests record the local project identity. Requests saved before project matching was added need a fresh export. The importer checks the original project, clip, request, target, revision, operation and allowed value. Malformed or conflicting inputs can be corrected using the validation message and repair prompt.
- The candidate opens in the existing side-by-side review at the affected keyframe. Review shows the base and current revisions, value change and interpolation effect. Apply rechecks the current snapshot and uses one project history transaction. A stale result can be inspected, with an action to export from the current source.
- `node node_modules/typescript/bin/tsc --noEmit`, all 156 Vitest tests and both tests in `tests/structured-edit.spec.ts` passed. The browser test exercised malformed and fenced JSON, paste, upload, matching and conflicting combined inputs, different preview pixels, Discard, Apply, Undo and Redo. It verified that a source change during review disables Apply.
- Next action is Stage 4 verification. The live handoff outcome is recorded under Stage 4. Use the editor to export a new task, bring the real response back, and record first-attempt success and preview/export evidence.

### Stage 4 verification evidence

- **4 November 2026.** Tested Stage 3 commit `2e57df0` plus Stage 4 test changes on `codex/structured-ai-edit`.
- Reproduction command with host Chromium and loopback access: `node node_modules/playwright/cli.js test tests/structured-edit.spec.ts tests/workspace.spec.ts --grep 'exports a frozen|reviews paste|local Node backend|workspace executes preview' --reporter=line`.
- TypeScript passed. All four selected Playwright tests passed. The exported PNG matched the live preview pixel-for-pixel in the 200 × 200 glow region at frame 96.
- The structured test uses a fixture response tied to a real editor-exported request. It checks .frame import, exact saved scene data after Apply and Redo, invalid and stale results, identical canvas frames on repeated and backward seeks, and a pixel comparison of the glow region against an editor-exported PNG at 3.2 seconds. The legacy checks cover project save/reopen/import, preview/seek and MP4 export.
- The outgoing test saves the actual downloaded ZIP and matching prompt in its Playwright output directory. Its request is stored in the isolated test workspace. For a live round trip, export a new task from the same FrameScript browser and project where the AI result will be imported.

### Live AI handoff result

- **4 November 2026.** Claude received the editor ZIP and copied prompt in a fresh chat and reported sampling the packaged PNG. Its first JSON patch matched request `b77c746e-7688-4f64-9b6b-3e7408d60a2c`. FrameScript accepted it without repair, showed glow changing from 0.6 to 0.8 at 3.200 seconds, and advanced the clip from revision 14 to 15 after Apply.

To repeat the check:

1. Open the generated `test-results/structured-edit-fixture/fireworks-galaxy.frame` using **Open .frame file** on the project home. Select the visual clip, open **Edit / Update**, keep the requested value at 0.8, then use **Download ZIP** and **Copy prompt**.
2. In a fresh AI chat, attach that ZIP and paste the copied prompt in the same message. Record whether the AI could access the included PNG and save its first response before making any corrections.
3. In the same FrameScript project and browser, open **Edit / Update → Import AI result**. Paste or upload the first response and record whether it passes validation without repair. Verify the review shows glow changing from 0.6 to 0.8 at 3.2 seconds. Apply it and record the outcome.
4. Record the request ID, first-attempt outcome and any error or missing attachment. Update Stages 2 and 4 after the corresponding checks have evidence.

### Stage 5 first increment

- **4 November 2026.** Started from `fe6515f`, the live handoff evidence commit. Defined the [current clip timing rules](04-unified-timeline.md#structured-edit-clip-timing).
- Edit checks whether the source keyframe is visible in the clip and records the source offset and duration with the request. Clip-only Apply changes the selected clip's source identity when a sibling shares it. The review shows clip-local and combined timeline positions and identifies siblings that keep their source.
- The fixture splits at 2.000s, trims the right clip to 2.500s and plays at 2×. The source keyframe at 3.200s maps to 1.200s into the right clip. Verification covers applying the patch to frame 96, preserving the sibling and restoring the source link with one Undo. A unit case covers cut-boundary ownership.
- TypeScript, all 157 Vitest tests and all three structured Edit browser tests passed. The browser test matched the applied clip's canvas at 1.200s to the reviewed source canvas at 3.200s.
- Shared-source Edit now saves the chosen scope with the request. Review lists clips and their visible source ranges. Changed placement impact requires confirmation, and locked or divergent sources block Apply. Shared Apply preserves clip placement and source identity in one undoable change.
- TypeScript and all four structured Edit browser tests passed after adding shared scope. The split fixture verifies that shared Apply updates both clips, preserves their trims and restores both with one Undo.
- The Extend panel shows the source and project handoffs and available source time. Reveal reuses the existing placement edit and requires consent to move later clips. The browser fixture covers source limits, consent invalidation when the duration changes, Apply and Undo.
- Next action is the AI continuation package and result contract, including forking at an interior handoff and reviewing the placement impact before Apply.

### Stage 5 first Generate workflow

- **5 November 2026.** Started after `b1229b7`. The existing Prompt Builder opens **Generate structured scene**, with the current visuals and script as a starting brief and the project's dimensions and frame rate. The first contract supports one built-in Canvas star, native title and editable glow keyframe. Custom modules and reference attachments remain follow-up work.
- Download ZIP saves a project-scoped request and generates its copied prompt from the same brief. The ZIP contains the task, manifest, result schema, output contract and built-in module reference. Paste or upload a JSON result, review the scene, then append it as one undoable clip addition.
- The browser fixture uses a local JSON response to verify request matching, rejection of changed dimensions and the path from Generate to Edit. The live prompt-only Generate handoff has its own remaining verification.
- **Live Generate verified on 5 November 2026.** Claude's first response to request `25ee6305-5191-40b8-bb4f-8d24034f5de7` passed import validation without repair. Applied **New Galaxy** as a new 1037-frame clip at 30 fps. The clip's Edit / Update panel exposed revision 1 and its glow keyframe at source frame 1036 (34.533s). The live Generate handoff is complete for the current built-in star contract.

### Stage 5 AI continuation

- **5 November 2026.** Started from `5091a52`. Extend now opens **Generate continuation** to export a task ZIP with the source, module reference, output schema, source-frame handoff metadata and a PNG evaluated at the exact boundary.
- The first result contract returns only the ending glow for a declared interval. FrameScript derives the starting glow from the existing source, preserves the earlier evaluation and forks the selected clip's source on Apply. This version supports one continuation per source at a frame-aligned handoff.
- Review starts at the source handoff and permits scrubbing through the added interval. Moving following clips requires confirmation. Apply rechecks the saved source and trim and commits the source fork and duration as one undoable change.
- The browser fixture extends a clip ending at source frame 60 through frame 90. It covers wrong-interval rejection, preserved prefix frames, changed continuation frames, timeline movement confirmation and Undo. Live AI Extend verification remains open.
- TypeScript, all 157 Vitest tests and all seven structured workflow browser tests passed. The final targeted continuation rerun also passed after adding explicit seek synchronization before comparing preserved frames.
- **Live Extend verified on 5 November 2026.** Exported request `feb13773-067c-404f-8485-d05ae2e5e696` from New Galaxy and sent the exact ZIP and copied prompt to a fresh Claude chat. Claude reported reading the handoff PNG and returned its first valid extension from source frame 1037 through 1067 with ending glow 0.6. Imported without repair, scrubbed through the continuation, applied, and verified duration 35.56666666666667 seconds. Undo restored 34.56666666666667 seconds and Redo restored the extension. Left the applied continuation open and saved screenshot evidence at `test-results/live-extend-verified.png`.
- Test setup required restarting the local development backend after it returned **Unknown operation** for the newly added endpoint. The restarted server loaded the endpoint and restored the saved workspace.
- Fixed review sizing after the live test. The grid uses shrinking columns and positioned iframes so source dimensions cannot force the modal wider. TypeScript and the continuation browser test passed, including a modal overflow assertion.

### Stage 5 reference and native shape increment

- **5 November 2026.** Committed the verified Extend workflow and review sizing fix as `1030f69`. Added optional image/example-code attachments to Generate and declared native circles/rectangles to the existing scene contract.
- Generate accepts up to six PNG/JPEG/WebP or JS/CSS/HTML/JSON/TXT references, at most 2 MiB per file and a 6 MiB total encoded-data budget equivalent. Files are included in the ZIP under numbered safe paths, with original names, roles and SHA-256 hashes in the manifest. The copied prompt identifies their paths. They guide the AI and are not executed or imported as runtime assets. Adding/removing references invalidates the exported prompt.
- The scene supports up to 20 circles/rectangles, each with base position, size, color and opacity, plus one keyframe per declared x/y/opacity track. Edit / Update selects a declared property and validates the patch against its exact node, property and keyframe. Existing clip/shared scope, timing, revision checks and undo behavior apply.
- Verified TypeScript, all 158 tests across 38 Vitest files and all seven structured workflow browser tests. The Generate browser case packages an image and example code, imports two shapes, edits the circle's x track and undoes both changes. A targeted rerun additionally verifies circle/rectangle preview pixels. Sandbox browser-cache and loopback restrictions required the established host test setup.
- Remaining: live external AI handoff using references and shapes; broader scene/module types and inspector support; reference captures and attachment selection for Edit/Extend; long-scene context budgets and dependency closure. This increment does not complete Requirements 7 or 8.

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
