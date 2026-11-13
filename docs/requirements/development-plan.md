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
- **Stage 5 — In progress.** Edit, Generate and Extend have recorded live built-in star workflows. Generate supports optional references and basic native shapes. Focused Edit/Extend context and package budgets are implemented with automated evidence below; their live comparison remains deferred. Supported shape editing, code continuations and audio enhancement have since expanded the application. Broader modules and release acceptance remain open; see the [13 November status review](../PROJECT_STATUS.md).

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

### Stage 5 reference handoff verification — 9 November 2026

- Tested `f0a01e2` on `codex/structured-ai-edit` in an isolated local workspace. Generate request `8eea6a96-e548-4751-a1e3-30a7fdd25795` exported a synthetic palette PNG and motion example. The copied prompt listed both paths, and every ZIP file matched its manifest hash.
- Imported a locally authored scene response with a native circle and rectangle and applied it as **Orbit Signal**. Exported a **This clip only** Edit request `32cf9991-bc90-434b-a175-573984a9aa0d` for `orbit.x`. Review showed 128 → 280 at source frame 38 (1.267s). Apply reached revision 2, Undo restored revision 1 and x=128, and Redo restored revision 2 and x=280. The rectangle's opacity keyframe stayed at 0.73 throughout. Removed the synthetic changes with Undo to leave the original Generate request ready for import.
- All seven structured Playwright tests passed. Local evidence is under `test-results/live-shapes-evidence/`. The isolated workspace's `exports/` directory holds the original ZIP.
- **Live Generate verified.** Sent the original Generate ZIP and copied prompt to a fresh Claude chat after sign-in. Claude returned a usable JSON code block on its first response, followed by explanatory prose. Imported the code block without changing its contents. It matched the PNG colors `#13D9AE` and `#F5B642` and the example code values for circle x (64 → 128) and rectangle opacity (0.15 → 0.73). Claude rounded the example's half-frame timings to frames 38 and 53 at 30 fps. The contract should specify the rounding rule for future handoffs.
- Applied the Claude-generated **Orbit Signal** scene. Used a local test patch for clip-only Edit request `274a7adc-af5d-43bb-bce3-99ba2a538299` on `orbit-circle.x`. Apply set x=280 at revision 2, Undo restored x=128 at revision 1, and Redo restored x=280 at revision 2. `signal-bar.opacity` stayed at 0.73 throughout. Saved Claude's response and both review screenshots under `test-results/live-shapes-evidence/`.
- **Gap observed.** The Edit package names the required screenshot `glow-1.267s.png` for an x-track edit. The prompt and ZIP agree on the path, but the filename should describe a generic keyframe or the actual target. Production generated-code intake, full builder context, and a scene contract beyond the mandatory built-in star and title remain planned.

### Production handoff decision — 5 November 2026

