# Web-app conversion

Production workflow added: portable storyboard with script-preserving local/AI planning, independent scene sources, scene strip, approval locks, reusable typography layouts, shared creative direction, hard-cut master composition, managed audio clips, original synthesized SFX/music presets, waveform decoding, narration timing fit and FFmpeg audio mixing. Optional ElevenLabs voice/SFX and Gemini reference-image adapters use session-only credentials. Mascot references, identity notes and variants stay in projects; Google Flow uses an explicit copy-prompt/open/import handoff. See README.md for usage and current limits.

ChatGPT account integration added: official loopback OAuth with PKCE/state/nonce and signed ID-token verification; dynamic client registration and stable host identity; server-memory credentials, serialized renewal and remote sign-out; account model catalog and streamed Responses generation; connection/status/cancel/account-switch controls in the assistant. Live account authorization still requires the user to approve OpenAI's sign-in screen. See README.md and VERIFICATION.md for details.

FrameScript Studio now uses browser-based React and a local Node.js backend. Electron dependencies, IPC, native dialogs and installer scripts have been removed from the active app. Previous desktop artifacts are retained only in ignored `.desktop-backup/`.

Preserved: Monaco editor modes, synchronization, sandboxed preview, timing, assets, examples, visual editing, AI updates/undo, project schema, FFmpeg verification and all six export formats.

Replaced: native IPC with same-origin HTTP APIs; project dialogs with browser upload/download; export destinations with browser downloads; image sequence folders with ZIP downloads; native progress with SSE; encrypted desktop credentials with session-only server memory or environment configuration; Recycle Bin with recoverable local trash.

Data is local under `.framescript/`. Run `npm run dev` and open http://localhost:5173. See README.md for usage and VERIFICATION.md for test results.

Follow-up audit: removed the remaining global browser bridge test hook; AI browser tests now mock HTTP responses. Browser tests use their own server at port 5186, their own data directory, and a separate output directory rather than reusing the user's live app or clearing other test evidence. The development hot-reload socket now binds to loopback and uses PORT + 10000, allowing independent app/test instances. Failed initial API handshakes can be retried. Documentation now distinguishes inactive archived desktop files from active web-app code and explains test prerequisites.
