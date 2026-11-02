# Direct canvas export — 2026-11-02

The exporter now automatically tries direct, lossless RGBA transfer for compatible native-resolution 2D canvas videos at 1080p or above. This bypasses screenshot PNG compression, base64 transfer and PNG decoding. FFmpeg still uses the same output encoder, quality setting, dimensions, timestamps and verification.

## Measured 4K/60 result

Synthetic three-second scene: 3840×2160, 60 fps, 180 frames, animated radial gradient, 300 particles and text. MP4, Intel Quick Sync H.264, quality 20, two actual render workers. Hardware: Intel i5-12400, UHD 730, approximately 16 GiB RAM. Node v20.20.2. Each run starts a fresh browser; trials ran sequentially, in PNG/direct/direct/PNG order.

- Previous lossless PNG pipeline: **40.84 s, 42.46 s**; mean **41.65 s**.
- New direct pipeline: **18.91 s, 18.22 s**; mean **18.56 s**.
- **2.24× throughput; 55.4% less wall time** against the previous lossless path.
- Actual render throughput increased from approximately 4.3 to 9.7 frames/second. This is not real-time 60 fps rendering.

Timing includes encoder detection, browser startup, rendering, encoding, verification and cleanup. A subsequent frame-hash check is excluded. These are two runs per path of one synthetic scene, not a general performance guarantee. The comparison is against lossless PNG, not the older lossy JPEG option.

## Quality and correctness

All four benchmark videos decode to exactly 180 frames, 3840×2160, with a 1/60 time base. Every decoded frame matches across all runs. The SHA-256 of the complete ordered frame-MD5 records is:

`c5bb4dc3acfcdfe6d771335b820610814103bb3b42242b00ff8449c6d3f0aebb`

Separate tests compare direct RGBA pixels with decoded browser PNG screenshots at three 4K timestamps and require exact equality. Tests also cover encoded frame order, a mid-animation overlay triggering a complete screenshot restart, CSS effects, scaling, transparent pixels, extra canvases, network blocking and cancellation cleanup. H.264 output remains lossy; the optimization introduces no extra intermediate loss, and these benchmark outputs have identical decoded pixels.

## Eligibility and fallback

Automatic direct capture requires a seek-based, network-disabled, opaque video whose output size equals the project size. Each frame must contain one full-frame, direct-child, opaque sRGB/unorm8 2D canvas, without HTML overlays, clipping, masks, transforms, borders, pseudo-element content or other compositing effects. Canvas attributes, layout, styles and pixel alpha are checked after each seek.

If a frame needs browser compositing, the partial export is removed and the whole video restarts using the original screenshot mode. Transparent, replay, network-enabled, scaled and non-video exports keep the existing path. Lossless mode falls back to PNG; Faster mode retains its existing JPEG fallback. Native loopback URL filtering permits only the per-export transfer capability; a local transient HTTP server is closed when the attempt ends. Raw buffers are bounded by the existing worker pool and encoder backpressure.

This uses binary loopback transfer, not a native zero-copy GPU encoder. It transfers more bytes than PNG but avoids its expensive compression and browser protocol serialization.

## Reproduce

From the repository root in PowerShell:

```powershell
$env:BENCHMARK_DURATION = '3'
$env:RENDER_TUNING = '{"rawCanvas":false,"workers":2}'
npx tsx scripts/profile-export.ts png-comparison
$env:RENDER_TUNING = '{"workers":2}'
npx tsx scripts/profile-export.ts direct-comparison
```

Use unique labels to retain earlier results. The profiler defaults to lossless capture and writes MP4, JSON metrics and decoded frame hashes under `test-results/export-benchmark/`. JSON records actual worker count, encoder, capture transport, bytes, seek/capture/base64 decoding totals, backpressure, encoder drain, verification, wall time and available memory. Worker timing sums overlap; they must not be added to derive wall time.

Evidence: `final-png-3s-run1.json`, `final-png-3s-run2.json`, `final-direct-3s-run1.json`, `final-direct-3s-run2.json`, and their `.framemd5` files in that folder.

Validation: production build; 107 tests across 26 test files; all-format rendering integration; compiled export-worker 4K/60 smoke test. Existing uncommitted work was preserved.
