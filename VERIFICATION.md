# Verification record

## Creative Direction final-package wiring — 14 November 2026

Audited the simplified builder through director export and final Generate ZIP assembly. Fixed the missing selected-direction connection and added explicit approval/change detection. Approved specifications now replace overlapping generic creative planning and text/audio defaults while retaining runtime, timing, rendering, identity and soundtrack contracts. Empty direction preserves direct generation; nonempty unapproved directions block final export. Structured output excludes unsupported audio and UI validation rejects incompatible dimensional modes.

`npm run build` passed (existing bundle-size and dependency annotation warnings). All 29 focused tests across director, prompt-template, prompt-audio and mascot suites passed. `npx playwright test tests/director-export.spec.ts` passed against a fresh dev server: real director/code/structured ZIPs include expected story/identity/direction and reference bytes; final code TASK.md equals preview; structured schema and output contract are retained; editing direction or full-script context invalidates approval; clearing direction restores direct export. An added full-script-change check initially timed out on a label locator; the final run uses the textbox's accessible role/name and passed.

Limits: approval is intentionally not restored across reload, while text remains in the browser-local draft. Project/scene-specific storage, continuation integration, external-model quality, generated animation execution and broad visual/accessibility review remain unverified or pending. Legacy browser tests targeting deliberately removed controls still need reconciliation; no full regression-suite pass is claimed.

## Continuation soundtrack verification — 13 November 2026

Build/TypeScript passed. All seven focused generated-audio and continuation-package unit tests passed. The production continuation browser test passed with inherited music and an imported segment-local SFX manifest: narration retained its placement and trim, music carried from 2s through 5s, the new effect started at 2.5s, and Undo removed the extension and its audio.

Ran `npx tsx tests/continuation-audio-export.ts` after the browser case. It rendered two real MP4s from the browser-saved fixture, isolating music and SFX, then decoded their audio with FFmpeg. Music RMS exceeded 0.001 before, immediately after and late after the handoff. The effect was audible in its expected interval and silent before/after. Evidence: `test-results/continuation-audio/`. This is signal/timing verification, not a subjective listening review or verification of the creator’s existing project. An initial browser attempt during the build failed with an empty server response; the final production run after build completion passed.


## Expanded appearance library — 13 November 2026

Added Plum / Smoke, Burgundy / Ash, Forest / Sage, Slate / Ice, Copper / Ink, Espresso / Cream, Ocean / Fog and Black / White, bringing the library to 15 palettes and 30 dark/light combinations. The picker displays the available count, and its browser regression discovers palettes from the shared catalog rather than assuming seven.

Build/TypeScript and both palette unit checks passed, including 4.5:1 text, primary-action and selected-control contrast across all 30 combinations. Three final production browser cases passed for the full palette matrix, Monaco matching, waveform redraw, preference restoration, Home access, tab scope and narrow layout. An initial development run during a concurrent build failed the saved-preference assertion; the final compiled run passed. The full unit suite was not rerun for this catalog expansion.

## Tabbed settings and Home access — 13 November 2026

Moved the settings UI into a shared StudioSettings component with keyboard-accessible tabs, a fixed title/footer and one scrolling panel. Home and the editor render the same settings/dialog flow. Home exposes Appearance, Editor and Storage; Project, Brand kit and Recovery are disabled until entering the editor. Ctrl+, works on Home and respects existing dialogs. Shortcut and recovery subdialogs return to their originating tab, direct shortcuts close normally, and a successful restore returns to the workspace.

Build/TypeScript and **17 production browser checks passed**, covering appearance persistence, Home settings, tab keyboard navigation, application/project scope, storage status, project and brand saves, recovery/restore, keyboard remapping, manual save/history, project management and actual MP4 download. Desktop and narrow-screen settings screenshots were visually inspected. Fixtures were updated to select the appropriate tab and distinguish the status notice from the timeline's status output.

The broader manual-save check exposed stale code when switching from the diff view to the normal editor. Its modified model now uses the same session/source/language path as the standard editor. The regression verifies actual modified-editor input, switching back, saving, history restoration and autosave recovery. Initial runs failed this path and left manual-save preferences behind; the final isolated and combined runs passed. The full unit suite was not rerun for this settings refactor.

## Saved appearance palettes — 13 November 2026

Final compiled-production checks passed for Appearance, classic theme/contrast behavior and studio layout (**3 browser cases**).

Added a visible top-right Settings label and an Appearance section with seven palette previews, selected states and independent Dark/Light modes. Carbon / Silver is the default for missing/invalid saved palette IDs. Preferences use the existing settingsGet/settingsSet application store; scene code and portable-project data do not carry workspace colors. Palette tokens drive both standard/diff Monaco themes and timeline/library colors. Waveform observers also react to palette changes.

Build/TypeScript passed. Two palette unit checks passed across all seven palettes in both modes, checking valid color tokens, at least 4.5:1 text/action/selection contrast and safe saved-ID fallback. The appearance browser check passed all fourteen combinations with matching Monaco backgrounds, selected states, reload persistence, a visible Settings label and waveform redraw after a palette-only change. The existing classic-theme browser check also passed. Appearance-picker and Carbon / Silver workspace screenshots were visually inspected. An initial browser locator matched settings controls in the toolbar, inspector and footer; scoping it to the toolbar resolved the test ambiguity. The full unit suite was not rerun for this appearance feature.

## Darker black-base palette — 13 November 2026

At the creator's request, darkened outer chrome and the preview stage to opaque #000000, panel bodies/timeline to #1C1C1C, headers to #242424 and editor/input surfaces to #171717. Cyan accents and the light-theme palette remain coordinated. The focused theme browser check passed for exact tokens, Monaco background, text/control contrast, waveform colors, light-theme persistence and compact viewport bounds. This was a color-only follow-up; the earlier reference-palette entry preserves the original sampled values.

## Reference charcoal/cyan palette — 13 November 2026

Sampled the creator's reference image for the main chrome (#1C1C1C), panel body (#262626), panel header (#303030) and accent (#00C1CD). Updated semantic dark/light tokens, matching Monaco backgrounds/cursors/selections, timeline colors and library waveforms. Dark text clips use rust and visual clips use teal; generated scene artwork retains its own styles.

Build/TypeScript passed. Focused theme and layout browser checks passed in development mode, including exact palette tokens, Monaco's dark background, text/button/active-tab contrast of at least 4.5:1, expected waveform canvas colors in both themes, light-mode persistence, and 1280px layout bounds. The first contrast check exposed an insufficient light accent ratio; darkening that cyan resolved it. The layout fixture still assumed audio import automatically placed a timeline instance; it now explicitly uses the existing Add to timeline action before checking the inspector. Dark/light and workspace screenshots were visually inspected. The full unit suite was not rerun for this palette-only change.

