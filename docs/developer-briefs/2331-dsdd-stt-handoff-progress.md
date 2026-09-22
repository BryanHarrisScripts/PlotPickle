# Developer Brief — DSDD local dictation handoff progress

Issue: #2331

## UAT finding

The Human can start DSDD microphone capture and see live input, but after stopping the microphone the flow can appear stuck at "preparing the local speech-to-text runtime." The status presentation also overlays the interface, and the local console does not prove whether whisper.cpp actually started.

## Required outcome

Keep the existing shared PlotPickle voice-input architecture and make the stop-to-text handoff observable, faster on repeat use, and non-overlapping.

The expected path is:

```text
microphone capture
-> stop dictation
-> finalise WAV
-> prepare/verify local whisper.cpp runtime
-> transcribe locally
-> insert editable text into the same narration textarea
```

Nothing is auto-sent and no build begins from dictation alone.

## Scope

1. Keep the existing shared `VoiceInputControl`; do not create a DSDD-specific microphone stack.
2. Keep the live microphone meter while recording.
3. Render DSDD microphone status and meter inside the DSDD composer flow rather than as fixed overlays.
4. Show elapsed time for local preparation/transcription so the Human can see that work is still active.
5. Surface installer stages while the reviewed whisper.cpp runtime/model are being prepared.
6. Add searchable local-console voice diagnostics for setup, audio receipt, runtime verification, transcription start/completion/failure, and text production.
7. Warm the installed-runtime status when the DSDD control opens so already-installed dictation does not wait for first-use verification.
8. Cache a successfully verified runtime/model fingerprint for the current app process so the 148 MB model is not rehashed before every dictation.
9. Preserve local-only transcription and existing bounded timeout/output limits.
10. Preserve the existing behavior that successful transcription inserts editable text into the same field and does not submit it automatically.

## Do not change

- DSDD intent semantics or Build this authority.
- Local-only/no-cloud voice policy.
- whisper.cpp/model provenance pins.
- the universal field eligibility boundary.
- unrelated startup, Sage, or agent-health behavior.

## Acceptance

- Stopping a DSDD recording reaches an explicit preparation/transcription state rather than looking dead.
- The DSDD status/meter cannot cover its action controls.
- Long-running preparation/transcription visibly reports elapsed seconds.
- The local server console exposes the STT handoff stages without logging narration content.
- Repeat dictation in the same app process reuses successful runtime integrity verification when the runtime/model/manifest fingerprint is unchanged.
- Successful transcription still inserts text into the DSDD narration field for Human review.
- Focused #2331 regression, PR Gate, Product Gate, and production build remain green on the exact PR head.
