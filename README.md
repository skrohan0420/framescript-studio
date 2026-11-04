# FrameScript Studio — local web app

React, TypeScript and Monaco run in your browser. A local Node.js server handles projects, AI and Chromium/FFmpeg export. No desktop installation, cloud hosting or paid account is needed for editing and export.

The current workspace focuses on manual editing: paste HTML/CSS/JavaScript in Code, import images in Media and recordings/music/SFX in Audio, then arrange and preview the timeline before exporting. AI assistants, provider setup and storyboard planning are hidden for now. Existing storyboard projects retain their code, audio and clips. Older AI/storyboard sections below describe retained implementation rather than the currently exposed interface.

Project creation defaults to 1080p/30 fps; larger formats remain available. On screens narrower than 980px, the first toolbar control switches the side column between the library and inspector. Importing an image reveals its controls. Create/Rename dialogs support Escape, contain keyboard focus and restore focus when closed. Audio row and clip controls support 0–200% gain; amplified preview playback uses Web Audio.

New edits and portable imports are limited to 90 MB of serialized project data to keep save/export requests below the server limit. Timeline audio instances count toward this budget even when they share a library source. An addition that exceeds the limit preserves the previous project and explains how to reduce size. Existing oversized database workspaces can still be opened and reduced. Disk media deduplication does not eliminate this transport limit.

The Prompts tab provides templates for Canvas animation, motion graphics, explainers, kinetic typography, CSS perspective/parallax and repairing existing code. Fill in narration, duration, visuals, style, framing and on-screen text; use the timeline or narration duration if helpful. Copy the generated prompt into GPT yourself, then use Paste GPT response to open the code-import dialog. Prompts specify FrameScript's deterministic renderFrame(seconds) contract and self-contained output. Repair can include the active code. Draft fields persist in local browser storage; nothing is sent to an AI service automatically.

Additional templates cover data visualization, process diagrams, product showcases, isometric scenes, particles/simulations, map routes, split-screen comparisons and seamless loops. Hover over or keyboard-focus a template for 500 ms to see its explanation and an example. Escape dismisses the tooltip first; selecting a template changes prompt direction, not the current scene.

The prompt builder slides in from the right. Drag its left edge to resize it; the width is remembered in this browser and constrained to the workspace. Focus the resize edge and use Left/Right arrows (Shift for larger steps), Home/End for minimum/maximum width, or double-click to reset to 820px. Cards and navigation adapt to the drawer width, with readable wide-screen text and a compact Copy/Paste footer. Reduced-motion preferences suppress the slide animation.

**Reference look** and **Editing & pacing** have separate labeled sections. Search visual-reference or editorial presets, select a card, and review its full direction and example treatment. Reference look offers Subtle/Balanced/Strong influence and custom visual notes. Editing & pacing offers energy, explicit transition preference and custom beat/hold directions. Explicit transition choices override conflicting preset suggestions; supplied narration cues remain authoritative. Examples are explanatory UI content, not additional script or subjects inserted into the prompt. The Visuals section retains the actual subjects and general art style. Existing selections and new fine-tuning controls persist independently.

In Prompts → Typography, **Include text in this video** is off by default. Saved text settings are excluded until you enable it. Add individual titles, subject labels, callouts, number counters, statistics, lower thirds, captions, quotes, lists, chart labels, timers, dates, watermarks, credits or custom text. Each item has independent content, subject tracking direction, start/end times, frame position, font/size/weight, colors/backing, alignment/spacing, width, entrance/exit and easing. Counters specify from/to values, decimals, prefix and suffix. Items can be disabled, duplicated or removed. A layout/value preview supports scrubbing; tracking and animations are prompt instructions for the generated code, not automatic timeline edits. Quick title/subtitle controls remain available as shared defaults. Invalid required content or timing blocks Copy with a visible explanation. Choices persist, including the off switch; older saved drafts do not implicitly enable text.

Prompts → Mascot is optional and off by default. Enable it to include your mascot, then describe its identity constraints, scene role, actions/expressions, placement, scale and timing. Attach the mascot reference image directly in the LLM chat when pasting the prompt; no reference image, asset ID or URL is needed in this builder. The prompt asks the LLM to use that attachment and create self-contained artwork for the editor. Missing LLM attachments should be requested rather than replaced with an invented mascot. Saved mascot choices persist but are omitted while disabled. Enabling a mascot does not enable on-screen text.

