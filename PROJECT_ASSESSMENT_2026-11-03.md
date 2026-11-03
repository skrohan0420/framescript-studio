# FrameScript Studio assessment — 3 November 2026

**Follow-up:** The nine findings below have since been addressed. Final checks passed: 124 unit tests, 61 production browser tests, build/TypeScript, server checks, encrypted credential restart, rendering and audio/video integration. See [VERIFICATION.md](VERIFICATION.md) for implementation details and remaining limits. The assessment below is the historical pre-fix record.

## Verdict

FrameScript is a substantial, functioning local animation editor. The manual editing path is far beyond a mockup, with real project persistence and real Chromium/FFmpeg output. It still has correctness, accessibility and workflow gaps. I would stabilize those before adding more features. No percentage-complete score is justified without an agreed product scope.

This assessment reviewed the active React/Node application, shared schemas/runtime, storage/export paths, current tests, documentation and desktop/tablet layouts. It did not inspect private credentials or change application behavior. Tests used isolated data directories. Archived desktop backups and every historical provider feature were outside the review. This is broad coverage, not proof that every code path is defect-free.

## What is implemented

- Project home: create, open/import, search, grid/list, rename, duplicate, Trash and restore.
- Monaco HTML/CSS/JavaScript editing, combined-document import, undo/redo, preview error reporting and preservation of the previous valid preview.
- Sandbox preview, deterministic renderFrame seeking, transport controls, canvas sizes, themes and resizable panels.
- Independent timelines, combined preview, visual split/trim, audio selection/move/trim/split, snapping and undo.
- Image import/insertion, audio source library, waveforms, volume/mute/fades/loops, silence editing and transcript/SRT handling.
- Typography templates and editable text layers, plus prompt-building and procedural generated soundtracks.
- Local SQLite workspace/named-project persistence, media deduplication on disk, version conflicts and checkpoint recovery.
- MP4, MKV, WebM, GIF, PNG and ZIP sequence export; real audio mixing; concurrent export scheduling and cancellation.
- Retained AI, storyboard and credential infrastructure. Much of the old AI/storyboard interface is intentionally hidden by the current manual mode; it should not be counted as an exposed end-to-end product workflow.

## Verification from this assessment

- Production build and TypeScript: passed. Vite reports large JavaScript chunks.
- Existing unit suite: **118/118 passed**, across 28 files.
- Production browser suite: **55/57 passed**. Project rename/duplicate flow timed out once; isolated retry passed. Image-import workflow failed in both runs.
- Production HTTP/server suite: passed, including origin/header protections, workspace conflicts, actual exports, concurrent queue and cancellation checks.
- Rendering integration: passed, including gallery execution, timing at multiple speeds, all six formats and cancellation/cleanup.
- Audio/video workflow integration: passed, including embedded assets, master switching, audible mixes at different speeds and mix cancellation.
- Additional audit reproduction: **failed as expected**, confirming the stale audio source defect below. This probe is separate from the 118 existing tests.
- Additional browser probes: confirmed escaped dialog focus, missing Escape dismissal and 980px editor width on a 768px viewport.

## Findings, in recommended repair order

### 1. High — edited narration can play the old recording

**Confirmed with a component reproduction.** `AudioPlayback` caches HTMLAudioElement instances by clip ID and only assigns the source when creating the element (`src/AudioPlayback.tsx:49`). Silence editing replaces a timeline item's data while retaining its ID (`src/save-audio-edit.ts:68`). Consequently, the waveform, trim values and export can use edited audio while browser playback still uses the original file. Undo/redo can encounter the same source mismatch.

The reproduction changed an existing clip's data from source A to B, rerendered AudioPlayback, and found the audio element still pointing to A. Source evidence and probe: `test-results/assessment-audio.test.ts`.

**Fix:** reconcile the node source whenever clip data changes, reset relevant playback/error state and preserve the intended seek position. Verify replacement and undo/redo with a real decoded audio fixture as well as a component check.

### 2. High — permitted media combinations can make the project unsavable

