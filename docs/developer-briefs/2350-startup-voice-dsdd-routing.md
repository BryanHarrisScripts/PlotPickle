# #2350 Startup-owned local dictation, truthful microphone states, and lean DSDD verification routing

## Problem

Human DSDD dogfood showed that Conversational UAT could display a green MIC INPUT state while whisper.cpp and the reviewed base.en model were still downloading. The same flow could sit on an installation counter and eventually report LOCAL DICTATION PREPARATION TIMED OUT.

That makes the microphone state untruthful: green must mean PlotPickle is actually listening, not that speech dependencies are still being installed.

The same investigation found DSDD/Pi source-contract proof duplicated across legacy PR Gate and Windows Product Gate, with broad DSDD/voice changes able to invoke the expensive Pi Windows candidate proof.

## Human contract

Normal Human startup owns first local-dictation readiness.

Fresh Human startup:

PlotPickle launcher
→ verify reviewed whisper.cpp/base.en install
→ if missing or invalid, provision exact pinned bytes once
→ verify size/hash/provenance
→ only then declare normal Human app startup ready
→ open owned Edge app
→ microphone is immediately usable

Later Human startups reuse the verified install and do not download it again.

WebMCP/synthetic startup does not provision the 141 MiB model merely to create a test profile.

## Microphone states

OFF
- red microphone
- visible slash
- no capture
- no meter

LISTENING
- local STT readiness is already true
- Human clicks microphone
- browser capture succeeds
- microphone turns green
- live MIC INPUT meter reflects captured samples

STOP / TRANSCRIBE
- Human clicks green microphone
- capture stops
- microphone immediately returns to red/slashed
- local TRANSCRIBING status appears
- transcript is inserted into the same editable field
- no automatic Send or Build

UNAVAILABLE
- runtime/model/permission failure never produces a green listening state
- microphone control does not download or repair dependencies
- Settings → Local Dictation remains the explicit verify/repair surface

## Architecture ownership

Layer 2 Experience Contract owns the shared microphone interaction/state contract.

Layer 4 Agent & Skill Mesh owns deterministic DSDD intent-to-evidence and persistent Pi session contracts.

Layer 6 Provider Runtime owns local whisper.cpp/base.en runtime, gateway and integrity behavior.

DSDD is not introduced as a permanent long-running Layer 1 or Layer 7 test lane.

## Verification routing

The fast #2331/#2338 source contracts are catalogued under Layer 4 and removed from the duplicate legacy PR Gate step.

The shared microphone readiness/interaction contract is catalogued under Layer 2.

The local speech runtime contract is catalogued under Layer 6.

The real Pi 0.87 Windows candidate proof remains impact-selected only when Pi/session/native integration files change.

The real whisper.cpp Windows smoke remains impact-selected only for the local voice/startup boundary.

## Acceptance

1. Normal Human startup verifies or provisions reviewed whisper.cpp/base.en before app readiness.
2. Existing valid installs are reused without re-download.
3. DSDD does not POST to /api/local-voice/setup.
4. Local STT readiness is checked before getUserMedia can transition to LISTENING.
5. OFF is red with a visible slash.
6. LISTENING is green and the live meter reflects captured input.
7. Stopping returns the control to red/slashed before local transcription completes.
8. Settings is verify/repair, not mandatory first-use setup.
9. #2331/#2338 deterministic DSDD contracts are owned by Layer 4.
10. Shared microphone interaction proof is owned by Layer 2.
11. Local voice runtime proof is owned by Layer 6.
12. Voice/UI-only work does not invoke the full Pi Windows candidate proof.
13. The whisper Windows smoke remains bounded to relevant voice/startup changes.
14. Exact-head seven-layer merge authority remains unchanged.