The scene strip is replaced by an active-timeline selector, Add/Remove timeline controls, a duration field and combined preview. Each timeline stores its own code. Audio imported while editing belongs to that active timeline. Main action buttons use icons with accessible names and hover tooltips; code-language tabs and input labels remain readable.

Media provides separate Output frame and Image insertion controls. Output presets/custom width and height support up to 4K UHD (3840×2160), including portrait 2160×3840. Image insertion follows the current frame by default; turn that off for a custom image box, and choose Fit entire image or Fill and crop. Images are centered at the requested size for both button insertion and dragging into the preview. Source image files are not resized or degraded. Apply validates dimensions before changing the frame; Undo can restore frame and code edits.

The export dialog uses resolution presets (480P, 720P, 1080P, 2K, 4K, 8K), common integer frame-rate choices and Higher/Recommended/Smaller-file quality options. Resolution follows the source frame's aspect ratio and uses even dimensions; presets outside the renderer's 7680×4320 limits are disabled. Advanced settings retain custom dimensions, FPS, timing and CRF. Export resolution does not change the editing canvas.

Use the clipboard icon above the code tabs to paste a full HTML document, or paste a document directly into an editor. Inline `<style>` and classic `<script>` contents are split into CSS and JavaScript in one undoable change. Unsupported external scripts, modules and linked styles are rejected with an explanation; the existing code is preserved. Preview JavaScript errors show source line/column and a jump-to-code icon. A failed edit keeps the last working preview visible.

Space toggles playback outside text editors, including from inside the preview. The magnet toggles audio move/trim snapping to the playhead, timeline boundaries, markers and other audio edges; hold Alt during a drag to bypass it. Snapping uses an 8-pixel threshold at the current timeline zoom. Audio clips display a compact filename header and a dense canvas waveform; older recordings are decoded lazily for finer waveform detail.

Drag a visual clip's right edge to change its duration, with snapping and a single Undo step. The scissors button splits the selected audio or the visual under the playhead. Visual splits retain source animation time so the second half continues rather than restarting; attached audio is divided at the cut. Trimming a visual shortens/removes its attached audio outside the new end, and Undo restores both. Save failures show their actual reason with Retry and recovery download; Retry preserves multi-tab conflict protection rather than overwriting newer workspace data.

## Start

The app opens on the project home screen, with Create project, .frame import, a current-workspace shortcut, searchable grid/list views, rename, duplicate and restorable Trash. Named projects save locally without forcing a download. The editor’s Home button saves the current project before returning. Canvas-based scenes can supply a project-cover thumbnail; other projects use a visual placeholder. `/#editor` opens the editing workspace directly.

Export includes a filename field and an optional Choose where to save checkbox. Supported desktop browsers open a native save picker before rendering, then stream the finished export into that file. Other browsers use their download settings. Row and individual audio-clip volume controls adjust the mix; removing a library source leaves existing timeline copies intact. Drag empty timeline space for box selection and use Delete to remove selected clips together; the ruler remains the scrub control.

Typography provides 48 reusable text styles and animations. Drag a style onto the timeline to place a text layer at that time, or use Add to scene. Drag text in the preview to move it; drag its corner handle or Shift+drag to scale. Pixel rulers and alignment guides help position text; hold Alt to bypass snapping. Double-click text in the preview or timeline to edit it directly. Existing text properties save as they change. Text clips have their own timeline rows and support moving, edge trimming, Delete and W to split at the playhead, with Undo. Supported HTML typography styles and Web Animation keyframes are collected automatically after successful scene previews into a library saved in this browser. Canvas text and arbitrary JavaScript text animation cannot be extracted automatically. Added text layers remain embedded in portable projects and render through the same seeking runtime for preview and export.

Audio timeline rows and individual clips have mute controls. Voiceover transcription uses the connected ElevenLabs API key and sends the full source file to the provider. Plain text and timed SRT can be copied or downloaded. SRT uses real word timestamps relative to the source recording; older plain transcripts need re-extraction to obtain timestamps. Live provider transcription is separate from the mocked integration checks.

Audio source recordings are stored separately in the project’s audio library. Cutting or deleting a timeline instance does not duplicate or delete the source. Drag a library waveform onto the timeline to add another instance at the drop time, or use Add to timeline. Existing projects deduplicate their timeline audio into source recordings when opened. Sources are preserved in the database and portable project files.

