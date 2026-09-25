# PlotPickle BUZZ local backbone and live health

PlotPickle uses BUZZ in two deliberately separate ways:

1. **Local Node coordination/evidence** — bounded operational events from PlotPickle agents, UAT, repair and runtime services are recorded locally first so the studio can explain what is working, checking, degraded, unavailable or unknown even when the remote relay/Desktop is unavailable.
2. **Remote BUZZ transport / Community** — selected compact events may be mirrored into the existing Guildhall rooms when BUZZ is reachable and the active Human/Profile signer is authorized.

BUZZ is not the PlotPickle execution engine, memory authority, PPF authority or release authority.

## Local evidence contract

`scripts/buzz-live-activity.mjs` is the single operational event owner used by existing reporters. `bestEffortLiveBuzzActivity()` now records a sanitized local event before attempting a remote Guildhall mirror.

Each local event keeps explicit provenance fields rather than conflating identities:

- actor/agent or deterministic service identity;
- Node scope;
- optional Human/Profile scope;
- optional Project and session scope;
- run/task/semantic-execution references;
- short status/summary;
- compact evidence references;
- verification/actionability flags;
- timestamp and optional presence expiry.

The journal is bounded and contains only operational summaries/evidence references. Credentials, nsec/private keys, API tokens, authorization material and other known secret forms are redacted before persistence or mirroring. Hidden reasoning/full prompts are not event fields.

## Truthful health semantics

Health supports:

- `ready`
- `working`
- `degraded`
- `unavailable`
- `unknown`

Presence/status evidence can expire. Expired evidence becomes `unknown`; restart or silence never leaves an old agent falsely shown as online.

A missing health event is also `unknown`, never green.

Verified improvement candidates require at least one evidence reference. Recording an improvement candidate does not authorize code/config changes: BEN, deterministic tests, production build, UAT and Full Verification remain authoritative.

## Semantic execution integration

The #1218 semantic UAT repair wrapper emits compact `semantic.execution` activity through this same backbone:

- working when the bounded repair begins;
- degraded when the verified repair path becomes blocked;
- ready only after the existing deterministic repair wrapper has passed its required validation path.

The semantic execution record itself remains the execution authority. BUZZ receives only bounded status/evidence summaries and does not own phase transitions or repair decisions.

## User-facing health

`GET /api/local-buzz/live-health` returns the current local-backbone summary. The existing Settings health card shows that summary separately from remote BUZZ connectivity.

`POST /api/local-buzz/live-health` remains the explicit signed remote round-trip test:

1. Read the encrypted local BUZZ connection.
2. Confirm the identity was previously verified.
3. Find the active retained `great-hall` room and ignore archived channel records.
4. Send a uniquely tagged, signed connection-test message through the BUZZ CLI.
5. Read recent `great-hall` messages back from the relay.
6. Report success only when the exact tag sent by this test is observed on the read path.

The previous `gatehouse` probe target was retired by the Community cleanup contract, so live health must not depend on that archived room. The Great Hall is retained as the stable Community transport path. The probe is sent only when the Human explicitly presses the live connection test.

The probe contains only an opaque health tag and timestamp. It contains no story content, prompt, model response, credential, hidden reasoning, or private key.

## Buzz Desktop v0.5.25 review

PlotPickle reviewed the current upstream Desktop line through `desktop-v0.5.25`. The published tag resolves to commit `c8f73213089cbd5a0f1e675d3193558280d46e10` and is the current stable Desktop release reviewed for PlotPickle on 2026-09-24.

The architecture boundary remains unchanged: BUZZ is transport, Community and local coordination/evidence infrastructure beneath PlotPickle's existing authority model. Mastra and the PlotPickle harness remain orchestration authority; PPF remains canon authority; Story Decisions/Workbench and deterministic release gates retain change authority. PlotPickle does not adopt BUZZ workflow/editor concepts or BUZZ agent spawning as a second orchestration engine.

The Windows companion installer continues to resolve the newest compatible official Desktop release from `block/buzz` at install/maintenance time and verifies the published release SHA-256 when available. The verified reviewed fallback is now `desktop-v0.5.25`, using `Buzz_0.5.25_x64-setup_alpha-unsigned.exe` with SHA-256 `fff84c9048acbb0592d873f6cc8c8cd9816c43a753042407bfa47b452c2bda43`. The asset remains explicitly marked unsigned; PlotPickle does not bypass normal installer or trust boundaries because of that status.
