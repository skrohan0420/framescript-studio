# Universal Animation Code Architecture

## Goal and dependencies

Establish the versioned FrameScript Scene Format (FSSF) and its AI-generated scene and code contract. This contract is a foundation of FrameScript Studio. The inspector, timeline, structured AI edits, typography, continuity, preview and export depend on shared definitions of scene elements, editable properties and time. Preserve the existing HTML, CSS and JavaScript workflow through a compatibility adapter for `renderFrame(seconds)`.

## AI-generated scene and code contract

AI-generated output intended for structured editing must follow a versioned, machine-validatable contract. FrameScript must be able to identify what a scene contains, discover which properties it can edit, apply changes by stable ID and evaluate the result at any supported timestamp. A deterministic render function gives FrameScript control over playback time. The scene schema and module interface give it control over what can be inspected and edited.

- **Scene structure.** Describe supported objects, text, assets, properties and animation tracks in FSSF. Give addressable elements stable IDs and define types, units, defaults and valid ranges for editable values where applicable. Keyframes and patches must reference declared IDs and properties.
- **Procedural code.** Canvas, DOM and Three.js modules must use the documented lifecycle and declare their inputs, dependencies, capabilities and editable parameters. For example, a star module can expose a typed `glowIntensity` parameter that FrameScript can display in the inspector, keyframe and patch. The module owns the drawing logic. FrameScript uses the declared interface to determine what it can edit.
- **Deterministic evaluation.** Given the same scene, inputs and timestamp under the same supported rendering conditions, evaluation must produce equivalent results on repeated, forward and backward seeks. Use the shared project clock, declared inputs and reproducible seeds where needed.
- **Validation and compatibility.** Validate the contract version, references, capabilities and parameter values before applying generated content. Identify the failing file, field or ID and explain the expected input. Apply valid edits as undoable transactions that preserve unrelated content. Existing `renderFrame(seconds)` scenes retain compatibility playback and export. Structured editing requires declared objects or module parameters.
- **AI handoff.** Publish the schema, module interface and valid examples as part of the [AI prompt package](07-ai-prompt-package.md). The prompt and importer must target the same contract version. Schema and module interface changes need an explicit compatibility or migration policy.

## FSSF v1 scope

- A minimum valid scene declares its schema version, stable scene ID, dimensions, frame rate, duration and ordered layers. It may contain native nodes, procedural module instances or both. Declare every referenced asset and module.
- Prioritize native text, typed transforms and properties, keyframes, asset references and a procedural module interface for the first integration milestone. Record which Canvas, DOM and Three.js capabilities v1 supports before publishing the contract. Cameras, materials, effects and continuity fields require explicit support and validation rules before AI output can depend on them.
- Define IDs within their owning scope. Scene IDs identify scenes within a project. Node and module instance IDs identify elements within a scene. Preserve these IDs across edits, moves and renames. A reference outside its owning scope must identify the owner explicitly.
- Define the type, units, default, constraints and animatability of each editable field. The scene evaluator resolves the base value and its keyframe track using documented interpolation. Specify any expression precedence before enabling expressions.

## Procedural module interface

- Version the module interface separately from the scene schema. Each module declares its renderer, required capabilities, assets, editable parameters and output surface. Each instance has its own ID and parameter values.
- Define lifecycle operations for initialization, evaluation at an explicit scene time, and disposal. Initialization receives only the host services and declared dependencies the module needs. Evaluation receives resolved parameter values, time and reproducible inputs. Disposal releases resources owned by the module.
- Render the same scene state at the same timestamp regardless of earlier seeks. Independent animation clocks and unseeded randomness violate the contract. Simulations must support reproducible evaluation within the supported resource budget.
- Keep execution isolated. Enforce network, filesystem, time and resource limits. Surface module failures with the scene, module instance and failing operation. Preserve the editable project when preview or export fails and report the failed export explicitly.

## Generated result types

The [AI Prompt Package](07-ai-prompt-package.md) carries the task and its expected result. This requirement owns the scene, patch and extension semantics that the importer must enforce.

- **Generate** returns a complete scene plus declared dependencies. Validate its IDs, capabilities and references before adding it to the project.
- **Edit** returns a scoped patch against the packaged scene ID and revision. Each operation identifies the affected element and property by stable ID and uses a supported operation and valid value. Show affected elements before applying. Supported legacy source replacements use a separate review path.
- **Extend** returns the target scene ID and revision, the added interval and changes needed for the continuation. Preserve the original segment by default, including its evaluated frames and timing. Any handoff change that affects the existing segment needs explicit permission in the task scope and must be visible in review.
- Validate the complete result against the current revision and permitted scope before applying it. Reject stale results and surface conflicts for review. Apply accepted changes atomically as one undoable transaction. A failed operation leaves the project and undo history intact.

## Time and rendering

