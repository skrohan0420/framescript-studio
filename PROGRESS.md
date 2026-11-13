# Documentation reconciliation — November 13, 2026

Reviewed commit `a1f6763` against active UI gates, source, tests and the roadmap tracker. Added the [current project status](docs/PROJECT_STATUS.md), clarified exposed versus retained workflows in README, and reconciled the stage 5 summary with its later focused-package evidence. Current additions include structured handoffs and supported shape editing, code continuations, reversible voice enhancement and AI-directed typography controls. Broader scene architecture, full keyframe editing and aligned stem export remain incomplete. See [VERIFICATION.md](VERIFICATION.md) for fresh checks and their limits.

Entries below are historical change records. Their test counts and instructions describe their own update, not the current whole-project verification state.

# Assessment fixes — November 3, 2026

Fixed the assessed audio-source/gain, save-size, rename ordering, image-import visibility/context, dialog keyboard, compact-layout and completed-export retention problems. Project additions/imports now have a 90 MB serialized budget; completed local render copies expire after seven days and can be inspected/cleared in Settings. Build, 124 unit tests, all 61 production browser tests, HTTP/server checks, credential restart, all-format rendering and audio/video integration passed. See VERIFICATION.md for evidence and limits. Restart the running backend and refresh the browser to load the changes.

# Concurrent timeline exports — November 2, 2026

Multiple timeline exports now run as separate jobs, with two render slots and a FIFO queue. The minimized floating box lists per-clip progress, timeline, status, cancellation and completed downloads. Each export keeps its submitted snapshot and settings. Build/TypeScript, 104 unit tests, all 52 production browser checks and real concurrent HTTP export/cancellation checks passed. See VERIFICATION.md and README.md. Backend restarted after a saved-database backup; refresh the app to load the new flow.

# Faster video export — November 2, 2026

Added default maximum-quality JPEG capture for opaque video, with an explicit lossless capture option and PNG safeguards for transparency, images/sequences, GIF and quality-zero exports. The 4K/60 synthetic benchmark improved from 14.54s to 8.16s (43.9% less time). Build, 101 unit tests, six focused browser checks and rendering/audio integration passed. See VERIFICATION.md for quality measurements and limitations. Restart the backend and refresh the browser to load the option.

# Browser test maintenance — November 2, 2026

The active manual-editor browser suite now passes all 48 checks. Former AI/Services/storyboard UI scenarios are retained as .legacy.ts reference files outside discovery. Build/TypeScript, 99 unit tests, server checks, credential restart, all-format rendering and audio/video export integration passed. See VERIFICATION.md and tests/README.md for the current coverage and historical limitations.

# Web-app conversion

The studio layout now follows the library/player/contextual-inspector/full-width-timeline pattern studied in the open CapCut app. Media/Audio/Script/Scenes/Layouts/Code tabs, embedded production tools, player transport, project/audio/media inspectors, scene filmstrips, differentiated audio lanes and track-wide playhead/zoom are implemented. Build, 68 unit tests and all 26 production browser workflows passed; laptop and desktop screenshots are in test-results/studio-layout*.png. Code remains lazy-loaded and the current providers remain unchanged.


Audio-first workflow now supports script → full narration → scenes fitted to measured audio → visuals → SFX/music → export. Added full-script narration scope, decoded-duration scene allocation, preservation of audio-controlled timing during AI visual edits, automatic per-scene take fitting, existing-visual retiming, and playhead placement for SFX. End-to-end tests use provider fixtures but exercise actual decoding and real MP4 audio/video export. Scene boundaries remain proportional estimates rather than word-aligned cuts.


