# Export improvements and 4K/60 validation

All performance trials use **3840 × 2160, 60 fps**, unchanged effects and antialiasing. Short fixtures contain 120 frames (two seconds); the stress fixture contains 600 frames (ten seconds). Regression tests use smaller fixtures where performance is not being measured.

## Shipped behavior

- Long direct-canvas exports stream raw bytes through a private HTTP/2 loopback connection. Short clips retain the faster existing transfer. Selection uses the planned raw-byte volume per renderer (stream above 3 GiB). This prevents Chromium Blob storage exhaustion from restarting a long render as PNG.
- Export → Advanced → **Reuse rendered frames** enables lossless frame caching and byte-for-byte reuse of an unchanged completed video. Built-in hard-cut compositions key frames independently by scene, local time and referenced assets. Other compositions conservatively key the whole document. Network-enabled/replay scenes bypass caching.
- Cache keys cover runtime/Three.js version, Chromium, graphics backend, OS/font-directory versions, FFmpeg, source, dimensions, fitting, transparency and relevant timing. Completed-video keys also cover audio and encoding options. Frames use checksummed gzip; completed videos use SHA-256 validation. Per-workspace budgets: 1.5 GiB frames + 0.5 GiB video, with seven-day expiry and lazy pruning. Cache failures fall back to rendering. The first cached export can be slower.
- **Graphics acceleration → Automatic** now selects ANGLE/D3D11 for Windows Three.js scenes, with a compatibility retry if GPU initialization fails. Manual hardware and browser-compatibility overrides remain in Advanced. Detail settings stay intact, but GPU-driver rasterization is not guaranteed pixel-identical to software rendering.
- The export dock exposes **Render details**: total time, encoder, workers, graphics backend, cached frames, phase timings, estimated bottleneck and capture fallback reason. Worker timing sums overlap.
- New animation prompts request full-resolution static-layer reuse, shared geometry/materials and instancing for repeated 3D objects. Existing user scenes are not rewritten.

## Hardware and method

Intel i5-12400, UHD 730, approximately 16 GiB RAM; Windows; Node 20.20.2; Chromium 156.0.8078.4; FFmpeg H.264 Quick Sync, quality 20. The regular headless backend reported SwiftShader; explicit hardware graphics reported Intel D3D11. Available RAM varied and is recorded in each JSON result.

Trials run sequentially. Times measure `renderExport`: browser startup, encoder selection, rendering, encoding, verification and cleanup. They exclude process/module startup, queueing, downloads and the extra post-render frame-hash/quality analysis. These are synthetic local tests, not a guarantee for every project or computer. No background test suite ran during timed trials.

## Results used for decisions

### Long export: automatic transport fix

The ten-second Canvas fixture previously hit `ERR_BLOB_OUT_OF_MEMORY`, abandoned the partial direct export and restarted the entire clip through PNG capture.

- Previous fixed-worker path, including that restart: **164.93 s**.
- Streaming direct path, two completed trials: **64.90 s, 71.26 s**; mean **68.08 s**.
- Mean reduction: **58.7%**, or **2.42×** throughput against the observed failing/restarting path. This is not a comparison against an ideal uninterrupted old direct transfer.
- Both new videos and the old reference decode to exactly 600 frames at 3840 × 2160 and 1/60 time base. Every decoded frame matches. Ordered frame-record SHA-256: `f26c79aa355bc5f7e1fc579d4f75f1c53ee15406ab357ddf5d67d1ecb5266434`.

Evidence: `test-results/export-benchmark/reuse-1793701604660/canvas-long-fixed.*`, `long-stream-1.*`, `long-stream-2.*`. The failed Blob/direct-buffer probes are not counted as successful exports. ArrayBuffer uploads without streaming were also rejected after profiling showed excessive browser-protocol request-body overhead.

### Reusing unchanged output

For the two-second clips, completed-video cache hits took:

- Canvas: **0.596 s, 0.567 s**.
- Three.js: **0.578 s, 0.563 s**.
- Mixed Canvas/HTML: **0.583 s, 0.675 s**.

The cache copies a previously verified file, with no new video encoding. Cold cached exports took **21.52 s, 28.18 s, 21.90 s** respectively; those first-run costs include creating the frame cache and are why caching remains opt-in. The corresponding uncached short-clip paths were approximately 12 s for direct Canvas, 24.5 s for Three.js PNG and 21 s for mixed PNG. Do not interpret cache-hit timings as faster first-time rendering.

Evidence: `test-results/export-benchmark/reuse-1793701604660/results.json`; unit tests also compare completed cached files byte-for-byte and verify invalidation.

### Reusing only unchanged scenes

A fresh final-scope two-scene mixed composition produced:

- Cold render/cache fill: **21.33 s**, 0 hits / 120 misses.
- Unchanged frame-cache export with video-file reuse disabled: **3.91 s**, 120 hits.
- Change only the second scene: **7.96 s**, 60 hits / 60 misses.

The unchanged cold/warm videos have matching decoded frame records. The edited output correctly differs. This validates actual per-scene reuse, including multi-line embedded scene documents.

Evidence: `test-results/export-benchmark/scene-reuse-1793702453879/`. The earlier `scene-reuse-1793702327338` run exposed a multi-line scene parser issue and was superseded. The initial matrix's mixed-cache cohort is excluded because encoding configuration changed during development; the fresh final-scope run replaces it.

### Optional hardware graphics

The two-second Three.js fixture rendered through PNG in **25.75 s and 23.16 s** with the browser's software backend, versus **17.61 s and 17.38 s** with Intel D3D11: approximately **28.5%** less time. Both keep 120 frames, 4K resolution, original geometry, materials and antialiasing. Different rasterizers do not produce identical pixel hashes, so this is an explicit option, not a silent automatic change.

