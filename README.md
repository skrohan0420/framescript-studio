# FrameScript Studio — local web app

React, TypeScript and Monaco run in your browser. A local Node.js server handles projects, AI and Chromium/FFmpeg export. No desktop installation, cloud hosting or paid account is needed for editing and export.

## Start

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

- Edit HTML/CSS/JavaScript separately, in synchronized ALL mode, or in a split editor. ALL supports inline styles and classic inline scripts; external/module scripts and unsupported document structures are rejected. Invalid combined edits preserve the separate source.
- Play, pause, step and scrub the preview. Adjust speed, FPS, duration, dimensions, markers, zoom and resizable panels.
- Use the sun/moon button in the toolbar to switch between slate dark and light workspace themes. The selected theme persists and applies to Monaco, panels and dialogs. Blue indicates active controls; keyboard focus has a visible outline.
- Import or drop images. The asset + button inserts an image; the sparkle attaches it to an AI request. Project assets use portable `asset://<id>` references.
- Select elements with unique source IDs to edit styles and text. Drag to move; Shift+drag resizes. Dynamic elements without a source match remain inspection-only. Visual changes support project undo.
- Open ten editable scenes from Examples.
- Save creates a copy in the server project directory and downloads a portable `.frame` file. Open uses the browser file picker. Recent server projects appear in Examples. Save As duplicates; edit the title to rename. Moving a saved project to trash preserves downloaded copies.
- Startup offers autosave recovery in a nonblocking banner. Restore or dismiss it once; the same snapshot stays acknowledged in that browser even after refreshing, while a changed autosave can prompt again. Dismissal preserves the recovery file on disk. Export HTML source downloads a standalone scene with embedded assets and playback runtime.
- Export MP4/H.264, MKV/H.264, WebM/VP9, GIF, PNG sequences in a ZIP, or one PNG at the current timeline time. Resolution, FPS, duration, speed, CRF, fitting and supported transparency are configurable. The browser handles the download location.

Shortcuts: Ctrl+S saves, Ctrl+Shift+S duplicates, Ctrl+Enter runs preview or generates inside the AI composer, Ctrl+Alt+Z undoes a project change. Monaco retains its normal editor shortcuts.

## Script-to-video workflow

Click **Storyboard** in the toolbar. Your current animation becomes Scene 1 without replacing its code.

1. In **Script**, paste your narration and set the shared visual direction. **Split locally** creates a rough plan without an account. **Suggest scenes with AI** uses the provider/model selected in the assistant. AI plans must preserve the complete narration in order; invalid plans leave existing scenes intact. Confirm replacement only after saving anything you want to keep: replacing the storyboard also removes its old scene audio, while retaining master audio. Project Undo restores both.
2. In **Scenes**, review titles, narration, visual directions and estimated durations. Reorder, duplicate, add or remove scenes. **Edit scene** opens its own HTML/CSS/JS in the editor; the scene strip switches between scenes. The assistant receives the selected scene and shared direction. Use its scene-generation suggestion for custom animation. Approve/lock finished scenes to protect their code and timing. Undo is project-wide.
3. In **Components**, choose headline, quote, bullet, statistic or mascot layouts, then edit text, font and color. Applying a component replaces the selected scene's code and supports Undo. These presets work without another AI request.
4. In **Audio**, import narration, SFX or music, or use eight original synthesized SFX/music presets. Clip controls set source trim, timeline start/length, gain, fades, looping, mute and scene/master scope. Waveforms come from the actual audio. A new narration take mutes the previous take for that scene. **Fit scene to this narration take** adjusts timing. Background music automatically ducks beneath active narration. Imported recordings retain a usage-rights/attribution field.
5. Use **Master preview** to scrub/play the entire sequence. Export while in master mode for the full video, or in scene mode for the selected scene. MP4, MKV and WebM mix the audio; GIF, PNG, PNG sequences and exported HTML are silent. Save `.frame` to retain the storyboard, independent sources, embedded images and audio.

This first workflow supports up to 30 scenes and ten minutes, with hard cuts. It does not include transition blending, word-aligned captions, a draggable multitrack audio editor or a professional stock-music catalog. Local rendering works without AI or media-service keys.

### Mascot variants and Google Flow

In **Mascot & images**, upload your existing character's reference images, give it a name and record identity constraints: face, proportions, palette, outfit and art style. Select the references and choose a pose/expression preset or write your own variation.