Checking BGM/SFX in Prompts now requests an actual soundtrack in the generated HTML: one `<script type="application/json" id="framescript-audio">` block containing a `tracks` array. Tracks may contain procedural note scores (frequency, wave, gain and timing) or named built-in presets. Importing the full response synthesizes WAV audio and adds editable music/SFX tracks in the same undoable operation as the scene code. Source scores are bounded to 30 seconds each and 60 seconds total; music can loop for the full scene duration. Updated manifests replace their generated tracks while preserving imported recordings. No API key is needed for procedural synthesis. Regenerate using the updated prompt to include this soundtrack data.

```powershell
cd "D:\FRAMESCRIPT STUDIO"
npm run dev
```

Open **http://localhost:5173**. Keep the terminal running; Ctrl+C stops it. Alternatively, double-click `start-web.cmd`.

For a fresh checkout, install Node.js 22.12 or later, then:

```powershell
npm ci
npx playwright install chromium
npm run dev
```

For a production build running locally:

```powershell
npm run build
npm start
```

Both modes serve React and the API from one local server, bound to 127.0.0.1. A bare Vite server does not provide storage, AI or export. Set PORT before startup to change the default port. Development also uses a loopback-only hot-reload socket at PORT + 10000.

## Use the studio

The main workspace now uses a library/player/inspector layout: **Media, Audio, Script, Scenes, Layouts, Code** tools on the left, the player and transport in the center, contextual project/media/audio controls on the right, and a full-width timeline below. Script and production tools can stay in the left panel; the toolbar Storyboard dialog remains available. Selecting an audio clip opens its controls without seeking. The ruler/scrubber seeks, the timeline zoom slider expands the tracks horizontally, and images can be dragged from the library into the player. Restored storyboards open in master preview. Code loads only when opened.

- **Production workspace** selects the media library; **Code workspace** reveals the editor. The timeline stays below all panels in either mode. Monaco loads on demand and stays unloaded when starting in a saved Production layout until code is opened.
- Audio tracks show their recorded waveform. Drag a clip to move it, drag its edges to trim, or focus its controls and use Left/Right (0.1 seconds; Shift for one second). A drag is one project Undo operation. Locked scenes protect their audio controls. Numeric controls remain in the Voice and SFX & Music panels.
- **Settings → Brand kit** saves a brand name, font and palette with the portable project. AI requests receive this kit; component defaults and new storyboard placeholders use its font, primary color and background.
- Enable **Review AI changes before applying** in Settings for a scrub-able before/after preview with Apply and Discard. Automatic application remains the default. Applying a proposal requires the project to match the revision that generated it.
- **Settings → Recovery history** restores the latest 20 checkpoints. The app checkpoints before project/storyboard replacement and trash/restore actions. **Download recovery copy** saves the current browser workspace even if the local server cannot save it.
- Saves acknowledge the submitted revision. Workspace writes are ordered; editing tabs use a workspace version to detect conflicts. A stale tab stops saving and offers a recovery download before reload instead of silently overwriting newer work.
- Workspace and chat autosave commit together. A validated startup backup can recover a corrupt database; the damaged database is retained as `studio.db.corrupt-<timestamp>`. Backups still require the matching media directory.

- Edit HTML/CSS/JavaScript separately, in synchronized ALL mode, or in a split editor. ALL supports inline styles and classic inline scripts; external/module scripts and unsupported document structures are rejected. Invalid combined edits preserve the separate source.
- Play, pause, step and scrub the preview. Adjust speed, FPS, duration, dimensions, markers, zoom and resizable panels.
- Use the sun/moon button in the toolbar to switch between slate dark and light workspace themes. The selected theme persists and applies to Monaco, panels and dialogs. Blue indicates active controls; keyboard focus has a visible outline.
- Import or drop images. The asset + button inserts an image; the sparkle attaches it to an AI request. Project assets use portable `asset://<id>` references.
- Select elements with unique source IDs to edit styles and text. Drag to move; Shift+drag resizes. Dynamic elements without a source match remain inspection-only. Visual changes support project undo.
- Open ten editable scenes from Examples.
- Save and Ctrl+S apply the code and save the project locally. In Manual save mode, the preview and export use the last applied code while the editor shows an Unsaved code indicator. Use Project settings → Save copy as .frame to download a portable copy.
- Startup automatically restores the SQLite workspace. Legacy recovery can appear in a nonblocking banner if no workspace exists. Restore or dismiss it once; the same snapshot stays acknowledged in that browser even after refreshing, while a changed autosave can prompt again. Dismissal preserves the recovery file on disk. Export HTML source downloads a standalone scene with embedded assets and playback runtime.
- Export MP4/H.264, MKV/H.264, WebM/VP9, GIF, PNG sequences in a ZIP, or one PNG at the current timeline time. Resolution, FPS, duration, speed, CRF, fitting and supported transparency are configurable. The browser handles the download location.