The first built-in star continuation declares a start frame, end frame and final glow value. The runtime computes its starting glow from the original animation at the handoff. Times before the start frame use the original evaluation. At and after the start, the glow interpolates to the declared target and holds afterward. The current implementation supports one continuation per source and retains legacy source projection when the field is absent. This is a narrow initial contract for testing the complete Extend workflow.

- Use the authoritative [timeline timebase](04-unified-timeline.md). Convert project time to scene-local time using clip placement, source offset, trim and speed. Specify rounding, cut ownership and endpoint handling in the shared timing contract.
- Use the same evaluation rules in preview and export. Resolve native values, keyframes and procedural parameters at the requested time, then render with the declared assets and layer order.
- Test seek determinism by comparing the same timestamps reached in different orders. Test preview and export parity separately using the same scene, runtime, assets, fonts and frame settings. Define comparison tolerances for each supported backend and compare frames before lossy encoding where practical.

## Validation and compatibility

- Validate schema and module interface versions, capabilities, unique IDs, typed values, timing bounds, target scope and asset references before applying a result. Resolve runtime assets by declared IDs and verify hashes where required.
- Use explicit, tested migrations for supported older versions. Reject unsupported versions or required capabilities with an actionable diagnostic. Allow fallback only where the contract defines it.
- Include a diagnostic code, file or field path, affected ID where available, and the expected input. Test missing assets, invalid parameters, failing modules, stale revisions and unsupported versions.
- Keep legacy `renderFrame(seconds)` scenes on the compatibility path. Test import, preview and export against existing fixtures.

## Worked example

The [first structured AI edit milestone](first-edit-milestone.md) expands this example into a proposed end-to-end fixture with an illustrative JSON patch.

This example illustrates what the AI and editor exchange. Field names and units are illustrative until the v1 schema is published.

1. **Generate result.** The AI returns a scene named `fireworks-galaxy` with a native text node `galaxy-label` and a Canvas module instance `star-core`. The module declares `glowIntensity` as a keyframeable number from 0 to 1. The scene sets it to 0.4 and includes a keyframe at 3.2 seconds with a value of 0.6.
2. **Editor interpretation.** FrameScript validates the result, shows the label in the object list, exposes the glow control in the inspector and shows its track in the timeline. The Canvas module receives the evaluated glow value at each requested timestamp.
3. **Edit result.** At revision 14, the creator requests stronger glow at 3.2 seconds. The AI returns a patch targeting `fireworks-galaxy` at revision 14 that updates the existing `star-core.glowIntensity` keyframe to 0.8. The importer validates the target, allowed scope and value before review. Applying it changes that keyframe and leaves the label and unrelated tracks intact.
4. **Verification.** Evaluate the edited scene at 3.2 seconds after forward and backward seeks and compare preview and export. Undo restores 0.6 and redo restores 0.8. A stale revision or a value of 1.4 fails validation without changing the project.

## Acceptance criteria

1. Import an AI-generated fixture and discover a named object and a declared module parameter through the inspector.
2. Change the parameter and one of its keyframes by stable ID. Verify that unrelated scene content is preserved and undo and redo restore the expected values.
3. Seek forward, backward and repeatedly to the same timestamp. Verify deterministic evaluation and check that the edit appears at the expected time in preview and export.
4. Reject fixtures with an unsupported contract version, a missing reference or an invalid parameter value. Identify the problem in each diagnostic and preserve the current project on failure.
5. Verify that a legacy `renderFrame(seconds)` fixture still imports, previews and exports.

## Work required

- Define project and scene schemas covering IDs, dimensions, FPS, duration, layers, objects, transforms, materials, cameras, effects, text, audio references, assets, keyframes and continuity metadata. Specify which capabilities v1 supports.
- Define stable IDs, time units, coordinate systems, interpolation, layer order and precedence between keyframes and expressions. Share the authoritative timebase with requirement 4.
- Separate native scene data from procedural Canvas, DOM and Three.js modules. Specify module inputs, editable parameters, capabilities, output surfaces and deterministic lifecycle.
- Build validation, serialization, import, version migration and actionable diagnostics. Resolve dependencies by declared asset IDs and hashes. Define behavior for unsupported capabilities.
- Provide inspector access and validated patch operations by ID. Apply edits as undoable transactions and preserve unrelated scene data.
- Isolate generated code and constrain network, filesystem access, execution time and resource usage. Specify reproducibility inputs such as random seeds, runtime versions, assets, fonts and renderer behavior.
- Build a shared evaluation model for preview and export, with a legacy adapter and compatibility fixtures.

## Deliverables and acceptance

Deliver versioned schemas, a module contract, reference renderer, legacy adapter, inspector and patch APIs, migration fixtures and representative examples. Verify repeated and backward seeks, preview/export equivalence under defined conditions, targeted edits and exact undo/redo. Reject invalid packages with actionable diagnostics. Verify that legacy projects still import, play and export.