## Independent canvas ratio and 4K resolution — 13 November 2026

Replaced the toolbar dropdown that mixed a pixel-size entry with fixed HD ratios. Separate Ratio and Resolution controls now recognize aspect independently of dimensions, expose 720p/1080p/2K/4K with exact pixels, and preserve the chosen tier through ratio changes. Landscape and portrait 4K match the existing editor bounds; ultrawide 4K fits within 3840×2160 (3840×1646).

Build/TypeScript passed. Six focused unit cases across three files passed for canvas sizing, media bounds and export presets. Three production browser checks passed: existing ratio/preview sizing plus landscape/portrait/ultrawide 4K and export-default agreement; media dimension/image insertion behavior; and existing export defaults. The 4K toolbar/inspector screenshot was visually inspected. No real 4K video render or broad unit/browser rerun is claimed by this UI check.

## Stem download recovery and clearer export UI — 13 November 2026

The checkbox is now a larger labeled option with contents, format and an Included/Optional state. Its value persists in browser storage. Paired exports keep the dialog open and replace disabled settings with a compact file list, separate progress/errors and direct native download anchors. The floating export panel also labels the audio ZIP download.

Build/TypeScript and all **six focused production browser checks** passed (stem delivery, four export-setting cases and concurrent exports). The stem case renders a real MP4 and real ZIP, suppresses the automatic ZIP anchor click, retrieves and validates the ZIP through the visible user-click download link, verifies the master/sample manifest, and confirms the checkbox remains checked after reload. Screenshots of the option and compact result dialog were visually reviewed. Duplicate primary-error announcements found during regression testing were removed; the existing export failure/retry check passes. The full unit suite was not rerun for this UI follow-up; the earlier 187-test result retains its recorded scope.

## Separate stem download checkbox — 13 November 2026

Replaced the user-facing stem format and its dedicated settings screen with **Download audio stems separately (ZIP)**, off by default. The selected video/image format exports normally; checking the box starts a separate processed-stem job from the same snapshot with an included master and an `-audio-stems.zip` filename. The video save picker applies to the video; the ZIP uses the browser download location. Both jobs retain their own dock status and cancellation controls.

Build/TypeScript passed. The revised browser case passed with a stubbed primary-video response and a real stem worker/ZIP download, verifying the default-off checkbox, absence of a stem format option, preserved MP4 submission, processed master contents, speed and aligned sample count. Four existing export-settings browser checks also passed. Renderer-level dry/processed support remains covered by the previous PCM tests. This UI follow-up did not rerun the full unit suite.

## Aligned audio stem export — 13 November 2026

Implemented against documentation baseline `9fe9071`; the changes remain in the working tree.

- `npm run build`: passed, including TypeScript and bundled server/worker. Existing large-chunk and dependency annotation warnings remain.
- `npm test -- --reporter=dot` with host access: **187 tests passed across 43 files**. Eight stem checks exercise real FFmpeg output, 24-bit stereo sample counts, empty lanes, submillisecond and minute-long placement, speed changes, trims/loops/fades, dry/enhanced source selection, processed music ducking, shared headroom, master summation and cancellation/failure cleanup. Retention covers completed stem ZIPs.
- Production browser checks: the real stem export and four existing export-settings cases passed. The stem case uses the editor, actual queue/worker/FFmpeg and owned ZIP download; it checks dry mode, omitted master, speed and manifest sample count.
- Development browser checks: audio enhancement and the real stem workflow both passed. The enhancement test dynamically imports a source module and therefore requires the development server; its initial production invocation failed for that test-harness reason.
- `npm run test:workflow`: passed, including combined-scene switching/assets, audible MP4 mixes at 0.5×/2×, WebM/MKV mixes and audio cancellation cleanup.
- Initial sandboxed unit checks passed 168 and failed 17 because loopback fixture connections were denied and sandbox Chromium was unavailable. All passed with host access. An initial browser assertion expected a filename without the existing timeline suffix; the final test explicitly supplies a filename and passes.
- The stem dialog screenshot was visually inspected. `git diff --check` passed. Broad unrelated browser suites, live provider checks and manual NLE/DAW import were not rerun or claimed complete.

## Documentation alignment review — 13 November 2026

Reviewed source commit `a1f6763` and updated documentation only. Current scope is summarized in [project status](docs/PROJECT_STATUS.md). Earlier entries below retain their original dates, counts and scope; they are historical evidence rather than a fresh full-project test run.

- `npm test -- --reporter=dot`: **179 tests passed across 42 files**.
- `npm run build`: **passed**, including TypeScript, Vite and server build. Vite reported large chunks and removed misplaced dependency PURE annotations; these warnings did not fail the build.
- `git diff --check`: passed for the documentation changes.
- Browser suites, server/credential checks, rendering integrations, export benchmarks and live AI handoffs were **not rerun** for this documentation-only review. No new claims of full end-to-end acceptance or real-speech listening quality are made.

## Persistent rulers and clean preview boundary — November 3, 2026

The Rulers toggle now lives with zoom controls in the bottom playback bar, including fullscreen transport. Slimmer measuring bars retain a passive px origin cell. The browser remembers ruler visibility across reloads. When rulers are off, the editor's canvas border is removed as well, leaving a clean preview without the top/left boundary outline. These controls do not affect exported scene content.

Build/TypeScript and eight production browser checks passed. Regression coverage explicitly toggles rulers off/on across reloads, checks the absent canvas border, verifies bottom-bar placement and retains fullscreen, text editing, media sizing and layout checks.

## Preview ruler refinement — November 3, 2026

Refined preview rulers with a shared px corner, quieter surfaces, major/minor ticks, horizontal vertical-axis labels, safer endpoint-label spacing and enough frame-fit padding for the measuring chrome. Build/TypeScript and seven production browser checks passed for preview/fullscreen controls, text editing/snapping, media sizing and studio layout. Reviewed test-results/media-dimensions.png.

## Prompt drawer minimum width — November 3, 2026

Raised the resize minimum from 360px to 560px, including normalization of previously saved narrower widths. Smaller screens still cap the drawer to available workspace width; compact template cards switch to two columns and wrap text there. Build/TypeScript and all three production drawer checks passed, covering old-width migration, minimum clamping, a 390px viewport, persistence, dragging, animation and responsive content.

## Resizable sliding prompt drawer and compact actions — November 3, 2026

Added a draggable left edge with pointer capture, keyboard resizing, width persistence, viewport bounds and double-click reset to 820px. Left/Right adjust width, Shift increases the step, and Home/End choose minimum/maximum width. The drawer enters from the right and slides out on close while remaining noninteractive during exit. Reduced-motion preferences remove visible motion.

