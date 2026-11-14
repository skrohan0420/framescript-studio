# Creative Direction progress tracker

Updated: 14 November 2026 (Asia/Calcutta).
Branch: `codex/creative-direction`.
Status: Generate prompt/ZIP wiring verified; project-scoped persistence and continuation integration pending.

Source of requirements: [Creative Direction workflow](CREATIVE_DIRECTION.md).

## Completed

- [x] Inspect prompt assembly, packaging, and Generate/Edit/Extend contracts.
- [x] Discuss benefits, limitations, control delegation, and reference-look retention.
- [x] Agree on optional external-model exploration and final-direction paste-back.
- [x] Agree on placement in Output above the generated-prompt preview.
- [x] Create the feature branch from the clean main branch.
- [x] Record workflow, boundaries, risks, and unresolved decisions.

## Design decisions still needed

- [ ] Resolve initial Generate/Extend scope and structured-output treatment.
- [ ] Review actual director prompt and final specification format.
- [ ] Define explicit overrides, conflict handling, and approval invalidation.
- [ ] Define scene/continuation persistence, reuse, and backward compatibility.
- [ ] Confirm context-package contents and prompt/ZIP consistency rules.
- [ ] Confirm empty, unapproved, edited, and changed-input UI behavior.

## Pending implementation areas

Checked entries identify delivered behavior. Historical activity entries retain their status at the time recorded.

- [x] Director prompt and context export for Generate (reuses existing reference ZIP transport).
- [x] Output section with paste/edit/approve controls and status.
- [ ] Scene-specific direction storage and input-change detection.
- [x] Final implementation prompt integration without conflicting creative defaults.
- [ ] Progressive disclosure of delegated controls with explicit overrides retained.
- [ ] Continuation integration within the agreed rollout scope.
- [ ] User-facing documentation and verification records for delivered behavior.

## Acceptance and verification

- [ ] Copy/download/external-model/paste-back works without API credentials.
- [ ] Director export requests distinct feasible concepts and no animation code.
- [ ] Reference look, narration timestamps, facts, and permissions survive both stages.
- [x] Final export uses only the selected approved direction, not rejected alternatives supplied separately. Users must paste the final selected specification only.
- [x] Prompt and ZIP describe the same approved snapshot.
- [x] Direction edits and material input changes visibly require review.
- [ ] Direction persists with the correct scene/segment across save and reload.
- [ ] Direct generation and narrow repair paths remain usable without direction approval.
- [ ] Runtime, soundtrack, import, preview, and export contracts remain intact.
- [ ] Extensions retain handoff source/motion evidence and timing semantics where supported.
- [ ] Structured proposals stay within their actual supported contract.
- [ ] Keyboard interaction, long text, clipboard failures, and relevant validation are checked.
- [ ] Appropriate type/build and focused regression checks pass after implementation.
- [ ] Rendered comparisons evaluate quality, effort, iterations, time, and token cost before benefit claims.

## Activity log

- **14 November 2026, automatic paste-to-use (supersedes approval gate):** Removed Use this direction at the user's request. Any nonempty pasted direction now enters final prompt/ZIP automatically; edits apply immediately and the field shows In use. Empty text preserves direct generation. No reapproval is required after input changes. TypeScript and the updated browser ZIP export test passed. Earlier approval/change-detection entries describe historical behavior, not the current UI.

- **14 November 2026, director clipboard compatibility:** Removed the newly added purpose RPC field that older running backends rejected. Copy Director Prompt now copies text locally without a backend request/download; optional context ZIP has its own action using the compatible request schema. Copied text explains separately attached references. TypeScript and the browser test passed, including clipboard content, optional ZIP and final exports.

- **14 November 2026, wiring audit:** Found and fixed the missing selected-direction connection to final generation. Added explicit approval using a compact input/context change marker; nonempty unapproved directions block final export, while empty directions preserve direct generation. Changes to draft, scene/session, frame settings, references or included source invalidate approval. Approval is deliberately not restored after reload; direction/identity remain browser-local drafts, not scene-owned project records. Final code/structured prompts include selected direction, full-story context, identity, rendering and permissions. Generic creative/text/audio defaults no longer replace the selected specification. Director packages identify their purpose in the manifest; structured output no longer requests unsupported audio.
- **Audit evidence:** Focused unit suite covers approval inputs, selected-plan precedence, references, timing, text/audio permissions and identity. Browser test `tests/director-export.spec.ts` exports real director, code and structured ZIPs; verifies selected content, attached reference bytes, structured contract/schema, preview/TASK.md equality and approval invalidation. This verifies packaging and UI wiring, not external-model response quality or animation rendering. General legacy browser suites still need updating for intentionally removed controls.

- **14 November 2026, Output UX:** Grouped package preparation, optional direction exploration and generated-result import separately. Added three concise external-AI workflow steps, a larger labeled direction field, explicit draft status/help, improved upload/button styling and responsive grouping. Import now follows direction exploration instead of appearing among package inputs. TypeScript passed; browser visual QA remains pending.

- **14 November 2026, Brief context and accessibility:** Moved the full-script input from Output to Brief with an associated label/help description. Removed Audience & Goal and legacy audience restoration; director/identity infer audience and takeaway from script context. Enlarged script fields and duration hit areas, improved text sizing/line spacing, and clarified scene narration versus full-video context. Browser visual/accessibility QA remains pending.

