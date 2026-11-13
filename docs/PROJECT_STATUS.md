# Project status and documentation alignment

Reviewed 13 November 2026 against commit `a1f6763` and the active source tree. This is the current status entry point; dated assessments and verification entries retain their original scope. Implementation is substantial, but the roadmap is still in progress. No overall completion percentage is assigned because the broader acceptance gates are not all closed.

## Current product

FrameScript is a local React/TypeScript editor with a Node backend, SQLite persistence and Chromium/FFmpeg export. `src/App.tsx` sets `manualMode = true`. Code, media, audio, prompts, typography and timeline editing form the exposed workflow. The older assistant, Services and storyboard planning paths remain in the repository, with much of their UI hidden. Their existence is not evidence of an available end-to-end workflow.

Implemented foundations include named projects and Trash, portable projects, revision-aware saves and recovery, independent visual timelines, source-preserving audio edits, visual continuations, deterministic seeking, procedural Three.js support, six visual export formats and audio-stem ZIP delivery. Concurrent exports, cancellation, diagnostics and bounded caching are implemented. WebCodecs experiments remain developer-only. The stem increment below follows the initial documentation review and is recorded against the working tree.

Recent source-backed additions:

- Settings → Appearance offers 15 saved palettes with independent dark/light modes, matching Monaco and live waveform colors. Carbon / Silver is the default; the toolbar now visibly labels Settings.
- Settings is shared by Home and the editor through six category tabs. Home exposes application preferences; project/brand/recovery editing is scoped to the editor. Fixed chrome, tab keyboard navigation and return paths replace the previous long form.

- Structured Generate, Edit and Extend packages, validated data-only JavaScript results, candidate review, revision checks and undo. Native star, label, circle and rectangle support is a bounded vocabulary, not a general scene engine. Shape inspection and direct editing are implemented for supported objects.
- Focused Edit and Extend context, package size/hash metadata and an 8 MiB uncompressed budget. The tracker records automated checks; a live comparison of focused versus full packages remains deferred.
- HTML/CSS/JavaScript continuations with separately editable visual segments. Seamless output still depends on generated code honoring the shared clock and handoff contract.
- Reversible local audio enhancement, original/enhanced library previews, speech-driven music ducking and export mix peak/loudness processing. Synthetic checks do not replace listening tests on real speech and devices.
- Optional prompt typography with AI-directed text controls for density, multiple purposes and behavior, plus explicit manual text items. Text remains opt-in; AI-directed mode is the default within enabled text settings.

## Roadmap alignment

1. **Scene continuity — partial.** Structured and code continuation paths exist. General continuity across arbitrary generated scenes and the full requirement acceptance matrix remain open. See [requirement 1](requirements/01-scene-continuity.md).
2. **Voiceover mastering — implemented foundation.** Local processing, reversible toggles and ducking are present. Manual strength controls, echo/clipping repair and perceptual/device acceptance remain open. See [requirement 2](requirements/02-voiceover-mastering.md).
3. **Editing workflow — partial.** Manual editing, recovery, supported shape controls and contextual handoffs exist. The broader visual/animation editor remains planned. See [visual editor plan](requirements/visual-editor-plan.md).
4. **Unified timeline — partial.** Move, trim, split, snapping, source offsets and continuations are implemented. Broader shared-source, speed and overlap semantics still need their complete acceptance fixtures. See [requirement 4](requirements/04-unified-timeline.md).
5. **Audio stems — implemented increment, broader acceptance open.** The export dialog delivers aligned 48 kHz/24-bit stereo narration/music/SFX WAVs, dry/processed routing, an optional linear master and a timing manifest in a ZIP. Shared sample scheduling, queue/cancellation and automated alignment/summation checks are implemented. The creator reports completing the manual stem-delivery check on 13 November 2026; future timeline automation/transition routing remains open. See [requirement 5](requirements/05-audio-stem-export.md).
6. **AI text and labeling — partial.** Prompt direction, native labels and editable typography layers exist. General automatic subject tracking and broad structured text animation are not established by those features. See [requirement 6](requirements/06-ai-text-and-labeling.md).
7. **AI prompt package — partial, usable bounded workflows.** Generate/Edit/Extend round trips are implemented. Focused-context live comparison and wider production acceptance remain open. See [requirement 7](requirements/07-ai-prompt-package.md).
8. **Scene architecture — partial.** Versioned contracts and supported native objects are implemented. Full FSSF scope, general procedural modules and a complete keyframe editor remain open. See [requirement 8](requirements/08-scene-architecture.md).

The [development tracker](requirements/development-plan.md) records stages 0–4 as Done for the first narrow Edit milestone and stage 5 as In progress. This does not mark all eight roadmap requirements complete.

## Documentation findings and changes

- The README mixed exposed manual tools and historical storyboard/provider instructions. Current navigation and recent workflows are now stated explicitly, and retained workflow sections are labeled.
- PROGRESS and VERIFICATION led with older entries. Both now point to this review and distinguish fresh checks from historical results.
- The tracker summary still called focused context open despite recording its implementation later. Its summary and open items now distinguish implemented packaging from deferred live acceptance.
- Requirement 2 already documented the November 13 enhancement foundation accurately. Its broader work list remains a target, not a claim that every item is missing.
- The November 3 assessment and export benchmarks remain historical records. Their measurements are not a current regression result or a promise of performance on every scene.

## Verification and next work

Fresh verification for this documentation review is recorded at the top of [VERIFICATION.md](../VERIFICATION.md). Browser, rendering integration, server, credential and live AI checks must retain their own dated evidence; they are not inferred from unit tests or a successful build.

Priorities are to close the focused-package live comparison and manual-save capture scenario, complete representative timing/shared-source fixtures, perform real-speech/device listening checks, and sequence the wider scene editor through its dependencies. Update this summary and the tracker whenever those acceptance gates change.
