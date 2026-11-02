# #3360 — Unified Factory Quality & Operations: four controls, one runtime

**Status:** owner-directed development brief; first implementation slice proposed for review, not a release grant.
**Date:** 2026-10-31.
**Related:** #3142 (Worker 1), #3110 (Software Factory), #3268 (single Service Manager), #3302 (F00/AEGIS), #3355 (Elara Agent Workspace), #3358 (first-install self-development), #3274 (roadmap).
**Normative references:** approved White Paper v3 W8/W9, existing test-catalogue, existing owner-approved permissions and STOP contracts.

## Problem and decision
Our implementations already contain source-bound review, signing/provenance, stop/no-replay, exact-head release gates, local profile authentication and service inventory. Presenting six to eight security boxes as distinct customer-operated authorities adds friction and implies extra installation or certification. **Simplify the user experience, not the protected trust boundaries.** Four labelled control groups are one *presentation/projection*, NOT four new daemons, certificate stores, queues or auth systems.

## Three operational responsibilities
1. **Software Factory:** Work Queue → Coding → Build & Test. Reuse #3142 dispatcher, worktrees and model provider authorization. It produces candidate code and real test evidence, not a self-approved release.
2. **Quality, Release & Operations:** Review → Validate → Approve → Release. Existing F00 is the internal source/test truth and reviewer logic. Existing AEGIS is the evidence, policy and green-only release logic. A human-supervised review is **labelled as such**, not represented as independent signed F00 certification.
3. **Service Manager:** background lifecycle host, service ownership, recovery, health, STOP/PAUSE and controlled isolation. It may route existing approved actions; it may NOT issue credentials, reviewer signatures, W8/W9 admission, merge grants or creative canon decisions.

## Four visible security and release controls
- **Access & Runtime:** existing Human profile, scoped authorization, Windows identities, restricted worktrees and already authorized Service Manager.
- **Validation:** approved source/test truth W8/W9, test outcomes, reviewer/human decisions, real Windows/Product Gate when applicable.
- **Evidence & Safety:** evidence and receipt provenance, exact source digests, durable STOP/PAUSE, no-replay, rollback.
- **Release Control:** integrity/signature checks under the selected release policy, authorized approval and exact-head green-only merge/update.

They can share existing status and provenance tools, but must not share private signing keys or collapse the author and release approver into one unchecked authority. Full independent F00 signing may be required for a higher-assurance release policy but is **not a universal first-install requirement**.

## First implementation slice: no additional service
Reuse the existing authenticated `app/skin-v1/factory-supervisor-panel.tsx` in Settings > General. Present the three operational responsibilities and four controls in one compact read-only status section, anchored to the **existing** GET `/api/factory/supervisor`. Continue using the same authenticated POST for Pause/Resume/STOP without changing its authorization or native effects.

### Read-only truth rules
- A `RUNNING` supervisor heartbeat is **observation only**; does not prove Worker 1 process, independent QA, Windows Product Gate, Service Manager installation, or merge readiness.
- A missing/blocked status must not become green, signed, authorized or ready via a new label. Error/STOP states remain visible.
- Release Control displays disabled/pending until actually proven; no new `canMerge` flag is invented.
- Labels are presentation, not source truth. Server-side stop policy, ownership and exact-head gates remain unchanged.
- Do not add a new router, endpoint, certificate, session, service startup or auth store.

## Acceptance and tests
1. Source review: existing FactorySupervisorPanel authenticates locally with the same endpoint, calls the same three mutations, and retains the STOP confirmation and truthful warnings.
2. Normal/unknown/STOP statuses remain accurately represented. No new action starts a worker or permits merge.
3. W8/W9 protected source-input binding for the existing authenticated GUI test must be reviewed against the exact new component digest; the author-prepared catalogue change does NOT self-certify the UI.
4. Run the existing protected `tests/issue-3142-authenticated-factory-supervisor-gui.test.mjs` and relevant architecture/Windows impact gates at exact PR head. Require real local Windows product acceptance before release.
5. On a user machine, this is one panel of the existing system, not an instruction to operate F00/AEGIS/registrar manually.

## Roadmap and non-goals
Finish **one real Worker 1 end-to-end cycle first**, then immediately #3355 Agent Workspace, then scale to proven unattended cycles and Workers 2–3. This bounded UI refactor may be developed in a separate draft but cannot block or masquerade as the Worker 1 milestone. We retain earlier merged components and evidence. Future first-install options are covered under #3358. No new F00 code signer, registrar, additional Service Manager, remote transport or generalized autonomous merging in this slice.
