# Creative Direction workflow

Status: Generate director export and automatic paste-to-use final prompt/ZIP integration implemented and covered by focused tests. The user removed the separate approval gate; nonempty directions are used immediately. Project-scoped persistence and continuation integration remain pending. Approval proposals below describe the earlier design and are superseded by this latest decision.
Updated: 14 November 2026 (Asia/Calcutta).
Branch: `codex/creative-direction`.

Progress and acceptance criteria: [Creative Direction tracker](CREATIVE_DIRECTION_PROGRESS.md).

## Purpose

Allow users to approve how narration will be visualized before asking an external model to write animation code. Reduce required creative configuration while preserving explicit user control, existing runtime contracts, and the copy-prompt/download-ZIP/import workflow.

This moves creative decisions earlier; it does not guarantee lower total token usage, faster completion, or better animation. Those outcomes require evaluation.

## Existing implementation

- `src/PromptTemplates.tsx` manages the prompt builder, browser-local draft, references, output selection, and package export.
- `src/PromptDirectionStudio.tsx` offers reference-look and pacing presets, not generated concepts or approval.
- `shared/prompt-templates.ts` combines creative guidance and technical instructions. Code generation currently asks the model to plan shots internally and implement them in the same response.
- `server/structured-generate-package.ts` packages code tasks as TASK.md, references, and a manifest. Structured generation additionally includes its schema, output contract, and runtime module.
- `shared/code-continuation.ts` and `server/code-continuation-package.ts` preserve previous source, handoff framing, motion references, timing offsets, and inherited context.
- Scenes and continuation segments can retain visual context. This is not a versioned creative-approval system.
- Structured generation has restricted native shapes/tracks, an optional built-in star, and an optional static label. It cannot implement arbitrary animation code, 3D, audio, or advanced timed typography. Structured Edit and Extend are also restricted operations.

These statements describe the inspected baseline, not new feature work.

## Agreed user journey

1. Enter narration, timestamps, duration, audience, essential instructions, and relevant references. Keep Reference look as an explicit user choice.
   Optionally paste the whole video script in Creative Direction for broader context. The selected scene narration and timestamps remain the scope and timing authority; whole-video timestamps must not be treated as scene-local cues.
2. In Output, use **Copy Director Prompt & Download Context**. Export a creative-only prompt and relevant context; do not call an AI API.
3. Send the prompt and package to an external model. Receive three distinct storytelling approaches, each with its intended takeaway, short progression, feasibility, and main compromise. Do not request code.
4. Select, combine, or refine ideas in that external conversation. The director prompt instructs the model to resolve the choice into one coherent final visual specification.
5. Paste the final specification into **Selected creative direction**. The field is editable; alternatives need not be imported.
6. Review and choose **Use this direction** to approve the current specification against its inputs.
7. Use the existing **Copy and Download** action for the implementation prompt and ZIP. The approved direction guides implementation; technical contracts remain intact.
8. Import, preview, edit, extend, and export through existing FrameScript workflows.

Exploration is optional. Users may generate directly or paste a direction prepared elsewhere. Small repairs and narrow edits do not require creative exploration.

## Placement and interface

Place a Creative Direction section inside Output, below output settings/reference uploads and above **Preview generated prompt**. Include the director export action, an editable multiline direction field, approval action, and approval status. Let users inspect both generated prompts.

Suggested helper text: “Paste the final refined direction here, rather than all the alternatives.”

Approval states distinguish an unapproved draft, approved content, edited content needing review, and changed inputs needing review. Do not erase pasted content when inputs change.

The first version needs one final-direction field, not an in-app concept gallery or conversation manager.

## Responsibility of existing controls

- **Brief:** user supplies narration, timing, duration, audience, essential facts, and instructions.
- **Visuals:** director proposes subjects, setting, composition, lighting, and palette unless explicitly locked.
- **Reference look:** retain the user's selection and pass it to both stages.
  Director export explicitly includes the preset description, influence and custom notes, with detailed translation requirements for shapes, palette roles, composition, depth, materials/lighting, motion, permitted text and beat-level application. The Kurzgesagt-inspired preset also has a concrete original flat-vector treatment expansion; other presets currently use their description and these shared requirements.
- **Animation:** director proposes motion and camera behavior; runtime capabilities constrain proposals.
- **Editing & pacing:** director proposes beat lengths, holds, and transitions within supplied timing.
- **Audio:** user permits music/SFX; director proposes mood and cue placement. Existing soundtrack contracts remain automatic.
- **Identity:** user-provided brand and recurring-subject identity constrain all proposals.
  Identity means the whole video's theme and visual instruction guide. External generation first offers three options, waits for user selection, then returns a clean Markdown guide with eight numbered sections: overall direction, color system, subject design, environments/composition, lighting/effects, motion language, consistency rules, and allowed variation/exclusions. The guide uses actionable instructions rather than a scene shot plan.
  The interface now offers Copy Identity Prompt and one pasted visual identity guide instead of individual palette/subject/environment/lighting/mood/motion/avoid fields. Generate externally using Reference look and story context. The retained consistency checkbox makes pasted invariants locked or advisory in director and coding prompts. The guide currently persists in browser-local draft storage; project-scoped storage remains pending.