- **Accepted creator requirement.** All production Generate, Edit / Update and Extend actions export a self-contained ZIP plus matching prompt and accept generated code back. Necessary JSON data/metadata may be included in that generated output; users must not manually assemble a separate JSON response. Generate uses the existing Prompt Builder; Edit and Extend retain contextual panels. See [Requirement 7](07-ai-prompt-package.md#production-workflow-decision--zip-plus-prompt-generated-code-back) and [Requirement 8](08-scene-architecture.md#production-generated-output-contract).
- **Implementation status.** Generate, Edit and Extend export instructions for a data-only JavaScript module and accept it through paste or upload. They validate the embedded JSON without executing the returned code and still accept existing JSON results. Edit screenshot names use `keyframe-` for every property.
- **Live Generate module verified.** Claude returned an `export default` module on the first reply for Orbit Signal request `c2d1b3f6-c894-465e-98ec-3c44ec473a2a`. It matched the image colors and motion values, with keyframes at frames 38 and 53. FrameScript imported the original module and applied it as a new clip. The response and review screenshot are saved under `test-results/live-module-handoff/`.
- **Edit and Extend module coverage.** The browser suite imports Edit and Extend modules, checks the saved scope and frame interval, compares rendered frames on both sides of the Extend handoff, and verifies Undo/Redo.
- **Live Edit and Extend modules verified.** Claude returned valid `export default` modules on its first reply in two fresh chats. Edit request `1281829c-ad9a-4e9b-9178-cab058e43c3e` changed only the Orbit Signal circle x keyframe from 128 to 280. Undo restored 128 and revision 1. Redo restored 280 and revision 2. Rectangle opacity stayed at 0.73. Extend request `9d153abe-4757-4e1d-b249-36e4ca76ad38` used frames 300 through 330 and a final glow of 0.2. Apply, Undo and Redo showed 11s, 10s and 11s. The saved continuation issued identical canvas draw commands for all 300 original frames. Saved both modules and review screenshots under `test-results/live-module-handoff/`.
- **Shapes-only scenes.** Generate can return native circles and rectangles without a star or on-screen label. The timeline name is still required. The browser workflow imports a shapes-only module, edits its circle keyframe, checks PNG export pixels, and undoes the changes. Existing star scenes, including the Orbit Signal continuation, generate the same renderer source byte for byte. Extend can reveal existing source on any structured scene and generates new glow animation on star scenes.
- **Shape inspector.** The Properties tab exposes the active clip's circles and rectangles. Base controls edit position, size, fill and opacity. Existing keyframe controls show source time and edit values within the selected clip range. Commits update canonical scene data and the preview in one Undo step. The default clip scope forks a shared source and the explicit shared scope updates matching unlocked placements.
- **Acceptance follow-up.** Verify all three actions using ZIP plus prompt and generated code containing its required declarations, without separate manual JSON assembly. Include missing/conflicting metadata, unsupported versions, stale results, preview and Undo/Redo cases.

### Visual editor direction — 5 November 2026

- Recorded the creator discussion in the [visual editor plan](visual-editor-plan.md): preview selection, right-panel typed properties, drag/resize/rotate, animation-aware changes, transactional Undo and latest-state AI packaging.
- Requirement 8 owns data and picking/module interfaces; requirements 3 and 4 own interaction UX and timeline behavior; requirement 7 consumes the resulting state. No visual-editor implementation is claimed by this documentation update.
- Proposed sequence: general objects/properties → object list/inspector → preview selection → manipulation → keyframe-aware controls → procedural selection. Record supported scope and verification per increment before marking completion.
- Preserve creative freedom through a broad native vocabulary and procedural modules with declared controls. Validate creative quality alongside contract compliance. Full visual-editor scope requires revising prior effort/line estimates; first-release scope and detailed interaction policies remain open.

### Visual editor preview selection — 9 November 2026

- The selection arrow picks native circles and rectangles in clip and combined previews. Picking uses the canvas coordinates and rendered source time, skips fully transparent shapes and locked clips, and chooses the topmost hit. Selection bounds follow the shape as the playhead moves, and the Properties object picker and preview selection stay in sync.
- TypeScript passed. Four focused Playwright checks passed with host Chromium on an isolated port: scaled and trimmed shape picking, overlap and ellipse geometry, picker synchronization and combined clip switching; the existing shape inspector workflow; and both DOM preview selection/editing checks.
- Shape dragging and resize handles are paused while work continues on AI packaging.

### Stage 5 Edit and Extend package context — 9 November 2026

- Edit and Extend now share Generate's image and example-code attachment picker and ZIP layout. They also accept one optional capture by source frame number within the selected clip. Extend accepts context frames before the handoff. The required keyframe and handoff captures remain part of their respective packages.
- The server renders captures from the packaged revision, records their source frames and revision in the manifest, and hashes each ZIP entry. The copied prompt lists the selected context. Changing an attachment or frame invalidates the old prompt.
- TypeScript, all 12 structured Edit unit tests, and all nine structured workflow browser tests passed. Browser checks verified ZIP paths and prompt agreement, the Edit reference hash and capture metadata, prompt invalidation, and rejection of a handoff frame submitted as optional Extend context through the API.
- Remaining at this checkpoint: focused long-scene context, dependency closure, measured package budgets and outstanding acceptance cases. Requirement 8 still needs broader scene and procedural module contracts.

### Stage 5 focused Extend packaging — 9 November 2026

- Measured actual Extend ZIPs with the 30 fps Fireworks Galaxy fixture and one optional frame 15 frames before handoff. The six-second and nine-minute 640 × 360 versions both used about 79 KB before compression. A nine-minute source with 20 animated shapes and a 60-second selected tail used 202 KB at 1080p and 1.16 MB at 8K. Frame resolution and scene contents mattered more than duration for the supported contract.
- Extend now centers every package on the handoff. The manifest references the single canonical scene file, and the handoff context supplies the starting glow and preserved frame range. The dense fixtures saved about 17 KB of uncompressed data by removing the duplicate source. The required handoff PNG, optional earlier PNG, canonical scene and star module matched the baseline byte for byte in all four fixtures. Every listed entry's size and SHA-256 hash matched the ZIP.
- Set an 8 MiB limit on all uncompressed ZIP entries, including the manifest. The focused 8K fixture used 1,144,361 bytes, leaving room for the existing 6 MiB reference allowance. An oversized request fails with the largest entries listed so the creator can reduce context.
- TypeScript and both focused Extend browser checks passed, including oversized-package rejection, continuation review, and Undo/Redo. The budget is based on package measurements. A live AI comparison of the focused package remains open.
- At this checkpoint, Edit packaging and general procedural dependency closure remained open. Live shape editing remains paused.

### Stage 5 range-focused Edit packaging — 9 November 2026

- Measured four Edit ZIPs at 30 fps with a required keyframe PNG and an optional PNG 15 frames earlier. The six-second and nine-minute 640 × 360 fixtures both used about 79 KB before compression. Nine-minute fixtures with 20 animated shapes and a 60-second selected tail used 186 KB at 1080p and 1.15 MB at 8K.
- Edit now puts the selected clip range, target keyframe, current and requested values, edit scope and capture paths in `context/edit-range.json`. The full scene and its declared star module stay in the ZIP because the track can depend on or affect frames outside the selected range. The focus is on the current clip rather than a separate range selector.
- Edit shares Extend's 8 MiB uncompressed budget and entry size and hash metadata. The new context and metadata added about 1.3 KB per fixture. All four packages retained identical canonical source, module and capture bytes. Verified exact trimmed range and target values and checked every listed entry's size and SHA-256 hash.
- TypeScript and all nine structured workflow browser tests passed. Coverage includes oversized Edit requests, optional capture bounds, and clip-only and shared edits from trimmed clips at double playback speed.
- At this checkpoint, live AI comparisons and acceptance cases remained open, along with a separate Edit range selector and dependency closure for general procedural modules.

### Stage 5 structured handoff acceptance — 10 November 2026

- Deferred the live AI comparison of the focused Edit and Extend packages. Earlier live handoffs verified the JavaScript module workflow before the focused packaging changes.
- TypeScript and three focused browser cases passed. Generate, Edit and Extend reject JavaScript results with unsupported contract versions or missing required metadata. Edit rejects conflicting pasted and uploaded results. Edit and Extend block Apply when their source changes during review.
- The Extend API rejects caller-supplied required capture metadata. It renders required evidence from the packaged revision and rejects optional capture frames outside the selected clip. The separate manual-save scenario with a newer source draft and an older applied preview still needs a focused browser check.

### Workspace render investigation — 10 November 2026

- Reproduced frame drift in timelines 1 and 5 of the five-timeline `ad` project. Their standalone animation loops continued drawing after FrameScript sought or paused. Timeline 3 also restarted its loop on canvas clicks. Timeline 4 registered its own playback keys alongside the editor.
- Created a repaired project copy with the standalone playback code gated when FrameScript owns the clock. Compared the snapshots and confirmed only timeline JavaScript and its selected-clip projection changed. Chromium checks passed on all five timelines for paused frames, clicks, backward seeks and forward motion in the repaired preview and export documents.
- The repaired Timeline 5 sample decoded all 120 frames at 1080p and 60 fps. At 1.5s, it matched the independently rendered still more closely than the latest existing export (SSIM 0.962 versus 0.848). Local evidence is in `test-results/render-investigation/`.
- Re-exported the full 20-second Timeline 5 at 1080p and 60 fps. FFmpeg decoded all 1,200 frames without errors.
- Follow-up in the actual editor UI confirmed that the original Timeline 5 playhead stopped on Pause while its canvas kept changing. With the repaired copy, both stopped. The active saved workspace still contained the original JavaScript at the time of the check.
- At the creator's request, backed up the active `ad` project and applied the five verified script repairs through the local workspace API. Confirmed the repaired scripts were persisted in both the workspace and the named project. An already open editor tab needs a reload to pick up the saved code.

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
- Focused Edit and Extend packages have an implemented 8 MiB uncompressed budget and measured context (9 November evidence above). Complete the deferred live comparison and first-result acceptance before treating the long-scene policy as fully validated.
- Verify the separate manual-save scenario with newer source drafts and older applied previews noted on 10 November.
- Close real-speech/device acceptance for the [voice enhancement foundation](02-voiceover-mastering.md) and retain aligned [stem export](05-audio-stem-export.md) as undelivered scope.

Update the tracker when a stage starts, a blocker appears or clears, or a stage passes its exit checks. Link test evidence and issue records so the next session can resume from the last verified state.