Project-review improvements added on November 1, 2026: revision-aware Save, ordered autosave with cross-tab version conflicts, a 20-checkpoint recovery history and offline recovery downloads, atomic workspace/chat persistence, bounded media caching and corruption recovery. Playback no longer rerenders editing panels per tick. Production workspace adds draggable/keyboard-accessible waveform move/trim controls; project brand kits and optional scrub-able AI comparison are available. Timeline, scene panels and editor setup are separate modules, RPC calls share typed schemas, Monaco/services/storyboard load on demand, and GitHub Actions includes separate unit/build and production browser/media jobs. Existing user edits and local account data were preserved. Restart the local Node process to load server changes.


Remembered connections now use per-browser Windows DPAPI credential files outside SQLite/project exports. Persistent HttpOnly cookies select saved credentials after Node restarts. API keys restore automatically, OAuth refresh replaces saved token/expiry/scope records, and forgetting/sign-out removes the record. New saves/sign-ins have a Remember checkbox; session-only connections remain available. Existing memory-only connections require one final reconnect after this upgrade.

SQLite persistence added through bundled sql.js (no external database server/native build tools). `studio.db` stores named projects, current workspace, layout/settings, chat context and media preferences; deduplicated binary assets live under `media/`. Existing `.frame`, recovery and settings files migrate once without modifying originals. Startup restores the workspace automatically and waits for hydration before editing; edits autosave after 300 ms with an acknowledgement in the status bar. Portable `.frame` downloads remain supported. Credentials and in-flight requests remain session-only.

Central Services section added for ChatGPT, ElevenLabs, Flow handoff, Gemini, OpenAI API and Ollama. All credentials now live in one UI; workflow panels retain generation/model controls and link back to Services. Account sign-in is primary, keys secondary. Verified connection checks and last-request outcomes stay separate from credential presence. ElevenLabs subscription usage is read from its official API; unavailable balances link to provider dashboards rather than showing guessed limits. Provider selection is retained on errors, with no automatic paid fallback or generation retries.

Production workflow added: portable storyboard with script-preserving local/AI planning, independent scene sources, scene strip, approval locks, reusable typography layouts, shared creative direction, hard-cut master composition, managed audio clips, original synthesized SFX/music presets, waveform decoding, narration timing fit and FFmpeg audio mixing. Optional ElevenLabs voice/SFX and Gemini reference-image adapters use session-only credentials. Mascot references, identity notes and variants stay in projects; Google Flow uses an explicit copy-prompt/open/import handoff. See README.md for usage and current limits.

ChatGPT account integration added: official loopback OAuth with PKCE/state/nonce and signed ID-token verification; dynamic client registration and stable host identity; server-memory credentials, serialized renewal and remote sign-out; account model catalog and streamed Responses generation; connection/status/cancel/account-switch controls in the assistant. Live account authorization still requires the user to approve OpenAI's sign-in screen. See README.md and VERIFICATION.md for details.

FrameScript Studio now uses browser-based React and a local Node.js backend. Electron dependencies, IPC, native dialogs and installer scripts have been removed from the active app. Previous desktop artifacts are retained only in ignored `.desktop-backup/`.

Preserved: Monaco editor modes, synchronization, sandboxed preview, timing, assets, examples, visual editing, AI updates/undo, project schema, FFmpeg verification and all six export formats.

Replaced: native IPC with same-origin HTTP APIs; project dialogs with browser upload/download; export destinations with browser downloads; image sequence folders with ZIP downloads; native progress with SSE; encrypted desktop credentials with session-only server memory or environment configuration; Recycle Bin with recoverable local trash.

Data is local under `.framescript/`. Run `npm run dev` and open http://localhost:5173. See README.md for usage and VERIFICATION.md for test results.

Follow-up audit: removed the remaining global browser bridge test hook; AI browser tests now mock HTTP responses. Browser tests use their own server at port 5186, their own data directory, and a separate output directory rather than reusing the user's live app or clearing other test evidence. The development hot-reload socket now binds to loopback and uses PORT + 10000, allowing independent app/test instances. Failed initial API handshakes can be retried. Documentation now distinguishes inactive archived desktop files from active web-app code and explains test prerequisites.