- **Mascot:** user chooses inclusion and supplies identity/reference; director proposes staging, actions, and timing.
- **Typography:** user controls text permission, exact required wording, and subtitles. Delegate treatment and optional wording only when authorized.
- **Details:** retain essential instructions and exclusions; delegate creative elaboration.
- **Output:** user selects the supported output; its capabilities constrain the director before exploration.

Preserve advanced overrides. Simplification must reduce required decisions and conflicting instructions, not merely hide controls while exporting all their defaults.

## Director response requirements

Initial alternatives should differ in explanatory approach, not merely color or style. Keep alternatives concise; develop full detail after selection.

The final specification should cover:

- Intended takeaway and selected visual approach.
- Subjects, environments, composition, hierarchy, and stable identity.
- Timed beats: narration cue, focal action, framing/camera, motion, transition, and resulting state.
- Opening state, progression, ending state, and readable holds.
- Palette, lighting, atmosphere, and reference interpretation where relevant.
- Supplied facts, deliberate schematic simplifications, and unresolved assumptions.
- Technical feasibility, dependencies, missing assets, and practical compromises.
- Decisions that must be preserved and implementation details that remain flexible.

No animation code, fabricated facts, invented exact speech timestamps, or unsupported promises of feasibility. Supplied timing remains authoritative. Untimed narration permits estimated rhythm, explicitly distinguished from actual synchronization.

Do not prescribe every coordinate, mesh, shader, or easing function. Leave implementation judgment to the coding model within the approved intent.

## Authority and conflicts

Runtime/output contracts, factual constraints, timing, and required continuity must remain satisfied. Explicit user requirements constrain approval. The approved direction supplies creative decisions; generic presets fill only unresolved choices.

Conflicts must be reconciled rather than silently resolved by appending more instructions. Examples include forbidden text in an approved labeled diagram or a cinematic 3D concept targeting restricted structured output.

When using an approved direction, replace overlapping generic creative planning with instructions to realize the approved beats. Retain deterministic rendering, output formatting, soundtrack rules, references, and quality checks.

## Persistence and context packaging

Store the approved direction with its scene or continuation, not solely in a global browser draft. Retain the input snapshot or identity needed to detect relevant changes: narration/timing, duration, reference look, references, output capability, explicit constraints, and source revision for continuations.

Edits to the direction or material changes to those inputs require review. Preserve the prior direction for editing and reuse. Reusing a direction for another scene does not automatically transfer approval.

Readable editable text is the user-facing format. A modest structured metadata layer should represent approval and input identity; exact schema and any optional structured beat format remain undecided.

Generate the copied prompt and ZIP from the same snapshot. Keep a canonical detailed specification in the package, with a concise summary/pointer where appropriate. Avoid divergent duplicate specifications. Exact filenames and compatibility behavior are pending design decisions.

References must distinguish identity, style inspiration, factual guidance, and continuity evidence. Guidance files are not automatically available runtime assets.

## Generate, Edit, and Extend

- New code scenes allow broad exploration within the selected capabilities.
- Repairs and narrow edits preserve existing intent and bypass exploration by default.
- Code extensions start from the actual source/handoff state. Preserve the renderer, persistent objects, materials, camera, seed, motion phase, and timing offsets. Propose new developments after continuity is established; retain existing source and motion captures.
- Structured workflows must describe their actual limited vocabulary. Do not imply the director expands their renderer or patch contracts.

Initial rollout scope across these paths still needs explicit resolution. Preserve existing operations while adding the optional stage.

## Risks and evaluation

Risks include extra tokens and exchanges, choice overload, infeasible prose, stale approval, excessive constraints, hidden conflicting presets, and continuity regressions. A model's feasibility explanation is not runtime verification.

Compare the existing workflow, simplified direct generation, and direction-first generation on representative timed/untimed scenes, reference-dependent subjects, text permissions, and extensions. Assess rendered results for explanatory clarity, narration alignment, consistency, continuity, runtime/export correctness, user effort, time to an acceptable result, regeneration count, and total tokens where available.

Do not report improved quality or cost until evidence supports it.

## Out of scope

Automatic AI API integration, a new animation engine, expansion of structured renderer capabilities, mandatory direction approval for every task, and an in-app external-model conversation system.

## Open decisions

- Initial feature scope: Generate first versus simultaneous continuation support.
- Exact prompt wording, final-spec format, and approval metadata schema.
- Which input changes invalidate approval and how users reconcile conflicts.
- How advanced overrides are marked explicitly and surfaced in the simplified interface.
- Package contents for director exploration versus implementation, including active-code references.
- Direction reuse/export/import and persistence compatibility with older projects.
- Final UI wording and behavior when a direction is pasted but unapproved.

No runtime implementation is authorized by completion of this document alone.
