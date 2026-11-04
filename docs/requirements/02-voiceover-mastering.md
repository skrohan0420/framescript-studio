# Automatic Voiceover Mastering

## Goal and dependencies

Produce consistent narration with automatic processing and preserve the original recording. Depends on the unified timeline (4) and shared audio render graph (5). Existing clip controls and silence editing provide inputs to the workflow.

## Work required

- Analyze speech activity, pauses, noise floor, sibilance, clipping, loudness and true peak. Choose conservative settings based on the recording.
- Build a non-destructive chain for corrective EQ or high-pass filtering, de-essing, dynamics, loudness normalization and true-peak limiting. Use deterministic DSP or FFmpeg where practical.
- Add narration-driven music ducking with attack and release controls. Define processing order and dry, processed and final-mix routing.
- Provide automatic presets, A/B preview, reset and manual overrides. Measure integrated loudness, loudness range, true peak and intelligibility proxies. Give poor or already-clipped recordings conservative treatment.

## Deliverables and acceptance

Deliver analysis, editable processing settings, presets, ducking and export integration. Verify consistent loudness across clips, no newly introduced clipping, speech-driven ducking without audible pumping, repeatable processing and recovery of the original audio.