Container queries now adapt navigation and preset grids to the drawer's own width, from one card column at narrow widths to four at full desktop width. Wide layouts use larger readable detail text and centered content capped at 1440px rather than stretching every field across the screen. The footer is a compact row with duration/format on the left and normal-sized Copy/Paste buttons on the right.

Build/TypeScript and all eleven focused production prompt-browser checks passed. New tests exercise real mouse dragging, keyboard resizing, close/reopen and reload persistence, viewport shrink/restore, double-click reset, entry/exit state, one/two/four-column adaptation, full-width navigation, content bounds, readable wide text, and footer/button dimensions. Screenshots visually reviewed: test-results/prompt-drawer-wide.png and test-results/prompt-drawer-narrow.png. Existing reference, pacing, tooltip, text, mascot, narration and soundtrack prompt flows remain green.

## Expanded looks, compact browsing and wider prompt builder — November 3, 2026

Added 16 reference looks (28 total), each with original visual direction and an example: natural history, microscopic science, space documentary, engineering cutaway, architectural model, whiteboard, paper sculpture, watercolor storybook, cel animation, clay miniature, pixel world, vintage travel poster, comic diagram, monochrome line study, digital product interface and neon technical display.

Reference and pacing studios now provide category chips with counts, combined category/text filtering, result counts and filter reset. Compact two-column cards show concise descriptions; the selected-direction panel contains complete explanations and examples. Selection remains intact when filters change. Lists remain scrollable and preserve full card height. The prompt builder is widened from 540px to 820px, capped at the workspace width on smaller screens.

Validation: build/TypeScript and 133 unit tests passed; all nine focused production prompt browser checks passed. Expanded checks cover all 28 references and examples, category/search combinations, preserved selection, prompt content/persistence, and card geometry plus exact drawer width/bounds at 1600, 1280 and 768 pixels. Screenshot reviewed: test-results/reference-browsing-improved.png. An initial new test targeted both visible and hidden selected-direction panels; its locator was corrected to the active tabpanel before the clean final run.

## Preset-card overlap fix — November 3, 2026

The unfiltered preset list allowed flexbox to shrink cards to button height inside the bounded scroll area, making their text overlap. Cards and their content now retain intrinsic height, wrap within available width, and scroll without shrinking. Earlier filtered-list checks missed this full-list condition.

Build/TypeScript and five focused production browser checks passed. A geometry regression checks every unfiltered reference and pacing card at widths 1600, 1280 and 768: content stays inside its card, adjacent cards do not overlap, lists scroll, and the last option remains reachable. Reviewed screenshot: test-results/prompt-cards-fixed-reference.png. Existing selection, search, persistence, generated-prompt, narration and soundtrack checks pass.

## Separate visual-reference and editorial direction studios — November 3, 2026

Moved Reference-inspired look and Editing & pacing out of the combined Look & edit panel into independent labeled tabs. The previous panel is now Visuals. Navigation shows text labels with distinct section icons and retains arrow/Home/End keyboard behavior. Both new studios have searchable preset cards, clear selection state, a selected-direction summary, full explanations, concrete example treatments, default/reset choices and empty-search recovery. Preset lists have bounded scrolling so tuning controls remain reachable.

Reference look adds influence strength and custom visual direction. Editing & pacing adds pacing energy, explicit transition preference and custom editorial direction. Prompt instructions preserve facts, mascot identity and narration timing; explicit transition choices override conflicting preset suggestions. User choices persist independently, existing stored preset strings remain supported, and UI examples do not become narration or scene subjects.

Validation: build/TypeScript passed; all 133 unit tests in 33 files passed; seven focused production browser checks passed. New checks cover section separation, searchable preset selection, fine-tuning values in generated prompts, reload persistence, clearing a reference without clearing pacing, and empty-search recovery. Existing prompt copy, timed narration, template tooltip, mascot, typography and procedural-soundtrack flows pass. Both section screenshots were visually reviewed: test-results/prompt-reference-studio.png and test-results/prompt-pacing-studio.png. No live model calls were made.

## Expanded prompt templates and delayed examples — November 3, 2026

Expanded the six animation templates to fourteen with Data visualization, Process / flow diagram, Product showcase, Isometric scene, Particles / simulation, Map / route animation, Comparison / split screen and Seamless loop. Each supplies distinct generation/craft directions plus a short description and concrete example. Templates do not enable text or modify the active scene by themselves.

Template hover and keyboard focus reveal a portal tooltip after 500 ms, avoiding native duplicate title tooltips and panel clipping. Leaving, blurring, selecting, scrolling or resizing dismisses it. Escape dismisses a visible tooltip without also closing the prompt builder. Screenshot reviewed: test-results/template-hover-example.png.

Validation: build/TypeScript passed; all 132 unit tests in 33 files passed; six focused production browser tests passed. New coverage verifies all template metadata/craft directions, absence at 300 ms and appearance after the delay, example content, keyboard focus/dismissal, selection and generated prompt direction. Existing mascot, typography, narration and soundtrack prompt workflows remain green. No live LLM generation was performed.

## Optional prompt mascot — November 3, 2026

Added a dedicated Mascot prompt tab with explicit enablement, identity constraints, role, actions/expressions, placement, scale, timing and additional direction. No image uploader is required or presented: prompt instructions refer to reference images the user attaches directly to their LLM chat. If absent, the LLM should request the attachment rather than invent a character. Generated output must recreate the mascot as self-contained artwork rather than depend on inaccessible attachment URLs or files. Mascot preferences persist, are excluded while disabled, and do not enable typography. Navigation supports the added seventh tab and keyboard selection.

Validation: build/TypeScript passed, all 131 unit tests in 33 files passed, and five focused production browser checks passed. Coverage includes mascot opt-in/out, no reference-upload dependency, saved settings/reload, typography independence, and existing prompt/counter/timed-narration/soundtrack flows. No live model generation or reference fidelity was tested.

## Optional prompt typography and independent video text — November 3, 2026

Typography is now explicitly opt-in. When disabled, legacy titles/subtitles and all saved text styles/items are omitted from the generated prompt. Merely selecting a text-oriented template does not enable text. Enabled but empty configurations also omit the typography specification. Older drafts retain their choices while leaving the new switch off.

Added schema-validated, independently editable text items (maximum 30) for 15 video-text categories, including subject-following labels, annotation/callouts, counters, statistics, lower thirds, captions, timers, lists and credits, plus a Custom text option. Items carry their own content, subject, timing, position, font, colors, readability treatment, spacing, width and motion. Counter settings carry numerical endpoints, decimal precision, prefix/suffix and deterministic time-based interpolation instructions. Each item overrides shared defaults only for itself. Layout/value previews are separate from generated tracking/motion; the UI says so explicitly. Invalid required copy/subjects or scene timing produces an error and disables copying instead of crashing the prompt panel. Disabled items remain editable and persisted but are omitted from the prompt.

