# FrameScript Studio requirements

Source: FrameScript Roadmap 2026, version 1.0, 4 November 2026. Numbers match the source document. Each file describes planned work, existing foundations, dependencies and acceptance criteria.

The [AI-generated scene and code contract](08-scene-architecture.md#ai-generated-scene-and-code-contract) is a foundational requirement within item 8. It defines the structure and code interface that let FrameScript interpret, edit and reliably render AI-generated scenes. Establish it before building features that depend on structured AI output.

## Requirements

1. [Scene Continuity Integration](01-scene-continuity.md)
2. [Automatic Voiceover Mastering](02-voiceover-mastering.md)
3. [Editing Workflow and UX](03-editing-workflow-ux.md)
4. [Unified Timeline System](04-unified-timeline.md)
5. [Audio Stem Export and Synchronization](05-audio-stem-export.md)
6. [AI Directed Text Animation and Smart Labeling](06-ai-text-and-labeling.md)
7. [Universal AI Prompt Package](07-ai-prompt-package.md), including [the Generate builder and contextual Edit and Extend panels](07-ai-prompt-package.md#self-contained-packages-for-generate-edit-and-extend) and [focused context for long scenes](07-ai-prompt-package.md#focused-context-for-long-scenes)
8. [Universal Animation Code Architecture](08-scene-architecture.md)

## Delivery order

Use the [development plan and tracker](development-plan.md) for the current implementation order, stage exit checks, progress reports, problem reports and decision records. Start by designing the Requirement 7 handoff and use the first Edit workflow to define the minimum Requirement 8 contract.

Use the [development prompts](development-prompts.md) to start or resume any stage.

- Phase 0: Audit the existing runtime, persistence, timeline and export paths. Record performance baselines and agree on the initial scene vocabulary, timing and compatibility rules. Start UX design here.
- Phases 1–2: Start with the package workflow (7), then define and validate the minimum scene architecture (8) through the first Edit workflow. Develop unified timeline semantics (4) before expanding to trimmed, speed-adjusted and shared clips. Share IDs, assets and timing across the three.
- Phases 3–4: Add editable AI text (6) and continuity (1) on top of 8, 7 and 4. Audio stems (5) can progress once timeline and sample scheduling stabilize. Build voiceover mastering (2) on the shared audio graph.
- Phase 5: Continue UX work (3) through release hardening. Verify migration, recovery, diagnostics, security, performance and documentation.

## First integration milestone

See the [first structured AI edit milestone](first-edit-milestone.md) for the proposed ZIP and prompt, patch example, acceptance checks and next timeline decisions.

Import a generated astronomy scene with a procedural star, native label and one animated property. Edit the label and a keyframe, undo and redo the edit, seek backward and export. Verify frame timing, preservation of unrelated content and legacy preview/export compatibility.

Measure structured import success, editable coverage, repeated-seek consistency, preview/export parity, edit time, stem sample offsets, recovery success and render throughput. Set thresholds from representative baseline runs.
