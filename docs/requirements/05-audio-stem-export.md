# Audio Stem Export and Synchronization

## Goal and dependencies

Export independently usable narration, music and SFX stems with a common start and exact sample count. Depends on the unified timeline (4).

## Implemented increment — 13 November 2026

Enable **Download audio stems separately (ZIP)** in the normal Export dialog. The selected video/image format is exported normally and the audio is downloaded separately as an `-audio-stems.zip` file. Export the active timeline or switch to combined preview to export all timelines using the same scope as video export. The package contains `narration.wav`, `music.wav`, `sfx.wav`, optional `master.wav` (enabled by default), and `manifest.json`. Files are stereo, 48 kHz, 24-bit PCM. Muted clips are excluded; empty lanes contain silence. Import every WAV at timeline time zero. Do not add the master on top of the stems.

The checkbox uses processed stems with the master included, and the ZIP goes to the browser download location independently of the selected video save destination. The checkbox choice persists in this browser. The export dialog shows a compact result list with a direct audio ZIP link and separate audio status/error/cancellation; the dock also labels its ZIP download. A direct user click retrieves the finished ZIP when an automatic companion download is suppressed. Dry processing and optional-master controls remain supported by the renderer API, rather than exposed in the simplified dialog.

**Dry** uses saved original recordings and bypasses source enhancement and music ducking. **Processed** uses the currently enabled source data and the shared speech-driven music ducking envelope. Both retain clip gains, fades, trims, loops, scene offsets and playback speed. Older enhanced clips without a saved original cannot produce dry stems and show an actionable error. The mixed master is the linear sum of the stems; final video-mix loudness normalization and limiting are deliberately excluded.

The shared server audio graph now schedules trims and placement in integer 48 kHz samples rather than whole milliseconds. Nonnegative time conversions use the nearest sample, rounding exact halves up. Total samples are `round(ceil(duration / speed * fps) / fps * 48000)`, matching the reference video endpoint. Every lane is padded/trimmed to that count. Frame rate is only the endpoint reference; no Chromium frames are rendered for stems. Pitch-preserving speed conversion uses FFmpeg atempo, shared with video export; its time-stretch algorithm can smear transient detail.

Float intermediates preserve headroom until all lane peaks are measured. A common linear gain of `min(1, 0.999 / sum(lane peaks))` prevents PCM sample clipping while preserving summation. This conservative gain can attenuate even non-overlapping peaks. The manifest records it alongside source mode, sample count, channel format, speed, reference FPS, clip placement and processing. There is no separate per-stem normalization or true-peak guarantee.

The workflow uses the existing bounded export queue, job cancellation, session-owned downloads, optional native save picker and seven-day retained-output policy. Temporary audio and partial ZIP files are removed on failure or cancellation. Rendering uses disk intermediates; long exports need space for the float files, WAVs and final ZIP.

Automated checks cover exact decoded PCM counts, submillisecond and minute-long placement, trimming, loops, fades, speed changes, mute/empty lanes, source enhancement, ducking, shared headroom, stem/master summation and failure/cancellation cleanup. A real browser export verifies the UI → queue → worker → ZIP download path. See [verification](../../VERIFICATION.md). On 13 November 2026 the creator reported completing the recommended manual stem-delivery check. This is creator-reported acceptance for the tested project, separate from automated evidence. Broader timeline automation/transitions and the full unified timebase remain open.

## Work required

The list below retains the broader target scope. The increment above delivers the current clip-based stem workflow; it does not introduce automation or transitions that the timeline does not yet support.

- Choose the canonical project sample rate. The roadmap proposes 48 kHz and integer sample scheduling. Define conversion from timeline time and behavior at fractional sample boundaries.
- Route clips through a shared audio render graph. Preserve offsets, trims, fades, gain, automation, speed changes and transitions. Keep preview and export routing consistent.
- Render all stems from project time zero through a common final sample, padding silence as needed. Use PCM WAV for alignment-critical output, with 24-bit as the proposed default.
- Define dry and processed stem options and an optional mixed master. Package stems with descriptive filenames and a manifest containing the sample rate, sample count, timebase and processing applied. Provide one-click export.

## Deliverables and acceptance

Deliver the audio graph, stem exporter, manifest, UI and fixtures. Verify equal sample counts, correct cue positions, long-timeline alignment and import into an NLE or DAW without manual offsets. Verify dry stems sum to the expected unprocessed mix within tolerance when routing permits. Include speed changes and overlapping clips in the fixtures.