Validation: production build/TypeScript passed; all **128 unit tests in 32 files** passed. Four focused production browser checks passed, covering generated soundtrack import, timed narration, legacy prompt editing/copy/persistence with explicit text enablement, and independent label/counter editing, validation, disable/re-enable and reload persistence. New prompt tests verify that stored text/style choices cannot leak into disabled output, empty opt-in stays text-free, per-item values are independent and every category validates. No live AI request was made; actual model compliance with styling/tracking instructions is not guaranteed by these tests.

## Assessment fixes — November 3, 2026

Addressed the nine findings from PROJECT_ASSESSMENT_2026-11-03.md:

- Playback reconciles audio source replacements while preserving the clip identity; undo restores the correct source. Web Audio gain supports 0–200% consistently with the exported gain, and both row/clip sliders expose this range.
- A shared serialized-size calculation prevents edits/imports above a 90 MB project budget before they can create requests over the server's 100 MB cap. Repeated timeline/library data counts separately. Rejected additions preserve state and undo history; legacy oversized database workspaces remain openable and can be reduced.
- Current-project rename flushes the new name before the rename request. Project-list reads follow the write queue, and the database commits saved/workspace names in one transaction without discarding workspace edits.
- Image import reveals the asset controls and selects the imported image. A session identity rejects FileReader results after project replacement.
- Home Create/Rename dialogs use Radix focus containment and Escape handling, with explicit return focus. Create defaults to 1080p/30 fps.
- Below 980px, the editor fits the viewport and a toolbar switch shares the side column between library and inspector. The 768×800 layout was visually reviewed; screenshot: test-results/assessment-fixed-tablet.png.
- Completed managed render copies expire after seven days at startup/hourly. Settings can inspect retained size and clear completed copies. Active rendering/download files are protected, removed download tokens are invalidated, and user-chosen destination files are untouched.
- README now documents current limits, responsive behavior, gain and retention, and removes the outdated claim that draggable audio editing is absent.

Final validation against the completed build:

- npm run build: passed TypeScript, Vite and server/worker compilation.
- npm test: **124 passed in 31 files**.
- FRAMESCRIPT_TEST_PRODUCTION=1 npm run test:e2e: **61 passed**, including the previously failing Home project-management and image-import-to-MP4 flows.
- npm run test:server: passed, including actual exports, queue/cancellation, cleanup/storage inspection and download-token invalidation.
- npm run test:integration: passed all six formats, seek timing, gallery execution and cancellation/cleanup.
- npm run test:workflow: passed actual audible MP4/MKV/WebM mixes, speed changes, scene/assets composition and cancellation.
- npm run test:credentials: passed encrypted credential persistence across actual server restarts and durable forgetting using fake credentials.
- git diff --check: passed.

The original stale-source audit probe is now a permanent regression test. New tests also cover 150% preview gain, size accounting/rejection, retention protection, atomic rename persistence, dialog keyboard behavior, tablet layout, delayed FileReader/project switching and delayed-autosave rename/reload. Tests use isolated data; the live workspace and private credentials were not modified. An initial new-dialog test exposed Radix's generated accessible name overriding the former label; the label was corrected before the final clean run.

The existing Vite large-chunk warning remains. Broad architecture refactoring, exhaustive mobile/device validation, live paid-provider generation, and resource stress benchmarks are outside these bug fixes. Restart a running backend and refresh the browser to load the completed changes.

## Compact draggable export panel — November 2, 2026

Reduced the floating panel to 320px with compact filename/action rows, a single timeline/status line and 3px progress bars. Filenames restore details; icon controls retain accessible labels/tooltips, and frame counts move to progress-bar tooltips. The header supports pointer dragging and arrow-key movement (Shift for larger steps), remembers position within the browser tab, and clamps against viewport/panel resizing. Build/TypeScript and three focused production browser checks passed, including concurrent progress, download/cancel/restore, compact dimensions, dragging and window-size bounds. Screenshot: test-results/multiple-exports.png.

## Concurrent timeline exports — November 2, 2026

Replaced the single-export browser lock with individually identified export jobs. Select a timeline, render it, minimize, then select another timeline and start another export. The floating box lists all submitted clips with their timeline label, filename, resolution/frame rate, individual progress, queued/rendering/completed/cancelled/failed state and separate restore/cancel controls. Completed rows retain a manual Download action and can be dismissed. Opening Export from the toolbar or the floating plus button starts a new form for the current timeline; restoring a job shows its original settings. Each request retains its own submitted project snapshot and save-file handle.

The local server schedules at most two exports concurrently across sessions. Further jobs wait FIFO, with up to ten active/queued jobs per browser. Progress events carry job IDs, reconnecting streams replay every pending job, and cancellation is scoped to the caller's job map. Queued and early-upload cancellation are handled without cancelling unrelated clips. Old calls without IDs remain supported. Queue/history state is in memory, so reload/restart recovery remains outside this change.

Validation: build/TypeScript, 104 unit tests and all 52 production browser checks passed. Real HTTP tests launch two concurrent exports and a third queued export, cancel one running and one queued job independently, verify a second browser cannot cancel the remaining clip, verify its separate MP4 download, reject duplicate active IDs, check early cancellation, and confirm partial-file cleanup. The browser test submits three independent timeline sources and verifies separate progress, queued status, cancellation, retained snapshots and two separate downloads. Screenshot: test-results/multiple-exports.png. The local saved database was backed up before restarting the backend; refresh the app to load the new workflow.

## Background export and startup recovery — November 2, 2026

Export can now be minimized with the minus icon beside Close. Rendering continues with a bottom-right floating card showing filename, stage, percentage/frame counts, restore and cancel actions. The card remains available on Project home. Reopening Export retains the active job/options; editing does not change the submitted render. Successful completion still downloads the file and leaves other editing dialogs open. Background errors remain visible until dismissed.

Investigated the reported 0% stall through the live backend: a short export failed at browser launch with a missing-executable report even though a fresh Chromium process launched successfully. Backed up the saved database, restarted the stale backend, and successfully exported a short 4K/60 sample of the saved project with audio. Browser startup now has its own progress stage; missing-browser errors include repair instructions, appear inside the export dialog, and clear stale progress. Completed/failed server jobs no longer retain old progress for reconnecting event streams.