**Code-confirmed size mismatch; large payload not sent to the server in this audit.** The server rejects JSON bodies above 100 MB (`server/index.ts:124`), while project schemas allow many embedded images and audio files. Timeline copies and audioLibrary entries both carry the complete audio data through JSON (`shared/audio-library.ts`). Deduplicating media in SQLite happens after transport and does not reduce request size.

For example, a 15 MB recording becomes roughly 20 MB of base64. One library source plus five timeline instances already exceeds the request cap before other project data. The app permits this structure. Autosave, explicit save and export all submit project JSON. Portable .frame import also has a 100 MB limit (`src/bridge.ts`).

**Fix:** transfer sources once and reference them by ID, or enforce a shared total serialized-size limit before accepting additions. Warn while the user can still recover. Verify save/export/reopen with repeated clips and multiple large assets.

### 3. Medium — a project management test exposed intermittent rename inconsistency

**Observed once; root cause not established.** In the full suite, after renaming a current project the Continue card showed the new title, while the saved-project card still showed the original title. The next Duplicate action could not find the renamed project and timed out. The same test passed in an isolated retry.

Relevant paths: `src/ProjectHome.tsx:499`, `src/App.tsx` autosave effect, `server/index.ts` projectRename/autosave handlers. The result is consistent with a save/list-refresh ordering issue, but that explanation needs a controlled reproduction; it is not proven.

**Fix/investigation:** record rename/autosave/list response ordering and exercise rename immediately after returning Home, including delayed autosave. Ensure workspace and saved-project titles settle to the same value. Do not simply increase the test timeout.

### 4. Medium — image import completes with its controls still hidden

**Confirmed UX issue and repeatable test mismatch.** The Code panel's Assets section starts collapsed (`src/App.tsx:143`). Import adds the asset and reports success but does not open that section or select the asset (`src/App.tsx:719`). The failed test snapshot showed ASSETS 1 while the Asset name control remained absent from the accessible tree.

This does **not** demonstrate that import failed or that image rendering is broken. It shows weak feedback/discoverability and a browser test that assumes the section is expanded. The save/import/MP4 scenario stops before reaching its export assertions.

**Fix:** reveal/select the newly imported asset, or provide an explicit Show imported image action. Update the test to exercise the intended behavior instead of assuming hidden controls are visible (`tests/workspace.spec.ts:72`).

### 5. Medium — Home dialogs lack keyboard modal behavior

**Browser reproduced.** Create project and Rename use custom dialog forms (`src/ProjectHome.tsx:411`, `:493`), unlike the Radix Modal used elsewhere. Escape leaves Create project open, and Shift+Tab from its close button moves focus behind the dialog. Rename also lacks aria-modal.

**Fix:** reuse the existing Modal component to obtain focus containment, Escape handling and focus restoration. Verify both dialogs with keyboard-only navigation.

### 6. Medium — editor does not adapt below 980px

**Browser reproduced.** At a 768×800 viewport, the app and document remain 980px wide. `.app` has min-width:980px (`src/style.css:2346`); the project Home has narrower responsive rules, making the transition into editing unexpectedly overflow.

**Fix:** provide a compact editor layout with collapsible inspectors and a usable minimum player/timeline area. If this is deliberately desktop-only, communicate the supported size before entering the editor. Current layout tests mostly cover desktop/laptop dimensions, not this breakpoint.

### 7. Medium — export files have no visible retention policy

**Code inspection.** Finished exports and generated standalone HTML are written under the export directory and registered in an in-memory downloads map (`server/index.ts:136`, `:508`, `:584`). No completed-file expiry, disk quota or cleanup route was found. Cancelled/partial output cleanup is implemented and tested; this finding concerns successful outputs.

Repeated high-resolution exports can accumulate large local files. Restarting clears in-memory tokens while completed files remain on disk.

**Fix:** define retention and disk-budget rules, offer Clear completed exports, and expire download records consistently with file cleanup. Show retained size before deletion; do not erase user-chosen destination files.

### 8. Medium — volume above 100% differs between preview and export

