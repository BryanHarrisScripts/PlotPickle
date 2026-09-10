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

## Buzz Desktop v0.5.22 review

PlotPickle reviewed the upstream Desktop line from `v0.5.19` through `v0.5.22`. The published `desktop-v0.5.22` tag resolves to commit `9ceb1f79bbc21785a0a075c40aecb3c058b1ea15`. Upstream did not publish a standalone `desktop-v0.5.21` tag; the v0.5.21 release step is included in the cumulative v0.5.22 release history.

The architecture-relevant changes strengthen existing PlotPickle transport and presence contracts rather than creating new authority:

- agent availability can derive from actual relay presence instead of stale local assumptions;
- authenticated owned relay agents are discovered more reliably;
- explicit agent profiles remain bound to their exact key;
- owned-agent cloud provenance markers are normalized;
- mention messages are published before waking agents, reducing ordering races between transport and execution;
- profile-batch and thread-reply retrieval is more tolerant of relay slowness;
- a harness-agnostic agent effort/spawn bridge exists upstream, but PlotPickle treats it only as interoperability beneath the existing governed Agent Contract, Context Engine and runtime authority.

PlotPickle does **not** adopt BUZZ workflow/editor concepts, Bestie, or BUZZ agent spawning as a second PlotPickle orchestration engine. Mastra and the existing PlotPickle harness remain orchestration authority; PPF remains canon authority; Story Decisions/Workbench and deterministic release gates retain change authority.

The Windows companion installer already resolves the newest compatible official Desktop release from `block/buzz` at install/maintenance time and verifies a release SHA-256 when GitHub publishes one. The verified local fallback is now `desktop-v0.5.22`, using `Buzz_0.5.22_x64-setup_alpha-unsigned.exe` with SHA-256 `c76aa32e75faa20aee5d8cd1c1c2c00265bc94166c3cb6a88455a6819e9ec289`. The asset remains explicitly marked unsigned; PlotPickle does not bypass normal installer or trust boundaries because of that status.