Validation: production build/TypeScript and all 102 unit tests passed. Nine distinct focused browser checks passed, including minimize/live progress, settings preservation, continued editing, download completion, home restore/cancel, inline errors/retry and existing MP4 export workflows. Evidence: test-results/background-export.png and export-header-controls.png. Background progress survives minimizing and app navigation; closing or reloading the browser tab is not a resumable export workflow.

## Faster 4K video export — November 2, 2026

Opaque MP4/MKV/WebM exports now default to maximum-quality (100) JPEG frame capture. Export → Rendering offers Lossless frame capture to retain PNG intermediates. Transparent video, quality-zero output, GIF, PNG and PNG sequence exports stay on PNG. Output dimensions, frame timestamps, frame count, hardware encoder selection, audio mixing and verification are preserved. JPEG adds a lossy intermediate; this is disclosed beside the setting.

Same-machine one-second 3840×2160/60 fps synthetic canvas benchmark: lossless capture 14.54 seconds, faster default 8.16 seconds (43.9% less wall time, 1.78× throughput). Both outputs decode to 60 frames at 4K/60; FFmpeg SSIM comparison scored 0.998858. This is a synthetic-scene result, not a guarantee for every project. Four workers measured 14.84 seconds with PNG and 8.13 seconds with JPEG, so the default remains two at 4K. Evidence: test-results/export-benchmark/lossless-workers2.json, faster-default.json and capture-quality.txt.

Validation: build/TypeScript, all 101 unit tests, six focused production browser checks, all-format rendering integration and audio/video workflow integration passed. New checks cover capture-mode safeguards, per-frame pixel-error bounds and frame order, transparent pixels even when JPEG is requested, cancellation cleanup, UI selection and transparency override. Restart the local backend and refresh the browser to load the new export option.

# Current verification — November 2, 2026

Production build and TypeScript passed. All 99 unit tests in 24 files and all 48 active production browser tests passed. Server HTTP/security/storage checks, credential restart/forgetting checks, all six rendering formats, cancellation/cleanup and audible audio/video workflow exports passed locally. The browser suite includes a real MP4 download and manual code/name persistence with preservation of imported narration.