## Timeline 2: direct hardware WebGL readback

The actual 34.5664375-second Three.js timeline was exported at 3840 × 2160, 60 fps (2,074 frames), Intel UHD 730 D3D11 graphics, QSV quality 20, one worker, without frame reuse. The saved project was copied for profiling; the user's timeline was not modified.

- Previous JPEG screenshot export: **336.93 s**.
- Direct WebGL `readPixels` → top-down RGBA → private HTTP/2 stream → the same FFmpeg encoder: **309.38 s**. This completed run is **27.55 s / 8.18% faster**, not the larger improvement suggested by short PNG comparisons. These are individual whole-clip trials, not a statistical guarantee.
- Capture/transfer fell from **317.08 s to 278.44 s**. Readback synchronization moves some time into seeking (8.72 s → 22.76 s). Capture remains the bottleneck; 68.81 GB of raw pixels were transferred over loopback, not stored as frames on disk.
- Two-second probes: PNG screenshots 26.93 s; the old WebGL→2D copy path 24.87 s; direct readback 17.54 s with one worker. Two-worker readback trials were 20.91 s (with concurrent type checking, excluded from performance conclusions) and 17.57 s (idle), giving no reliable concurrency win. 4K hardware Three.js direct exports therefore default to one worker, subject to existing safety limits.
- Six full-resolution source captures at 0, 1, 12, 20, 30 and 34.55 seconds exactly match browser PNG pixels (zero differing channels). The completed video was decoded through all 2,074 frames, verifying 3840 × 2160 and 1/60 time base. Its decoded PCM audio SHA-256 matches the old export: `fa9f1c0a8f35cdc43ad49eaffd669d93795fc349d6a00d0ae5ca9df81257237d`.

Direct Three.js capture is selected automatically for Windows Three.js scenes, or with the manual hardware override, subject to runtime eligibility checks. Neutral full-frame wrappers are supported. Effects, overlays, transparency, extra canvases, scaling, non-sRGB buffers, unsupported pixel-pack state and non-preserved WebGL buffers use the browser-compositing fallback. OpenGL framebuffer bindings and pixel-pack alignment are restored after readback. Browser compatibility mode retains software capture; WebCodecs encoding remains off.

Following the automatic-defaults UI update, new exports preserve timeline resolution/FPS, select lossless capture, quality 18 and automatic encoding/graphics. Detailed controls are collapsed under Advanced; JPEG intermediates require an explicit draft selection. The original full-clip benchmark above used quality 20 and is not a measurement of quality-18 encoding time. A compiled-worker 4K/60 smoke confirms that the new automatic defaults select Intel D3D11, direct RGBA capture and QSV without manual tuning (`defaults-smoke.json`). Build, 18 targeted renderer/cache tests and six export browser tests pass.

Evidence: `test-results/timeline2-diagnostic/{hardware,direct-full,verification,source-pixels}.json`, `direct-full.framemd5`, and the six-frame automatic-selection smoke. The source snapshot and videos remain local and ignored by Git. Regression checks: production build; 18 targeted render/cache tests; five export browser tests. The odd-width WebGL test compares decoded pixels and checks GL state restoration and conservative fallback eligibility.

## Experiments deliberately kept off

- **Mediabunny/WebCodecs direct encoding:** built and exercised, but benchmark-only. Canvas trials took 6.46/6.52 s versus PNG's 27.40/27.74 s, but also changed the encoder. Against full-resolution PNG source frames, Canvas SSIM/PSNR changed from 0.997391/51.56 dB to 0.997298/49.31 dB. Three.js PSNR fell from 49.42 to 38.90 dB, despite a slightly higher SSIM. This fails the no-quality-regression gate. A matching CRF/bitrate number is not an equivalence guarantee.
- **Software WebGL direct capture:** the original copy-through-2D implementation matched the tested PNG reference, but was slower on the default software backend (28.69/28.35 s versus PNG's 25.75/23.16 s). Software Three.js exports still retain screenshots. Explicit hardware graphics uses the separately validated direct-readback path above.
- **Worker sampling:** implemented behind `RenderTuning.autoTune`. The ten-second trial did not demonstrate an overall win, so automatic sampling remains off. Normal CPU/RAM limits and bounded worker ordering remain active.
- The Canvas direct-pixel speed advantage over PNG already existed. The new first-export improvement demonstrated here is the long-clip Blob-quota fix; short Canvas exports do not get an invented new speedup.

Initial reference data: `test-results/export-benchmark/matrix-1793700784124/results.json` (27 timed trials), plus the reuse/graphics/stress matrix (13 trials), final scene-reuse trials and transport stress reruns. References and quality logs remain local under `test-results`; they are not committed as large binary assets.

## Reproduction

`npm run benchmark:export` runs the Canvas/Three.js/mixed matrix and source-frame quality checks. `npm run benchmark:reuse` runs completed-output caching, long-clip and graphics comparisons. Both enforce 4K/60; the main matrix defaults to two-second fixtures and its stress runs use ten seconds. `npx tsx scripts/benchmark-scene-reuse.ts` checks a changed scene at 4K/60.

Use new output directories per session. Leave other renderers/tests idle while collecting timing. Inspect actual capture mode, encoder, worker count and fallback reasons in the JSON, rather than assuming the requested path was used.

## Verification

Production build; 143 unit tests; 75 browser tests; all-format export integration; audio/workflow export and cancellation; server security/storage/download checks. Full-resolution direct pixels are compared with browser PNG pixels, and streaming regression coverage forbids creating a Blob during raw transfer. The compiled production worker also rendered and decoded 240 complete 4K/60 frames through the HTTP/2 path (`npx tsx scripts/smoke-render-worker.ts`).