- **14 November 2026, tab styling:** Increased prompt-tab spacing, icon sizing and hit areas. Shared selected styles across prompt, workflow, code editor, inspector, library/filter, timeline and Settings tabs now use a theme-aware tinted fill and accent border instead of an inset underline. Added consistent hover/focus states, compact-width rules and reduced-motion handling. Visual browser QA remains pending.

- **14 November 2026, delegated Details:** Removed Details navigation and fine-tuning controls. Camera and additional requirements no longer restore from old browser drafts or enter director preferences. Director chooses framing and creative treatment while automatic timing, safe-margin and runtime requirements remain. Essential constraints can still be incorporated in the selected direction/identity; a separate essential-instruction input is not currently exposed.

- **14 November 2026, delegated typography:** Replaced typography studio with one Include text toggle. Director chooses grounded wording, density, placement, appearance and timing; subtitles require explicit instructions. Legacy text controls no longer restore or enter director export. Direct generation enables its existing AI text planning when text is allowed; approved-direction integration remains pending. Mascot work remains deferred as requested.

- **14 November 2026, whole-video theme format:** Identity prompt now defines identity as the entire video's reusable theme/instructions. After three options and user selection, it requests only a Markdown theme guide with eight fixed sections: direction, colors, subjects, environments/composition, lighting/effects, motion, consistency, and variation/exclusions. Requires actionable instructions, locked invariants, and scene flexibility without scene-specific timestamps. Updated paste-field wording and regression assertions.

- **14 November 2026, identity selection:** Identity prompt now requests three concise options first and explicitly stops for user selection/refinement. Only after selection does it expand one coherent detailed guide for paste-back; rejected alternatives are excluded. Updated UI helper text and regression assertions.

- **14 November 2026, identity workflow:** Replaced individual identity fields with Copy Identity Prompt, preview, and a saved editable visual identity guide. Kept the consistency lock. Identity generation is strongly grounded in Reference look and full-script context; pasted invariants reach both director and existing coding prompts. Clipboard fallback uses Output. Old individual identity settings no longer restore. This remains browser-local draft storage, not project-specific identity persistence or reference-change approval tracking.

- **14 November 2026, delegated audio treatment:** Audio now exposes only music/SFX permissions; removed presets and detailed audio controls. Legacy audio treatment is not restored or exported to the director. Director chooses supported synthesized treatment and cues for enabled categories, preserving narration clarity. Structured output disables the toggles and director planning excludes unsupported audio. Final coding generation still uses existing automatic audio defaults until approved-direction integration.

- **14 November 2026, delegated animation techniques:** Kept rendering mode selection and the 3D starter. Removed technique selection, per-technique timing/variation and shared intensity/easing/synchronization controls. Old technique settings are not restored or exported to the director. Director prompt explicitly honors rendering mode and flags output-capability conflicts while choosing suitable techniques.

- **14 November 2026, delegated pacing:** Removed Editing & pacing navigation and controls at the user's request, including keyboard navigation and saved-tab restoration. Legacy pacing settings are no longer restored or included in director export. Director chooses rhythm, beat lengths, holds, cuts and transitions within authoritative narration timing. Reference look remains unchanged. Direct coding generation retains automatic pacing guidance pending approved-direction integration.

- **14 November 2026, delegated Visuals:** Removed the Visuals tab and its subjects/action and style controls at the user's request. Old browser-draft values for those controls are no longer restored, and director export excludes those legacy fields. Reference look remains. Director instructions explicitly delegate subjects, actions and art direction. Direct generation retains its automatic visual defaults until approved-direction integration. TypeScript and four focused prompt tests passed.

- **14 November 2026, detailed reference context:** Director export now has an explicit reference-look section with selected description, influence, custom-note precedence, and detailed construction/palette/composition/depth/lighting/motion/text/beat guidance. Added a concrete expansion for the selected Kurzgesagt-inspired preset; other looks use their supplied description and the same detailed translation requirements. Examples cannot introduce unrelated subjects. TypeScript and all four focused prompt tests passed.

- **14 November 2026, full-script context:** Added an optional full-script field alongside automatic inclusion of selected-scene narration/timestamps. The director uses the whole story as context only and must preserve scene scope, duration and local timing. Browser-local draft restoration includes the full script. TypeScript and all three director-prompt tests passed; browser interaction remains unverified.

- **14 November 2026, step 1:** Added the creative-only director prompt, Output export action, prompt preview, and editable direction draft restored from browser storage. Existing generation remains unchanged. Approval, scene-specific persistence, dedicated director package metadata, and final prompt integration remain pending. The draft field explicitly states these limits.
- **Step 1 verification:** `npx tsc --noEmit` passed; `npx vitest run tests/director-prompt.test.ts` passed both tests covering timing/reference retention, disabled text, exclusion of the previous direction, structured capabilities, and optional source inclusion. Browser interaction, clipboard/download delivery, and rendered quality have not yet been verified.

- **14 November 2026:** Created `codex/creative-direction`; added design documentation and this tracker. No Director Prompt UI, persistence, packaging, or generation logic has been implemented. No runtime tests were run for this documentation-only update.

Update checkboxes only when the corresponding result is complete. Link verification evidence when marking acceptance criteria complete; record limitations and deferred scope explicitly.
