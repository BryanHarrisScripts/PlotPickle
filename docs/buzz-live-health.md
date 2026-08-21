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
3. Find the private `gatehouse` Guildhall room.
4. Send a uniquely tagged, signed health message through the BUZZ CLI.
5. Read recent `gatehouse` messages back from the relay.
6. Report success only when the exact tag sent by this test is observed on the read path.

The probe contains only an opaque health tag and timestamp. It contains no story content, prompt, model response, credential, hidden reasoning, or private key.

## Buzz Desktop v0.5.18 review

PlotPickle reviewed upstream `block/buzz` Desktop `v0.5.18` (`39f8b46935736334cdd7045a4e4b5d7eb1a33888`). The changes most relevant to this architecture are upstream transport/presence improvements: lossless reconnect repair, preservation of early relay-auth challenges, duplicate-agent/device provenance fixes, cross-owner relay mentions, in-thread workflow replies, Huddle speech-boundary preservation and cheaper ACP-provider discovery.

PlotPickle does **not** adopt Buzz's workflow editor as a second PlotPickle orchestration engine. Mastra/#989 and #1218 retain orchestration/execution ownership.

The Windows companion installer already resolves the newest compatible official Desktop release from `block/buzz` at install/maintenance time and uses the release asset digest when GitHub publishes one. The packaged 0.5.14 record remains the last locally pinned fallback until a newer installer digest is captured into that fallback record; this does not prevent a connected maintenance check from selecting v0.5.18.
