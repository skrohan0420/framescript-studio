# Audio Stem Export and Synchronization

## Goal and dependencies

Export independently usable narration, music and SFX stems with a common start and exact sample count. Depends on the unified timeline (4). The current FFmpeg path resamples to 48 kHz and schedules delays in whole milliseconds.

## Work required

- Choose the canonical project sample rate. The roadmap proposes 48 kHz and integer sample scheduling. Define conversion from timeline time and behavior at fractional sample boundaries.
- Route clips through a shared audio render graph. Preserve offsets, trims, fades, gain, automation, speed changes and transitions. Keep preview and export routing consistent.
- Render all stems from project time zero through a common final sample, padding silence as needed. Use PCM WAV for alignment-critical output, with 24-bit as the proposed default.
- Define dry and processed stem options and an optional mixed master. Package stems with descriptive filenames and a manifest containing the sample rate, sample count, timebase and processing applied. Provide one-click export.

## Deliverables and acceptance

Deliver the audio graph, stem exporter, manifest, UI and fixtures. Verify equal sample counts, correct cue positions, long-timeline alignment and import into an NLE or DAW without manual offsets. Verify dry stems sum to the expected unprocessed mix within tolerance when routing permits. Include speed changes and overlapping clips in the fixtures.