**Code inspection.** The project schema permits volume up to 2 (`shared/project.ts:73`), and the FFmpeg path applies that gain (`server/audio-export.ts`). Preview clamps HTMLAudioElement volume to 1 (`src/AudioPlayback.tsx:82`); the clip slider also clamps its displayed position while its percentage label can show the larger value (`src/ClipVolume.tsx:83`). Imported/older projects can therefore preview differently from export.

**Fix:** either constrain the entire product to 0–100%, with a deliberate migration, or use Web Audio gain for consistent amplification. Verify a project containing a 150% clip in preview and export.

### 9. Medium — image import is not bound to the originating project

**Code-path risk; navigation race not browser reproduced.** `importFiles` awaits FileReader, then reads the latest global project and appends the asset (`src/App.tsx:730–747`). Switching/opening a project while reading an image can therefore insert it into the replacement project. Unlike some provider operations, this path does not check the project context captured at submission.

**Fix:** capture a project/session identity before reading; reject or explicitly redirect results after a switch. Test with a delayed FileReader and project replacement.

## UI and UX recommendations

- The library/player/inspector/timeline layout is coherent, and the desktop theme is consistent. Preserve that structure.
- Improve first-use guidance: a blank code-driven project needs a visible next action such as Paste HTML, choose an Example, or add Typography. Icon-heavy navigation and subtle status text make discovery harder for a new user.
- Make scene versus combined-film scope prominent in preview and export, especially because the term Timeline represents a sequential scene rather than a general multilayer sequence.
- Import should reveal the imported content; save/export errors should keep the action needed to recover close to the error.
- 4K/60 is the default in the Home creation dialog. Consider 1080p/30 or remember the user's choice; 4K/60 increases render work and is not necessary for every project. No measured performance claim is attached to this recommendation.
- Keep one current user guide. README correctly warns that later AI/storyboard material describes retained implementation, but still contains outdated instructions and limitations, including claims that a draggable multitrack audio editor is absent despite newer editing controls. Historical verification entries must not be treated as today's pass results.

## Maintainability and performance

The shared seeking runtime, typed RPC schemas, revision-aware save handling, isolated tests, recovery checkpoints and lazy Monaco loading are useful foundations. Several concerns from the older November 1 review have already been addressed and are not repeated as current defects.

App.tsx still combines routing, storage, imports, providers, export orchestration and a large amount of UI. Hidden manual-mode branches add maintenance cost. Extract feature hooks/components while preserving behavior. Avoid introducing a new architecture solely to reduce file length.

The current production main JavaScript is 666.48 kB minified / 205.65 kB gzip; the lazy CodeEditor chunk is 3,293.30 kB / 846.43 kB gzip, with a roughly 6 MB TypeScript worker. This is a bundle-size observation, not a measured startup or typing regression. Profile cold loading and a representative media-heavy project before optimizing. Large-project memory, long-session disk growth and low-memory rendering were not stress-tested here.

## Suggested next work

1. Correct audio source reconciliation and establish a saveable project-size contract.
2. Reproduce/fix rename ordering, reveal imported assets, and restore the full browser suite to green.
3. Replace custom Home dialogs, add narrow-screen behavior and align preview/export gain.
4. Add export retention and asynchronous import context checks.
5. Consolidate current documentation and profile larger real projects before adding capabilities.

## Evidence and limits

Audit artifacts: `test-results/assessment-probe.mjs`, `test-results/assessment-audio.test.ts`, `test-results/assessment-desktop.png`, `test-results/assessment-tablet.png`, and the browser failure contexts under `test-results/browser-run/` and `test-results/assessment-rerun/`.

The audio probe was temporarily run from tests/ because Vitest only collects tests/**/*.test.ts, then moved back to ignored test-results/. No production code or existing tests were changed. The supplementary mock proves source reconciliation failure, not audible output quality. Live paid generation, real OAuth consent, every hardware encoder, every browser and assistive technology, full security penetration testing, and exhaustive user acceptance testing remain unverified.
