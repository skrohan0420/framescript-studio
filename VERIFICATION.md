# Local web-app verification — November 1, 2026

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