- **Google Flow handoff:** copy the generated prompt, open Flow, supply the same references there, generate/download your variant, then **Import variants** and **Use in scene**. There is no automatic Flow login or private API integration. Flow supports reusable character references and downloadable assets in its [official workflow](https://support.google.com/flow/answer/16935308?hl=en).
- **Direct generation:** optionally connect a Gemini API key and load an image-capable model. Generation sends the variation prompt and selected PNG/JPEG/WebP reference files to the [official Gemini image API](https://ai.google.dev/gemini-api/docs/image-generation), then stores the returned image as a project asset. SVG imports work locally but must be converted to a supported raster format before being sent as generation references. API access/billing is separate from using Flow; no subscription entitlement is assumed.

Reuse approved variants across scenes instead of generating them again. Reference conditioning guides consistency; inspect generated variants before using them. Entered Gemini keys stay in Node memory, or set GEMINI_API_KEY before startup. Keys are never included in saved projects.

### ElevenLabs narration

Expand **ElevenLabs voice & sound generation** in Audio, enter your API key, load voices, and select a voice/model. Eleven v4 is the default; account models are loaded from the provider. Generate the selected scene's narration, then fit its duration to the returned take. SFX generation is separate; visual edits do not regenerate audio. This uses the [official ElevenLabs TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) and [sound-generation API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert), with your provider access and credits. Use session-only key entry or ELEVENLABS_API_KEY in the server environment. Generation supports cancellation and a three-minute timeout. Live account generation requires your credentials and has not been verified by automated tests.

## Local data

The ignored `.framescript/` directory contains `projects/`, `exports/`, recoverable `trash/`, `recovery.frame` and `settings.json`. FRAMESCRIPT_DATA_DIR selects another data directory. Projects and settings survive server restarts. Download links last for the browser session and server lifetime; export files remain on disk after links expire. Export storage does not expire automatically. Use one active editing tab per browser session.

## AI

### Connect a ChatGPT account (no API key)

Choose **ChatGPT · account** in the assistant and click **Continue with ChatGPT**. Allow the sign-in tab to open, sign in on OpenAI's website, and authorize ChatGPT plan usage. Return to FrameScript Studio after the callback confirms connection. The panel shows the account, loads its available models, and provides Sign out and Manage usage controls. Enter a prompt and send it to generate or revise HTML/CSS/JavaScript automatically, with project undo.

This uses the [official local-app authorization flow](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) and [streamed Responses API](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference). Eligible ChatGPT plans and authorization are required; plan limits and availability apply. This is not unlimited free API access. The API-key provider remains a separate option and is never used as an automatic paid fallback.

During generation, the composer shows elapsed time and streamed progress (model preparation, received code characters, validation). The scene is applied only after the complete response validates. The response reader finishes at the terminal completed event rather than waiting for the connection to close. Model generation itself can still take time; the stop button cancels the request.

Generation progress appears as an assistant card in the chat with live stages, elapsed time, received character count and Cancel. Its activity bar is indeterminate because total response length is unknown. Provider, model, account status and refresh share one compact row. Click the account icon to open account details, usage settings, account switching and sign-out in a dropdown.

Access, refresh and ID tokens stay in Node memory and are not returned to the browser, logged, or saved to project files. Sign in again after restarting the Node server. Only the stable device host ID and latest account registration metadata (issued client ID and validated account label/identity) are stored under `.framescript/`. One account is active per browser session; use **Use another account** or **Use a different account** for fresh authorization. Pending sign-in expires after five minutes and can be cancelled. Sign out attempts remote session revocation and reports if it could not confirm it. Manage usage opens ChatGPT's settings.

Live authorization requires you to complete the OpenAI consent screen. Automated checks use a simulated provider with cryptographic test tokens; they do not verify eligibility or live generation with your account.

Install and run [Ollama](https://ollama.com/), pull a code-capable model appropriate for your hardware, then select Ollama and refresh models. Example: `ollama pull qwen2.5-coder:7b`. The Node server connects to localhost:11434, so the browser does not need direct access to Ollama.

Prompts receive existing source/settings, storyboard metadata, asset identifiers, recent conversation, selection and errors. Embedded audio and other scenes' code are omitted from AI context. Only explicitly attached reference images are sent for vision analysis. Ollama model capabilities are checked before image requests. Responses are schema-validated partial updates, applied automatically with snapshots and undo. Responses are rejected if source changes during generation. Fix with AI performs one user-triggered repair. Requests support cancellation and a three-minute timeout. Image generation uses the separate optional Gemini connection described above.

Optional OpenAI uses a separately billed API account. Enter a key in Settings for this server session, or supply OPENAI_API_KEY in the server environment. Entered keys remain in Node memory until restart; they are not written to files or returned by the API. Choose a Chat Completions model supporting JSON mode. The adapter follows the [official API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create). Do not put credentials in project source. Live model quality and account compatibility require your own provider installation/account.

## Timing and export

CSS/Web Animations are sought through currentTime. For deterministic JavaScript or Canvas, derive all state from time:

```javascript
window.renderFrame = (timeInSeconds) => {
  // Render complete state for this timestamp.
};
```

Preview and export share this runtime. Frame i samples source time `i / fps * speed`; duration is `duration / speed`, rounded up to an output frame. A Node worker controls Chromium through Playwright and streams PNG frames to FFmpeg with backpressure. Progress uses Server-Sent Events. Videos are decode-validated before finalization; cancellation removes partial output. PNG sequences are packaged into a streaming ZIP.

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

Build before running the server checks or production browser checks: they launch the compiled server and renderer. Browser tests start their own instance on port 5186 and store fixtures under `test-results/browser-data`; API checks use port 5187 and timestamped directories. They do not reuse your running app on port 5173. Production browser checks: `$env:FRAMESCRIPT_TEST_PRODUCTION="1"; npm run test:e2e`. Unset that variable afterward to return to development-mode tests.

Tests cover source synchronization, AI schemas/partial edits/undo and mock transport, actual preview/timeline behavior, assets, browser project downloads/reopen, MP4 downloads, video metadata at different speeds, all six output formats, cancellation and local HTTP security/storage. Workflow checks cover independent scenes, narration preservation, mascot imports, reusable components, actual audio decoding/waveforms, master switching/embedded images, audible FFmpeg mixes at different speeds and mix cancellation. Media-provider tests simulate responses; they do not make billable live requests. Artifacts live in `test-results/`.

`src/` contains React, Monaco, dialogs, state and the HTTP client. `shared/` contains schemas, examples and timing. `server/` contains local APIs, storage, AI and export workers. `scripts/` builds and launches the app.

The old desktop code and installer still exist in ignored `.desktop-backup/`: `electron/`, `dist-electron/`, `release/`, icon/browser resources in `build/`, and old desktop setup/test scripts. These are retained backups, not dependencies, build inputs or launch targets. `electron-to-chromium` in the lockfile is browser compatibility data used by frontend tooling, not the Electron runtime. Portable `.frame` projects remain compatible.
