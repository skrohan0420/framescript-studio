# Automatic Voiceover Mastering

## Implemented foundation — 13 November 2026

The library and timeline Enhance toggles now retain original and processed audio in the same recording. Voice processing runs locally through FFmpeg: conservative signal-dependent noise reduction and EQ, de-essing, compression, bounded phrase leveling and two-pass loudness normalization targeting −16 LUFS and −1.5 dBTP. Noise reduction is skipped when quiet windows do not provide a plausible noise-floor estimate. Silence is not boosted. Output retains channel count and exact frame count at the browser decode sample rate. Existing cached enhancements are upgraded from the original when switched off and back on.

Preview and export share a speech-activity ducking envelope using transcript timings when available, otherwise waveform activity. It handles source trims, loops, scene offsets and pauses, with 80 ms attack and 350 ms release. Exports containing enhanced narration apply final-mix loudness normalization and true-peak control. Preview uses the processed source and matching duck envelope; final mix normalization remains an export stage.

Verified with synthetic varying-level speech-like audio, measured FFmpeg loudness/true peak, exact sample counts, duck envelope tests and browser toggle/undo checks. This is not a guarantee of perceptual quality on every device. Real speech listening and phone/earbud/laptop checks remain necessary. Automatic room-echo removal, clipping repair, explicit strength controls and a measured intelligibility score are not implemented.

## Goal and dependencies

Revision 4 responds to audible sibilance reported on the current narration: stronger adaptive treble ducking, de-essing after level adjustment, and no presence lift when sibilance is detected. A synthetic voiced-plus-noise fixture verifies at least 3 dB treble-burst reduction with less than 1 dB loss of voiced-body energy. This verifies the filter behavior, not a listening judgment of the user's voice.

The third enhancement revision adds active-speech-weighted EQ decisions and sibilance-dependent de-essing. Noise reduction requires a sustained, relatively stationary, noise-like quiet bed rather than treating every quiet syllable or breath as noise. This remains conservative signal analysis, not learned speech/noise separation. The current local ElevenLabs voiceover was checked: it selected no denoising or mud cut, a 0.6 dB presence lift and light de-essing. Actual perceptual/device listening remains a user review step.

Library cards expose Hear original / Hear enhanced once processing is complete. These previews use attenuation-only gain offsets derived from separately measured integrated loudness, leaving timeline data, gain and enhancement state unchanged. Existing reversible voice enhancements upgrade from their original on the next off/on cycle.

Produce consistent narration with automatic processing and preserve the original recording. Depends on the unified timeline (4) and shared audio render graph (5). Existing clip controls and silence editing provide inputs to the workflow.

## Work required

- Analyze speech activity, pauses, noise floor, sibilance, clipping, loudness and true peak. Choose conservative settings based on the recording.
- Build a non-destructive chain for corrective EQ or high-pass filtering, de-essing, dynamics, loudness normalization and true-peak limiting. Use deterministic DSP or FFmpeg where practical.
- Add narration-driven music ducking with attack and release controls. Define processing order and dry, processed and final-mix routing.
- Provide automatic presets, A/B preview, reset and manual overrides. Measure integrated loudness, loudness range, true peak and intelligibility proxies. Give poor or already-clipped recordings conservative treatment.

## Deliverables and acceptance

Deliver analysis, editable processing settings, presets, ducking and export integration. Verify consistent loudness across clips, no newly introduced clipping, speech-driven ducking without audible pumping, repeatable processing and recovery of the original audio.
