# FrameScript Studio rendering: explanation and handoff for Claude

Prepared 2 November 2026. This document is self-contained. Claude has no repository, local file, hardware or execution access; all relevant findings are included below.

## Historical scope

This is the 2 November investigation snapshot, not the current exporter status. Later changes include bounded HTTP/2 transfer for long direct-canvas exports, caching and diagnostics. See [current export diagnostics](README.md#export-performance-and-diagnostics) and the [3 November benchmark](EXPORT_BENCHMARK_4K60_2026-11-03.md). Timing and machine observations below apply to the original experiment.

## What we want

Make 4K/60 fps exports substantially faster while preserving visual quality, frame order, timing, resolution, transparency where supported, audio and cancellation behavior. Increasing hardware utilization is useful only if it reduces export time.

## Simple explanation

Think of the exporter as a production line:

1. The browser draws an animation frame.
2. The app obtains its pixels and sends them to FFmpeg.
3. FFmpeg compresses those pixels into a video using Intel Quick Sync.
4. The app mixes audio when needed and verifies the finished video.

The video compressor is generally keeping up. Producing and moving frames is the slow part. Hardware video encoding does not mean that drawing the animation also uses the physical GPU.

Also distinguish video frame rate from rendering speed: the output contains 60 frames per second, but this machine currently produces roughly 9–10 frames per second in the tested scene. A three-second video therefore takes around 19 seconds to export.

## Application and machine

- Local React interface, Node.js backend, Playwright-controlled headless Chromium and FFmpeg.
- Windows; Intel Core i5-12400, 6 cores/12 logical processors; Intel UHD 730; approximately 16 GiB RAM.
- FFmpeg selects the working `h264_qsv` hardware encoder for these MP4 benchmarks.
- The app already has access to local hardware. Packaging the same implementation into a desktop shell would not by itself eliminate these bottlenecks.

## What has already been improved

The old lossless path was:

`Draw in browser → compress screenshot to PNG → transfer through the browser protocol as base64 → decode PNG in FFmpeg → encode video`

A new direct path now handles compatible scenes:

`Draw in browser canvas → get RGBA pixels → upload a binary Blob through a temporary loopback server → feed raw pixels to FFmpeg → encode video`

This removes PNG compression, base64 transfer and PNG decoding. It still reads pixels into CPU-accessible memory and copies/transfers them. It is not a shared-memory or zero-copy GPU pipeline.

It activates automatically for eligible videos at 1080p or above: deterministic seek timing, networking disabled, output size equal to project size, and one opaque, full-frame sRGB/unorm8 2D canvas without overlays or compositing effects. Every frame is checked. Unsupported scenes restart through the existing screenshot path so content is not silently omitted. Transparent, scaled, replay and network-enabled scenes keep their existing paths.

The selected fallback matters: **Lossless frame capture** uses PNG; **Faster video export** uses JPEG where permitted. JPEG quality 100 still adds intermediate loss. The new direct path is lossless, but the final H.264 encoding remains lossy.

## Measured speed improvement

Scene: three seconds, 3840×2160, 60 fps, 180 frames, animated gradient, particles and text. Same Quick Sync H.264 quality setting of 20 and two workers.

- Old lossless PNG: 40.84 and 42.46 seconds; average **41.65 seconds**.
- New direct capture: 18.91 and 18.22 seconds; average **18.56 seconds**.
- Result: **2.24× throughput, or 55.4% less time**, compared with the previous lossless PNG path.

All 180 decoded frames matched exactly across all four outputs. Separate tests also required direct pixels to equal decoded PNG screenshot pixels at three 4K timestamps. These results establish correctness for the tested cases, not universal equivalence for every possible browser scene.

## Hardware utilization test

A separate monitored test used the same three-second 4K/60 scene, with one trial per worker count:

- **1 worker:** 22.97 seconds; whole-system CPU averaged 29.2%, peaked at 55.1%.
- **2 workers:** 19.50 seconds; whole-system CPU averaged 37.3%, peaked at 57.0%.
- **3 workers:** 19.79 seconds; whole-system CPU averaged 40.5%, peaked at 74.5%.

Two workers performed best in this small test. Three increased activity without a measured speed benefit. These single trials do not establish a statistically certain optimum.

For the two-worker run, export-process GPU 3D engine activity averaged **5.2%**, peaking at **9.8%**. A driver-labelled `VideoDecode` engine averaged 6.7%, peaking at 12.7%. No separate VideoEncode counter was observed. Do not relabel the VideoDecode readings as encoder utilization or add different engine percentages into one overall GPU percentage. Quick Sync use was confirmed independently by the encoder selection.

CPU measurements include background apps and monitoring; idle CPU averaged about 4%. Samples were taken approximately once per second and cover startup and extra frame-hash validation as well as export work. Monitoring itself adds overhead.

## Important GPU finding

A separate probe using the same default headless browser launch, after drawing and capturing a canvas, reported:

- Renderer: **ANGLE SwiftShader**, a software implementation.
- `2d_canvas`: `unavailable_software`.
- `gpu_compositing`: `disabled_software`.
- `rasterization`: `disabled_software`.

Therefore, this browser configuration does not demonstrate physical-GPU canvas rendering. FFmpeg's Quick Sync encoding is a separate working hardware path. Earlier discussion treated hardware canvas acceleration as unverified; the later probe confirmed this software configuration.

## Actual bottleneck and remaining uncertainty

In the monitored two-worker run:

- Frame pipeline wall time: **17.98 seconds**.
- Accumulated waiting for FFmpeg input backpressure: **0.91 seconds**, overlapping capture work.
- Final encoder drain after the last frame: **0.14 seconds**.
- Raw pixel payload: **5.97 GB** for just three seconds of 4K video.

This points to frame production/readback/transfer as the main bottleneck rather than an encoder that cannot accept frames fast enough. Encoding occurs throughout rendering, so the final 0.14 seconds is not the total encoding time. Worker timing sums overlap and must not be added as sequential wall time.

We have not precisely separated drawing, `getImageData`, Blob creation, network transfer, allocation and pipe copies. We also have not measured memory bandwidth or hard page faults.

Available RAM fell to **390 MB** during the two-worker trial. Exporter working sets summed to a peak near 3.37 GB, with possible double counting of shared pages. Memory pressure may contribute, but actual paging was not established.

## What Claude should investigate next

1. Split capture timing into pixel readback, Blob creation/upload, server receipt and FFmpeg writes. Record actual browser GPU capabilities for each benchmark.
2. Test a browser launch/configuration that verifiably uses UHD 730 hardware canvas/compositing. Check the actual reported device and feature status; setting flags alone is not proof. Compare source pixels, encoded quality and total time. Faster GPU drawing may be offset by GPU-to-CPU readback.
3. Reduce allocations and pixel copies. Investigate reusable buffers, native shared memory or a native capture backend where feasible. Preserve ordered frames, bounded memory and backpressure.
4. Longer term, investigate GPU surface transfer directly to Quick Sync. This is a substantial native integration, not a proven speedup or a simple desktop-packaging change. Preserve support for arbitrary HTML/CSS through a fallback.
5. Repeat tests with more free RAM and representative real projects. Keep two workers as the current default unless repeated measurements justify changing it.

Do not lower resolution, frame rate, sampling accuracy or visual quality to manufacture a speedup. Do not assume that 100% CPU/GPU usage is itself the goal. Any implementation will be carried out separately by an agent with local repository access.

## Implementation details for reasoning without source access

The following is simplified pseudocode describing the implementation, not a complete runnable program.

```javascript
// One browser with a viewport matching the output; typically two pages.
browser = await chromium.launch({ headless: true, args: [] });
context = await browser.newContext({
  viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1,
  serviceWorkers: 'block'
});
// Each page loads an isolated generated HTML document.
// Wait for document.fonts.ready and image decoding before rendering.

for (each timestamp assigned to this page) {
  // Seek pauses browser animations and sets their currentTime.
  // User canvas animations implement renderFrame(timeInSeconds).
  await page.evaluate(t => window.__fsSeek(t), timestamp);
  await validateSceneCompatibility(); // repeated after each seek
  // The following executes in the browser:
  const image = canvas.getContext('2d').getImageData(0, 0, width, height);
  // Check alpha is 255 throughout; reject unsupported scenes.
  await fetch(uniqueLoopbackFrameURL, {
    method: 'POST', body: new Blob([image.data.buffer])
  });
}
// Node receives chunks and concatenates them into one frame Buffer.
// One in-flight capture per page; frames are delivered strictly in order.
if (!ffmpeg.stdin.write(frameBuffer)) await drainOrEncoderExit();
```

Each frame is 3840 × 2160 × 4 = 33,177,600 bytes (about 33.2 MB). 180 frames total 5,971,968,000 bytes. Real-time 60 fps would require approximately 1.99 GB/s of pixel payload before accounting for extra copies.

The loopback server binds only to 127.0.0.1 on a temporary port, uses unpredictable per-export URL tokens, checks exact frame size, and closes after the export attempt. The generated document permits that origin through its content security policy. Native Chromium URL blocking allows the specific transfer URL prefix and blocks external network access for this path.

An earlier experiment routed the raw uploads through Playwright request interception. That serialized large request payloads through the browser protocol and was dramatically slower. The working implementation avoids that interception for direct uploads, using native URL filtering instead. Binary Blob uploads also performed much better than passing a bare pixel ArrayBuffer as the request body in the experiments.

FFmpeg receives rawvideo with pixel format rgba, requested frame size and input frame rate. The tested output encoder is h264_qsv with preset veryfast, global_quality 20, look_ahead 0 and pixel format nv12. MP4 output uses +faststart. Encoding happens while frames are being produced. Audio is mixed afterward when needed, copying the existing video stream rather than re-encoding it. The resulting video is decoded for verification before being finalized.

If direct capture becomes incompatible, the partial output is discarded and the entire export restarts using screenshots. Existing hardware-encoder failure handling can retry with software encoding. Replay timing and network-enabled scenes remain sequential. Worker count is bounded by CPU availability and free RAM; the usual default cap is two at 4K.

The browser GPU probe used the same default launch, created a page, drew a canvas, captured a screenshot, then queried SystemInfo.getInfo. Its software-renderer findings above therefore were checked after actual drawing, not just browser startup. This is separate from the working FFmpeg Quick Sync encoder.

## Verification already performed

Production build, 107 tests, rendering/audio integration checks and a compiled-worker 4K/60 smoke test passed after the optimization. Tests cover 4K pixel comparisons, encoded frame order, incompatible styles/overlays, an overlay appearing halfway through an animation, network restrictions and cancellation cleanup. The later hardware audit changed no production settings.

The repeated PNG and direct benchmark outputs shared this SHA-256 of their ordered decoded frame-MD5 records:

`c5bb4dc3acfcdfe6d771335b820610814103bb3b42242b00ff8449c6d3f0aebb`

The raw logs exist locally, but Claude is not expected to open them. Treat the included numbers as reported measurements and clearly identify any conclusions that require new experiments.

## Request to Claude — no repository access required

“Using only this document, explain the likely bottlenecks and propose a prioritized engineering plan to accelerate export without reducing visual quality. Separate measured facts, hypotheses and unknowns. Assess why the headless browser uses SwiftShader, which Windows/Chromium hardware-rendering configurations should be investigated, and whether GPU drawing would help once readback costs are included. Evaluate ways to reduce getImageData, Blob, HTTP, Buffer and FFmpeg transfer copies, including the feasibility and complexity of native GPU-to-Quick-Sync surface sharing. Give concrete profiling experiments, pseudocode where useful, validation criteria, risks and a recommended order of work. You cannot inspect the repository, run benchmarks or claim to have implemented or verified changes. Produce advice that I can hand to the coding agent with local access. Do not assume that adding workers, using Electron or maximizing utilization automatically improves speed.”