Shortcuts: Ctrl+S saves, Ctrl+Shift+S duplicates, Ctrl+Enter runs preview or generates inside the AI composer, Ctrl+Alt+Z undoes a project change. Monaco retains its normal editor shortcuts.

## Script-to-video workflow

Click **Storyboard** in the toolbar. Your current animation becomes Scene 1 without replacing its code.

The recommended **audio-first path** is:

1. Paste the script in **Script**, then choose **Generate narration first**.
2. In **Voice**, keep **Narration scope → Full script** and generate with the existing ElevenLabs connection, or use the dedicated **Import audio** section: choose audio files or drop recordings into its upload area. Import works without an account or key and supports browser-decodable audio up to 30 MB per file. The browser decodes the real audio duration. The current voice provider accepts up to 10,000 characters per generated take; longer scripts can use scene takes or an imported recording.
3. Click **Compose scenes from this narration**. The script stays intact, the full audio remains one master track, and scene durations total its playable length. Boundaries are proportional to narration text, not detected word timestamps; listen and refine cuts manually. If the script changes after the take, regenerate or import narration before composing it.
4. Generate/edit scene visuals. AI visual generation preserves narration-controlled scene duration. **Fit existing scenes to this narration** retimes existing visuals after a replacement full-script take without replacing their code. Separate scene takes automatically fit their scene; previous takes in the same scope are muted. Mute master narration before adding separate scene voices to avoid double narration.
5. Add SFX at the playhead and music across the master timeline, then **Master preview → Export**. Audio additions and visual changes remain separate; changing visuals does not regenerate speech.

The scene-first controls below remain available when you want to plan before recording:

1. In **Script**, paste your narration and set the shared visual direction. **Split locally** creates a rough plan without an account. **Suggest scenes with AI** uses the provider/model selected in the assistant. AI plans must preserve the complete narration in order; invalid plans leave existing scenes intact. Confirm replacement only after saving anything you want to keep: replacing the storyboard also removes its old scene audio, while retaining master audio. Project Undo restores both.
2. In **Scenes**, review titles, narration, visual directions and estimated durations. Reorder, duplicate, add or remove scenes. **Edit scene** opens its own HTML/CSS/JS in the editor; the scene strip switches between scenes. The assistant receives the selected scene and shared direction. **Generate scene** creates or replaces the selected scene with a visual animation in one click; **Edit scene** opens its existing source and inline narration/direction controls. Generation defaults to imagery without on-screen text and preserves other scenes and audio. Approve/lock finished scenes to protect their code and timing. Undo is project-wide.
3. In **Components**, choose headline, quote, bullet, statistic or mascot layouts, then edit text, font and color. Applying a component replaces the selected scene's code and supports Undo. These presets work without another AI request.
4. In **Audio**, import narration, SFX or music, or use eight original synthesized SFX/music presets. Clip controls set source trim, timeline start/length, gain, fades, looping, mute and scene/master scope. Waveforms come from the actual audio. A new narration take mutes the previous take for that scene. **Fit scene to this narration take** adjusts timing. Background music automatically ducks beneath active narration. Imported recordings retain a usage-rights/attribution field.
5. Use **Master preview** to scrub/play the entire sequence. Export while in master mode for the full video, or in scene mode for the selected scene. MP4, MKV and WebM mix the audio; GIF, PNG, PNG sequences and exported HTML are silent. Save `.frame` to retain the storyboard, independent sources, embedded images and audio.

This first workflow supports up to 30 scenes and ten minutes, with hard cuts. It does not include transition blending, word-aligned captions, general video-layer compositing or a professional stock-music catalog. Local rendering works without AI or media-service keys.

### Mascot variants and Google Flow