Updated active tests for the manual editor: settings labels, audio library picker/drop/error feedback, direct preview, code-first startup, timeline selection, custom export settings and time-based zoom geometry. Historical AI/Services/storyboard UI scenarios are preserved as tests/*.legacy.ts outside Playwright discovery; see tests/README.md. They are not claimed as passing UI coverage. Provider logic retains unit/integration coverage; no live paid provider or account authorization was tested. The existing large-bundle warning remains.

The entries below are historical records and may describe interfaces or credential behavior superseded by later changes.

---

# Local web-app verification — November 1, 2026

## Library/player/inspector layout

Inspected the user's open CapCut desktop editor through the Windows computer-use skill: media and audio libraries, selection-dependent audio and visual inspector tabs, and ruler seeking. Only selection/navigation was exercised; no clip edits, uploads or exports were performed in CapCut. Applied the interaction pattern to FrameScript with a persistent left library, central player with transport, contextual right inspector and a full-width bottom timeline. Media thumbnails, audio waveforms, scene filmstrips, waveform move/trim, a track-wide playhead and actual horizontal zoom remain tied to real project state. Script, scene, component and audio tools can run inside the left panel; Code is an explicit lazy-loaded tab. Existing Storyboard dialogs remain available. Restored storyboards open in master preview, and clip selection is separate from seeking.

Production build and TypeScript passed; 68 unit tests and all 26 production browser checks passed. The new layout check verifies geometry at 1600×1000 and 1280×800, contextual audio/media inspection, audio volume edits, stable playhead during selection, sidebar script tools without a modal, library audio-file import with real decoding, image insertion through player drop, timeline zoom, and deferred Monaco loading. Existing audio-first scene composition, narration, SFX/music and real MP4 export checks passed alongside save/recovery and mocked provider flows. No live paid generation was performed. Main application chunk: 475.91 kB minified / 147.21 kB gzip; editor remains separate.

Screenshots: test-results/studio-layout.png and test-results/studio-layout-laptop.png. The layout uses existing supported features; it does not add CapCut's general video layers, arbitrary keyframes, transitions, voice enhancement or other unsupported processing controls. Refresh the app to load the new layout.


## Audio-first production workflow

Tested the requested order: full script → narration response → actual browser audio decode → scene composition using decoded duration → visual generation → SFX/music → master export. Fixed the scene-first dependency by adding full-script Voice scope and a Generate narration first action. Full-script takes remain one master voice track. Scene composition matches their playable length; replacement narration can retime existing scene source without replacing visuals. Individual scene takes automatically fit their scene duration. New takes mute older voices in the relevant scope, visual AI edits preserve narration timing, and stale audio responses/imports are rejected when project context changes. Sound effects start at the selected scene playhead rather than always zero.

Build and TypeScript passed. All 68 unit tests and all 24 production browser workflows passed. The audio-first browser check generated an 8-second synthetic provider fixture, decoded its real duration, fitted two scenes to 8 seconds, applied a mocked visual response attempting to shorten timing, added an effect at 0.4 seconds and looping music, and downloaded a real 320×180/10 FPS MP4. FFmpeg decoding confirmed approximately 8 seconds of nonzero PCM audio. A second browser check replaced a full narration take, retimed existing visuals while preserving SFX, and verified a provider error leaves the active narration intact. Existing real audio/video workflow checks also passed for master scene switching, embedded assets, audible mixes at different speeds and mixing cancellation.

Evidence: test-results/audio-first-master.mp4 and test-results/audio-first-workflow.png. Provider responses are fixtures: no live speech generation, voice quality or billable provider access was tested. Timing allocation matches total length but does not detect spoken-word timestamps; scene cuts still need listening/review. No providers or credentials were changed.


## Project-review improvements

Final local checks passed: TypeScript, the production build, 62 unit tests in 12 files, and all 22 browser workflows against the production build. Server checks passed, including two concurrent requests with the same workspace version yielding one success and one conflict. All-format rendering integration passed, including verification-stage cancellation and partial-file cleanup. Audio/video workflow checks passed for master scene switching, embedded assets, audible MP4 mixes at 0.5× and 2×, WebM/MKV mixes and audio cancellation. Unit checks additionally cover running subprocess cancellation/timeouts and cancellation during actual ZIP packaging.

New regression coverage verifies revision-aware Save, preservation of newer edits during a delayed request, recovery after project replacement, stale editing tabs, bounded recovery history, atomic rollback after a simulated failed disk write, restoration from a corrupt primary database while preserving it, malformed legacy-file migration, source/media structural sharing in a 30-scene project, zero editing-hook rerenders for 100 playback ticks, audio move/trim controls, portable brand-kit persistence, optional AI Apply/Discard, and leaving Monaco unloaded during Production startup until Code is opened. A strengthened reload check waits for both project name and narration to persist; it also passed four consecutive focused runs. New browser UI fixtures isolate their layout settings, and each browser run uses a unique data directory.

Build measurements: main JavaScript chunk decreased from 3,835.56 kB (1,011.40 kB gzip) to 451.83 kB (140.22 kB gzip). Monaco is a separate on-demand chunk of 3,293.30 kB (846.42 kB gzip), retaining standard editing features and HTML/CSS/JS highlighting. The large-editor warning remains; these are bundle measurements, not a claimed end-to-end startup or FPS benchmark. Screenshot: test-results/production-improvements.png.

Added GitHub Actions configuration for Node 22 build/unit checks and a separate production browser/media job. The workflow has not been executed on GitHub in this session. No live paid-provider generation was performed. Existing application edits and personal data were preserved. Restart the local Node process to load backend changes.


## Direct scene editing

Scene navigation now stays visible outside the collapsible code panel. Edit this scene reveals code and the assistant, selects the scene and resets its preview. Selected-scene narration, visual direction and duration are directly editable above the preview, with one-click Voice/SFX/Images workflow shortcuts. Preview rebuilds now depend on rendered source/settings/assets instead of every project revision, avoiding reloads for narration-only edits. Four focused browser checks passed for scene switching, editing with collapsed code, separate audio tabs and the new direct controls. The new check counts iframe navigations to verify narration edits do not reload preview. TypeScript and production build passed; these changes require no backend restart.

## Protected connection persistence

47 unit/provider/auth tests passed, including actual Windows DPAPI encryption/decryption, absence of plaintext test secrets in the credential file, token restoration, refresh-token rotation persistence and sign-out removal. `npm run test:credentials` launches a production server with an isolated data directory, saves a fake remembered key, stops/restarts Node, verifies cookie/credential restoration and confirms forgetting survives another restart. No live paid provider requests are made by this check. Production HTTP checks also passed for session-only credentials, storage and exports.

The service browser workflows passed for sign-in, remember-option submission and forgetting. Full regression identified an unrelated autosave notice overwriting the scene-edit notice; save status now has a separate indicator. Remembered credentials are Windows-account protected, not portable secrets: changing Windows users or losing browser cookies requires reconnecting. Existing memory-only credentials from before the upgrade cannot be recovered after restarting the old server.

## SQLite persistence

45 unit/provider/auth tests and 15 browser workflows passed after adding SQLite. Database tests close/reopen the actual SQLite file and verify scenes, embedded-media reconstruction, preferences, chat records, deduplicated media, legacy migration and trash persistence. The reload browser test edits a project and narration, waits for the stored workspace, reloads the page and verifies automatic restoration. Startup now blocks editing until storage hydration completes. Existing export/storage HTTP checks passed against SQLite. The build and TypeScript checks passed. Credentials, undo stacks and active generation remain session-only; backups require the database and media folder together. No separate SQLite service is needed.

## Connection-flow audit

Fixed stale ChatGPT account status when Services opens while another AI provider is selected. Gemini image model discovery now follows all catalog pages with repeated-token detection. ElevenLabs uses the current `/v2/voices` API and paginates/deduplicates voices. Speech-model selection falls back to a model actually returned by the account catalog. Empty voice/model catalogs and unreachable Ollama have actionable errors. Connection checks explicitly distinguish catalog access from a generation test.

The production build, 43 unit/provider/auth tests, twelve development browser workflows and production HTTP checks passed. Browser workflows include simulated narration/SFX generation, returned-audio decoding and waveform creation, Gemini reference upload/model selection/variant insertion, ChatGPT OAuth UI, key removal and service status while Ollama remains selected. Provider tests cover paginated catalogs, malformed pagination, key redaction and subscription read permissions. These automated tests simulate remote provider responses; live credentials are still required to prove account access. The real ChatGPT authorization page opened successfully during the audit; user account selection/consent remains a separate live step. A real local Ollama check confirmed that port 11434 was unreachable at audit time.

## Central service management

Build, 36 unit/provider/auth tests, ten development browser workflows, and production HTTP checks passed after the Services update. New tests cover ElevenLabs subscription balance/reset fields, restricted-key usage-read failures, sanitized invalid-key errors, no alternate-provider fallback, six service cards, secondary key entry, key removal, unknown balances, and returning to the audio workflow. ChatGPT sign-in/generation/sign-out now runs through Services. Status API tests verify credential source and omission of key values. Screenshot: `test-results/services.png`. No live paid generation was performed; quota tests use provider fixtures.

Provider status is checked on demand and timestamped, not a guarantee of future availability. ElevenLabs balance is invalidated by media generation until refreshed. Other integrations do not expose account balances here; their links open the provider dashboard. Environment credentials are distinguished from session keys and cannot be removed by a browser-session action.

## Storyboard, audio and mascot workflow

- Production build passed. 32 unit/provider/auth tests and nine development browser workflows passed. Two new workflow tests also passed against the production build.
- Browser checks exercise script splitting, independent scene components and source switching, full-sequence scrubbing, project download/reopen, decoded narration import and waveform, fit-to-take timing, mascot reference import and insertion. Screenshots: `test-results/storyboard-master.png` and `test-results/workflow-audio.png`.
- `npm run test:workflow` verifies actual nested-scene switching, embedded SVG resolution in master composition, audible MP4 mixes at 0.5× and 2×, audible WebM/MKV output, expected output durations, and cancellation during audio mixing with partial-file cleanup. Artifacts: `test-results/workflow-export/`.
- Existing all-format export integration checks passed: MP4 speed metadata, MKV, WebM, GIF, PNG sequence, PNG, gallery rendering and cancellation. Production HTTP checks passed for storage, export, cancellation and media credential/status responses.
- Provider tests simulate official Gemini reference-image and Eleven v4 requests; AI planner tests verify its separate schema, narration preservation and omission of audio bytes/other scene source. No live paid media generation was performed. Google Flow is a manual handoff, with no automatic account/API connection.
- Scope: hard cuts, local reusable layouts and basic audio clip controls. No transition blending, word-aligned captions, full keyframe editor, or draggable multitrack audio arrangement. Exported HTML/GIF/PNG outputs are silent; managed audio mixes into MP4/MKV/WebM only. Imported/generated mascot identity remains subject to visual review.

Earlier entries below describe historical checks before this workflow update.

Progress UI follow-up: added an in-chat generation card with actual stage/count/elapsed information, indeterminate activity, and cancellation. Connected ChatGPT account details collapse by default into a compact summary. Browser checks passed for streamed progress display, no fabricated percentage, cancellation, compact account height, expansion, and the sign-in/generation/sign-out workflow. Screenshot: `test-results/chat-progress.png`. These are frontend-only changes and do not require restarting the authenticated server.

Generation-wait follow-up: the stream reader now returns immediately at `response.completed` and cancels the transport rather than waiting for EOF. A regression test uses a stream that deliberately remains open after completion; 23 unit/auth/provider tests pass. The UI receives actual generation stages and output-character counts through SSE and shows elapsed time. The ChatGPT UI workflow passed again. These checks do not measure live provider latency or prove a faster model response.

Follow-up HTTP 400 investigation: a live user request was rejected, but the original adapter discarded its error body. Removed forced `text.format=json_object` from ChatGPT plan requests to reduce model-specific capability requirements. Response schema validation remains mandatory before code application. Errors now expose sanitized provider messages, error code/parameter and request ID instead of blaming usage limits for all failures. Failed generations no longer show an Undo action for unrelated edits. 22 unit/auth/provider tests passed, including request-shape and error-redaction regressions. The exact original live error and a successful live retry remain unverified.

## ChatGPT account integration

21 unit/provider/authentication tests passed. New tests cover real loopback callbacks with a simulated token service, PKCE/state checks, signed ID-token validation, nonce and plan-permission rejection, callback cancellation, serialized refresh, remote revocation, reusing the issued client/host IDs, and keeping token strings off disk and out of status responses. Stream tests reject truncated responses and usage failures after text deltas. Provider tests check account-specific catalogs and `store:false` / `stream:true` Responses requests.

Six browser workflows passed, including a mocked official sign-in tab, pending/connected states, account model discovery, automatic generated-code application and sign-out. This is not a live-account sign-in or live model-generation verification; the user must finish the OpenAI consent flow and actual availability/limits depend on their account.

- Production build: TypeScript, Vite React bundle and Node server/worker bundles passed.
- Unit tests: **12 passed** for source synchronization, validation, AI edits/undo, timing, assets and mock-provider transport.
- Browser tests: **4 workflows passed in development and production**. These cover actual project downloads and browser-picker reopen, SVG import/insertion, MP4 download, preview/seeking, editor modes, examples, selection, visual width changes, last-valid-preview recovery, and automatic AI generation/revision/undo.
- Rendering integration: actual MP4, MKV, WebM, GIF, PNG sequence and PNG outputs passed; screenshots at distinct timestamps differ; all ten examples execute; portable project save/reopen preserves source/settings/assets; cancellation cleans partial files.
- Speed metadata: 320×180 at 10 FPS; a one-second source produced durations of 2/1/0.5 seconds at speeds 0.5/1/2.
- Node API tests: production React hosting, origin/header rejection, safe project paths, project/download/reopen, autosave/settings, standalone HTML downloads, real MP4/ZIP exports, SSE progress, HTTP cancellation and cleanup, session-only credentials and recoverable local trash passed.
- `npm audit` and `npm audit --omit=dev`: **0 vulnerabilities**. A targeted minimatch override patches the archiver/readdir-glob dependency; real ZIP export was retested after the override.

Evidence is in `test-results/`, including `web-workflow.mp4`, `web-workspace.png`, rendering outputs under `integration/`, and HTTP export artifacts under timestamped `server-*` folders.

The active application has no Electron runtime or installer build. Archived desktop artifacts in `.desktop-backup/` are excluded from builds and dependency installation. Test runners stop their own server instances; this does not describe the state of a separately running user session.

Live provider access remains account-dependent; mock transport and automatic UI application tests passed. MOV, full keyframe editing and accurate arbitrary timer/media seeking are not implemented. Managed audio and optional image generation were added in the workflow update below. See README.md for the shared renderFrame(time) contract and replay-export limits.

## Follow-up code and documentation audit

Reviewed all three maintained Markdown documents, active source, scripts, configuration, dependency manifests and the archive inventory. Desktop code remains only in the explicitly documented ignored backup. No Electron runtime, preload, IPC, native-dialog or installer target is imported by the active app. The browser client no longer accepts a global desktop-style bridge. AI UI tests intercept HTTP routes instead. Browser tests now use isolated port 5186, fixture storage and output directories, with server reuse disabled; the user's app on port 5173 remains separate. The HMR socket is loopback-only and derives its port from PORT.

After these changes, the build, 12 unit tests, four development browser workflows, four production browser workflows, HTTP server checks and all-format rendering checks passed again. Dependency audit reports zero vulnerabilities. This is verification of these checks, not a guarantee that arbitrary user animation code or live AI providers cannot fail.

## Workspace theme update

Replaced the purple workspace palette with slate/blue semantic color tokens and full light/dark variants, matching Monaco themes, clearer labels, larger control text and keyboard focus states. The production build and four development browser workflows passed after the UI update. Separate production-browser checks verified theme persistence after reload, light dialog colors and toolbar fit at 1366px. Screenshots: `test-results/theme-dark.png`, `theme-light.png`, `theme-light-settings.png` and `theme-laptop.png`.

## Dedicated audio import section

Voice now has a separate Import audio section above ElevenLabs generation, with a file picker, drag-and-drop target, scope guidance and filename/measured-duration feedback. Both paths share the existing narration timing/import logic and work without provider credentials. TypeScript and six focused development browser tests passed, including actual WAV decoding through file selection and drag/drop, rejection of a non-audio drop without changing existing takes, and existing scene/audio workflows. Light-theme screenshot: test-results/audio-import-section.png.

## Timeline interaction fixes

## Manual editing workspace (current UI)

Export controls update: resolution presets now list 480P/720P/1080P/2K/4K/8K with actual dimensions, preserve project aspect and disable sizes beyond renderer limits. Main controls include frame-rate, format, quality and fitting dropdowns; raw width/height/FPS/duration/speed/CRF live under Advanced settings, which opens when Custom is chosen. The output summary reflects current selections and export does not mutate canvas settings. Build, 79 unit tests and two focused production browser checks passed, verifying preset dimensions, 60fps/quality payload, custom sizing and the revised prompt builder's clipboard/draft/footer behavior. These UI checks intercept the export job; they do not claim an actual 8K render was performed. Screenshot: test-results/export-presets.png.

Prompt builder layout follow-up: replaced the template dropdown with responsive selection cards, grouped brief/timing and visual-style fields, added style suggestions and collapsed optional camera/text/output settings. The form scrolls independently of the fixed Copy/Paste footer, with a compact duration/output summary. Existing draft storage and prompt generation remain intact. Browser verification covers card selection, actual clipboard text, disclosure settings, reload persistence, source attachment and footer/form non-overlap.

Media sizing/UI update: separate Output frame and Image insertion cards expose editable dimensions, preset selection, swap and Apply controls up to landscape/portrait 4K UHD. Insertion follows the frame by default, with optional custom centered placement and contain/cover fitting. Removed the largely empty manual-media sidebar in favor of compact filters and clearer import/count headings. Unit cases cover bounds, even video dimensions, centered placement and unique image IDs; browser checks verify actual 4K frame settings, default insertion, custom 640×360 cover placement without changing the frame, and rejection of oversized output. Build, 78 unit tests and six focused production browser checks passed. Screenshot: test-results/media-dimensions.png.

Prompt templates update: added a Prompts navigation tab with six animation/repair templates, editable narration, duration, visuals, style, framing, text and notes. Generated prompts enforce deterministic renderFrame(seconds), self-contained output, full-frame sizing and no competing autoplay/audio controls. Users can copy prompts, choose combined/separate code output, include current code explicitly, adopt timeline/narration duration and open response paste. Drafts persist locally. Build, 76 unit tests and six focused production browser checks passed, including real clipboard copy, template switching, saved drafts and paste-dialog navigation. Screenshot: test-results/prompt-templates.png.

Paste confirmation follow-up: Apply validates the whole candidate project, checks the store accepted all three code fields and keeps the dialog open with a visible error on rejection. Drafts persist across reopening. Browser cases verify empty input, oversized HTML rejection without closing, unsupported external script rejection, draft preservation and successful inline document application. TypeScript and all five focused manual-editor browser cases passed.

Save recovery and editing update: failures show the actual autosave error and Retry resubmits the current project while retaining serialized saves and conflict checks. Added visual end handles with snapping, preview feedback and Undo. Scissors split selected audio or the visual under the playhead. Visual sourceOffset persists animation time through split/preview/composition/export; attached audio is split with matching source offsets. Browser tests check a failed autosave/retry, visual split continuity at 3s, actual API save/readback of sourceOffset, end trimming/Undo and existing editing workflows. Build, 74 unit tests and 20 focused production browser checks passed. The live saved workspace was backed up before restarting the backend for the new optional sourceOffset field.

Playhead snapping and waveform layout follow-up: clicking/dragging the ruler, cursor or blank timeline now snaps to visible audio edges, visual boundaries and markers, with Alt bypass and the shared magnet toggle. Pointer-position assertions account for the hidden native range's frame quantization. Inspection of the actual saved audio revealed a 10px inherited canvas margin clipping the waveform; resetting it keeps the whole canvas inside its parent. Added browser bounds regression checks and refined selected trim grips/playhead styling. All 17 focused development browser checks passed. A read-only screenshot of the user's saved clip confirmed the speech waveform is now fully visible.

Waveform accuracy follow-up: thumbnails no longer lay out thousands of minimum-width DOM bars inside a narrow tile. Both views now use the same bounded canvas renderer and maximum-over-interval aggregation, preserving short transients when downsampling. Detailed preview peaks are decoded locally at 16,384 bins and include every source channel; thumbnails show the complete source, while timeline waveforms follow trimming and looping. Verified transient retention, source offsets, loop wrap and silence with unit cases, plus thumbnail canvas bounds/drawing in browser. Build, 72 unit tests and 16 focused development browser tests passed.

Timeline snapping, audio presentation and transport: audio move/trim gestures snap within eight screen pixels to the playhead, other audio edges, timeline boundaries and markers, with a magnet toggle, temporary Alt bypass and guide. Snapping is constrained by available recording data and timeline duration. Audio clips now use a separate filename strip and a dense canvas waveform; imported peaks use 2048 bins and older recordings are lazily decoded with a bounded cache. Space toggles playback outside editable controls and also forwards from nested combined-preview timelines. Unit checks passed (69 tests), and browser checks cover snapping enable/disable, guide visibility, undo and keyboard transport.

Full-document paste and code errors: a clipboard button opens a full-document paste dialog; directly pasting a document in the code workbench also splits its inline HTML/CSS/JavaScript in one project edit. Unsupported dependencies preserve the existing source and display an explanation. JavaScript runtime and syntax errors report source line/column, offer a jump to the JS editor and preserve the last working frame. Verified production behavior for dialog import, direct paste, applied CSS/script execution, rejected external imports, runtime line 3, syntax line 2, jump navigation and corrected-code recovery. Build, 68 unit tests and 14 focused production browser tests passed.

Code opens by default, with Media/Audio alongside it. Storyboard planning, scene-generation tools, assistant/provider controls and provider polling are hidden. Existing project data is retained. The scene strip is replaced by an active timeline selector, icon controls to add/remove timelines, duration input and combined preview. Each timeline has independent code; importing audio attaches it to the active timeline without retiming it. Main action icons have tooltips and accessible names.

Validation: production build and 68 unit tests passed; 13 focused development and production browser checks passed for manual code entry, legacy-project preservation, timeline switching/add/remove/undo, audio import without provider requests, and existing timeline interactions. Historical AI/storyboard browser suites target UI that is no longer exposed and were not part of this verification. Screenshot: test-results/manual-workspace.png.

Follow-up: the final scene is now cleared to an empty editable scene instead of blocking Delete, preserving the schema's one-scene minimum and imported assets. Fixed pointer selection of visuals in scene-editing mode. All 11 timeline browser checks passed, including final-visual clearing/undo and scene-mode selection/deletion. This supersedes the final-scene protection described below.

Timeline keyboard deletion: clicking a timeline audio/scene clip selects it for Delete or Backspace. Ctrl+Z / Ctrl+Shift+Z undo and redo while the timeline has focus. Text inputs are excluded and empty-track clicks clear the deletion target. Scene removal also removes that scene's attached audio; locked scenes and the final scene remain protected. CapCut's live audio context menu was inspected and showed Delete mapped to Backspace; no CapCut clips were deleted. Browser regression checks cover both deletion keys, undo, scene deletion, final-scene protection and input/empty-track behavior.

Validation: production build, 68 unit tests and all 32 production browser tests passed. The six timeline tests also passed separately against the saved-workspace copy on the production build.

Reproduced three failures against a read-only copy of the saved workspace: dragging the ruler only sought on the initial click, the playhead could not be dragged, and horizontal scrolling hid the lane labels. Added continuous pointer scrubbing, a draggable playhead, sticky labels, zoom anchoring, and viewport constraints for oversized saved panels. Clock updates now render in small timeline children rather than rebuilding the entire timeline each frame. Six interaction tests cover scrubbing, playhead dragging, scrolling, zoom, audio move/trim/undo, and saved panel sizes in both themes. The user's running workspace is separate from the test fixtures.