In **Mascot & images**, upload your existing character's reference images, give it a name and record identity constraints: face, proportions, palette, outfit and art style. Select the references and choose a pose/expression preset or write your own variation.

- **Google Flow handoff:** copy the generated prompt, open Flow, supply the same references there, generate/download your variant, then **Import variants** and **Use in scene**. There is no automatic Flow login or private API integration. Flow supports reusable character references and downloadable assets in its [official workflow](https://support.google.com/flow/answer/16935308?hl=en).
- **Direct generation:** optionally connect a Gemini API key and load an image-capable model. Generation sends the variation prompt and selected PNG/JPEG/WebP reference files to the [official Gemini image API](https://ai.google.dev/gemini-api/docs/image-generation), then stores the returned image as a project asset. SVG imports work locally but must be converted to a supported raster format before being sent as generation references. API access/billing is separate from using Flow; no subscription entitlement is assumed.

Reuse approved variants across scenes instead of generating them again. Reference conditioning guides consistency; inspect generated variants before using them. Gemini keys can be remembered with Windows-protected encryption in Services, or set GEMINI_API_KEY before startup. Keys are never included in saved projects.

### ElevenLabs narration

Connect ElevenLabs in **Services**, then expand **ElevenLabs voice & sound generation** in Audio, load voices, and select a voice/model. Eleven v4 is the default; account models are loaded from the provider. Generate the selected scene's narration, then fit its duration to the returned take. SFX generation is separate; visual edits do not regenerate audio. This uses the [official ElevenLabs TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) and [sound-generation API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert), with your provider access and credits. Use remembered/session-only key entry or ELEVENLABS_API_KEY in the server environment. Generation supports cancellation and a three-minute timeout. Live account generation requires your credentials and has not been verified by automated tests.

## Local data

The ignored `.framescript/` directory contains `studio.db` (SQLite), `media/` (deduplicated image/audio files), `projects/` (portable `.frame` exports), `exports/` and recoverable `trash/`. SQLite runs inside Node through the bundled sql.js WebAssembly library; no database installation or separate server is needed. Startup creates the database automatically and imports existing projects, settings and recovery once, preserving originals. The last workspace restores automatically after reload, including scene code, narration, assets, audio and chat. Edits autosave after a short pause; wait for **Workspace saved locally** before closing or refreshing. Editor layout/provider/model and media preferences are saved in SQLite. Undo/redo stacks and in-flight generation remain session-only. Remembered connections restore after Node restarts; session-only credentials require reconnecting. FRAMESCRIPT_DATA_DIR selects another data directory. Back up the entire `.framescript/` directory with Node stopped: the database and media belong together. A startup database copy is kept as `studio.db.startup-backup`, which also depends on the media folder. Local render copies expire after seven days, checked at startup and hourly. Settings → Rendered files shows retained size and can clear completed copies while preserving active renders/downloads. Clearing removes their local download links; files saved to a chosen destination are unaffected. Prefer one active editing tab; stale editing tabs detect workspace conflicts and offer a recovery download before reload.

## AI

### Services & connections

Open **Services** in the top toolbar (also available through the assistant account button, Settings, and audio/image workflow controls). This is the single place for ChatGPT sign-in, ElevenLabs/Gemini/OpenAI API keys, connection checks, usage links and credential removal. Account sign-in is the primary option where supported; API keys live in a secondary expandable section. Provider website links open separately; website sign-in alone does not authorize ElevenLabs or Gemini generation APIs.

**Refresh usage & status** checks configured connections with read-only provider requests; it does not generate assets. Checks show a timestamp and distinguish a saved credential from a verified connection. ElevenLabs subscription read permission enables used/remaining included credits and the reset date through its [subscription API](https://elevenlabs.io/docs/api-reference/user/subscription/get). Restricted keys can still generate audio when subscription reads are denied; usage then shows unavailable. Audio generation invalidates the cached balance until the next refresh. Model costs and any enabled overages mean a credit balance is not a guaranteed number of generations.

ChatGPT plan balances, Google Flow credits, Gemini project quotas and OpenAI API account balances are not read by these integrations. Their cards explicitly show **Unavailable** and link to the provider dashboard. Ollama has local capacity rather than a hosted credit balance. Generation failures keep the chosen service and mark its status for attention; check or reconnect that service before retrying. No automatic switch to separately billed API access or automatic generation retries occurs.

Enable **Remember new connections on this Windows account** before saving a key or signing in with ChatGPT. API keys and OAuth tokens are encrypted with Windows DPAPI CurrentUser and stored separately in `.framescript/credentials/<browser-session>.dpapi`, outside SQLite and projects. A persistent HttpOnly local cookie selects the credential record after restart. ChatGPT refresh updates the saved rotating tokens. **Forget connection** removes a saved API key; **Sign out** removes saved ChatGPT tokens and attempts remote revocation. Unchecking Remember applies to new saves/sign-ins; it does not erase existing saved records. Environment keys must be removed in the server configuration. Remembering credentials is supported on Windows; no plaintext fallback is used. Copying the encrypted file to another Windows account is not a portable credential backup. Clearing browser cookies loses the association with the saved connection, requiring a new sign-in/key entry.

### Connect a ChatGPT account (no API key)

Open **Services → ChatGPT → Continue with ChatGPT**. Allow the sign-in tab to open, sign in on OpenAI's website, and authorize ChatGPT plan usage. Return to FrameScript Studio after the callback confirms connection. Services shows the account and provides Sign out and Manage usage controls. Select ChatGPT and an available model in the assistant. Enter a prompt and send it to generate or revise HTML/CSS/JavaScript automatically, with project undo.

This uses the [official local-app authorization flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) and [streamed Responses API](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference). Eligible ChatGPT plans and authorization are required; plan limits and availability apply. This is not unlimited free API access. The API-key provider remains a separate option and is never used as an automatic paid fallback.

During generation, the composer shows elapsed time and streamed progress (model preparation, received code characters, validation). The scene is applied only after the complete response validates. The response reader finishes at the terminal completed event rather than waiting for the connection to close. Model generation itself can still take time; the stop button cancels the request.

Generation progress appears as an assistant card in the chat with live stages, elapsed time, received character count and Cancel. Its activity bar is indeterminate because total response length is unknown. Provider, model, account status and refresh share one compact row. Click the account icon to open Services for account details, usage links, account switching and sign-out.

Access, refresh and ID tokens are never returned in status responses, logged or saved to project files. Remembered tokens are encrypted with Windows DPAPI and restored after restart, with automatic token refresh when needed. Otherwise, tokens remain in memory only. Stable device host ID and account registration metadata are stored separately under `.framescript/`. One account is active per browser session; use **Use another account** or **Use a different account** for fresh authorization. Pending sign-in expires after five minutes and can be cancelled. Sign out attempts remote session revocation and reports if it could not confirm it. Manage usage opens ChatGPT's settings.

Live authorization requires you to complete the OpenAI consent screen. Automated checks use a simulated provider with cryptographic test tokens; they do not verify eligibility or live generation with your account.

Install and run [Ollama](https://ollama.com/), pull a code-capable model appropriate for your hardware, then select Ollama and refresh models. Example: `ollama pull qwen2.5-coder:7b`. The Node server connects to localhost:11434, so the browser does not need direct access to Ollama.

Prompts receive existing source/settings, storyboard metadata, asset identifiers, recent conversation, selection and errors. Embedded audio and other scenes' code are omitted from AI context. Only explicitly attached reference images are sent for vision analysis. Ollama model capabilities are checked before image requests. Responses are schema-validated partial updates, applied automatically with snapshots and undo. Responses are rejected if source changes during generation. Fix with AI performs one user-triggered repair. Requests support cancellation and a three-minute timeout. Image generation uses the separate optional Gemini connection described above.

Optional OpenAI uses a separately billed API account. Enter a key in Services for this server session, or supply OPENAI_API_KEY in the server environment. Remembered keys are encrypted by Windows; session-only keys remain in Node memory until restart. Keys are never returned by the API. Choose a Chat Completions model supporting JSON mode. The adapter follows the [official API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). Do not put credentials in project source. Live model quality and account compatibility require your own provider installation/account.

### Export clips from multiple timelines

Select a timeline, open Export, choose its filename/settings and start rendering. Minimize with the minus icon, switch timelines and open Export again to submit the next clip. The floating Exports box lists every clip with its timeline, progress, queue state and independent cancel/details controls. Completed clips remain listed with Download and Dismiss buttons; the plus button opens export settings for the current timeline.

Two exports can render concurrently across the local server. Additional submissions wait in order, with at most ten active/queued jobs per browser. Each job uses the project/timeline snapshot and settings captured at submission, so editing or switching timelines does not change earlier exports. Downloads occur as clips finish; use each completed row's Download button if the browser blocks automatic multiple downloads. Keep the browser tab open; queue recovery after reload/server restart is not supported.

## Timing and export

MP4/MKV exports automatically test hardware H.264 encoding at the requested dimensions and frame rate, using Intel Quick Sync, NVIDIA NVENC or AMD AMF when available. A failed hardware encode retries with software encoding. Advanced settings → Encoding can force CPU encoding. Hardware quality controls differ from software CRF, so compression and file size can vary. Resolution, frame rate, duration and frame sampling are preserved.

Compatible native-resolution, opaque 2D canvas videos now use direct lossless frame transfer automatically at 1080p or above. Each frame is checked for overlays and compositing effects; unsupported scenes restart using the selected screenshot mode. Other opaque MP4/MKV/WebM exports default to Faster video export, which captures maximum-quality JPEG frames. Choose Rendering → Lossless frame capture to avoid that additional lossy compression. Transparent exports, GIFs and PNG/sequence outputs use PNG; quality-zero video uses lossless PNG or compatible direct capture. Deterministic seek exports use a bounded pool of render pages (up to two at 4K), with ordered frames and backpressure to limit memory. Replay mode, network-enabled projects and PNG snapshots stay sequential. Cancellation closes all render pages and removes partial files. See [export performance and reproducible 4K/60 benchmarks](EXPORT_PERFORMANCE.md). `npx tsx scripts/benchmark-export.ts optimized` still runs the one-second benchmark; `optimized-software` measures the CPU encoder path.

CSS/Web Animations are sought through currentTime. For deterministic JavaScript or Canvas, derive all state from time:

```javascript
window.renderFrame = (timeInSeconds) => {
  // Render complete state for this timestamp.
};
```

Preview and export share this runtime. Frame i samples source time `i / fps * speed`; duration is `duration / speed`, rounded up to an output frame. A Node worker controls Chromium through Playwright and streams captured frames to FFmpeg with backpressure. Progress uses Server-Sent Events. Videos are decode-validated before finalization; cancellation removes partial output. PNG sequences are packaged into a streaming ZIP.

Arbitrary timers, rAF loops, media, GIFs and libraries without a seek contract cannot guarantee accurate scrubbing. Replay export advances the browser clock sequentially, but network operations, randomness and decoder clocks can remain nondeterministic. Master scenes use local seek timing through the same runtime; use seekable animations for reliable composition. H.264 cannot preserve alpha. PNG sequences are the reliable transparency interchange format; VP9 alpha playback depends on the player. MOV and full keyframe editing remain outside this version. Managed audio clips are mixed separately through FFmpeg; arbitrary audio tags inside generated scene code are not mixed.

## Safety and troubleshooting

Animation code executes in an iframe sandbox without same-origin access, Node, filesystem or a server bridge. Its network access is disabled by default. API writes require an app header and same-origin checks; null/cross-origin calls from the preview are rejected. Loopback binding and Host validation restrict this to the local workstation. Download tokens are session-scoped. This is not a public multi-user hosting service. Browser code can still consume CPU/memory; an infinite loop may require reloading the tab.

- Connection refused: keep the Node server running and open its printed localhost URL.
- Port occupied: stop the previous server or set PORT to a free port.
- Missing rendering browser: run `npx playwright install chromium`.
- Missing FFmpeg: reinstall dependencies; ffmpeg-static supplies it. Check antivirus quarantine.
- Ollama unavailable: start it, install a model and refresh. Check its `/api/tags` endpoint.
- Export download missing: inspect your browser's downloads and permissions. PNG sequences download as ZIPs.

## Checks and structure

```powershell
npm run build
npm test
npm run test:e2e
npm run test:integration
npm run test:workflow
npm run test:server
```

Build before running the server checks or production browser checks: they launch the compiled server and renderer. Browser tests start their own instance on port 5186 and store fixtures under a unique `test-results/browser-data-*` directory; API checks use port 5187 and timestamped directories. They do not reuse your running app on port 5173. Production browser checks: `$env:FRAMESCRIPT_TEST_PRODUCTION="1"; npm run test:e2e`. Unset that variable afterward to return to development-mode tests.

Tests cover source synchronization, AI schemas/partial edits/undo and mock transport, actual preview/timeline behavior, assets, browser project downloads/reopen, MP4 downloads, video metadata at different speeds, all six output formats, cancellation and local HTTP security/storage. Workflow checks cover independent scenes, narration preservation, mascot imports, reusable components, actual audio decoding/waveforms, master switching/embedded images, audible FFmpeg mixes at different speeds and mix cancellation. Additional regressions cover delayed-save edits, stale tabs, recovery restoration, failed disk writes, corrupt startup databases, playback subscriptions, waveform edits and optional AI review. Media-provider tests simulate responses; they do not make billable live requests. Artifacts live in `test-results/`. Browser runs use a unique data directory; set `FRAMESCRIPT_TEST_DATA_DIR` to select one explicitly. GitHub Actions runs build/unit checks and a separate production-browser/media job on Node 22.

`src/` contains React, Monaco, dialogs, state and the HTTP client. `shared/` contains schemas, examples and timing. `server/` contains local APIs, storage, AI and export workers. `scripts/` builds and launches the app.

The old desktop code and installer still exist in ignored `.desktop-backup/`: `electron/`, `dist-electron/`, `release/`, icon/browser resources in `build/`, and old desktop setup/test scripts. These are retained backups, not dependencies, build inputs or launch targets. `electron-to-chromium` in the lockfile is browser compatibility data used by frontend tooling, not the Electron runtime. Portable `.frame` projects remain compatible.

Gemini can also generate scene HTML/CSS/JavaScript and suggest storyboards: add a Google AI Studio key in Services, select Gemini in the assistant, refresh models, and choose a text model (Flash models appear first). Free-tier access varies by model and Google project; billing-enabled projects can incur charges. The app does not automatically switch providers after a quota error.

Browser test maintenance: `tests/*.spec.ts` targets the current manual editor. Historical AI/storyboard UI scenarios are preserved as `tests/*.legacy.ts` and are not collected by Playwright. See [tests/README.md](tests/README.md) for scope.

## Animation techniques and procedural 3D

Prompt builder → Animation offers 2D, 2.5D and Three.js rendering, eight combinable techniques, per-technique timing/variation/direction and shared intensity, easing and narration synchronization. Hover/focus examples appear after 500ms. Drafts persist locally; choices guide generated code and do not alter an existing scene. Typography remains opt-in.

For a working example select 3D, copy the starter and use Paste code. Three.js is bundled locally by scripts/prepare-three.mjs during install, dev, build and test. Scenes referencing THREE or FrameScript3D receive the same offline library in preview, nested scenes and exported documents. No network setting or CDN is required. FrameScript3D.create({canvas,width,height,background}) returns scene, camera, renderer, render and dispose; call render() after setting absolute transforms in window.renderFrame(t). The helper uses preserved WebGL buffers and pixel ratio 1. WebGL2 support is required. Existing 2D scenes do not embed the library.

This release supports procedural geometry and core Three.js. Imported GLB models, addons, rigged-character tooling, physics and interactive 3D object editing are future work. Three.js is MIT licensed; its license is retained in the generated runtime. The video exporter uses browser compositor capture for 3D rather than the Canvas 2D raw-pixel optimization.

## Export performance and diagnostics

Long direct-canvas exports now use bounded HTTP/2 streaming to avoid Chromium Blob-quota failures and costly full PNG restarts. Short compatible clips retain the existing fast path. Resolution, FPS, effects and antialiasing are preserved.

Export → Advanced offers **Reuse rendered frames** for deterministic offline projects and **Hardware graphics · Windows** for explicit GPU rendering. Caching reuses unchanged completed files exactly and can reuse frames from unchanged built-in scenes; the first cache fill may be slower. Cache budgets total 2 GiB per workspace, with seven-day expiry. Frame caching uses lossless PNG/direct capture even if Faster mode was selected. Completed jobs expose phase timings, encoder/GPU, cache hits and fallback reasons under **Render details** in the export dock.

WebCodecs/Mediabunny and worker-sampling prototypes remain developer-only because the measured quality/speed gates did not justify enabling them automatically. Mediabunny's MPL-2.0 license notices are retained in its generated browser bundle; the package source/version is available through the lockfile and upstream package.

See [4K/60 benchmark results and reproduction](EXPORT_BENCHMARK_4K60_2026-11-03.md) for measured wins, rejected experiments, limitations and source-frame checks.
