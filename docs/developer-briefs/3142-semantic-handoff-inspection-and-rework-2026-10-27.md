# PlotPickle — Semantic Handoff, Factory Identity and Final Inspection
## Owner-approved developer brief · October 27, 2026

**Status:** Human-approved behavioral direction and design requirements; implementation and independent acceptance **NOT PROVEN**. This brief does not grant a new model call, source mutation, test-truth amendment, spend, merge, publication, or STOP override.

**Owning work:** [Software Factory / dispatcher #3142](https://github.com/BryanHarrisScripts/PlotPickle/issues/3142), [parent #3110](https://github.com/BryanHarrisScripts/PlotPickle/issues/3110), [independent verification #3302](https://github.com/BryanHarrisScripts/PlotPickle/issues/3302), [coding pilot PR #3311](https://github.com/BryanHarrisScripts/PlotPickle/pull/3311), [roadmap #3274](https://github.com/BryanHarrisScripts/PlotPickle/issues/3274). Reinspection/corrective work belongs to these existing owners; do not create a competing queue, verifier or fifth factory.

**Governing sources:** [README](../../README.md), [AGENTS.md](../../AGENTS.md), [PlotPickle Organization Chart](../PlotPickleOrganizationChart.md), [Software Factory phases](3110-autonomous-software-factory-phases.md), [Pi Durable boundary](../architecture/PI-DURABLE-ADAPTER.md). This is a narrower implementation brief, **not a replacement for the project constitution, WHITE-PAPER-V3 W8/W9, or an approved test-truth catalogue**.

### 1. Executive decision

PlotPickle should operate like a well-governed production plant:

1. A Human-authorized **Work Order** joins the existing durable queue.
2. An eligible, authorized worker takes an **exclusive, resource-scoped claim**, with its own numbered organizational identity.
3. Each department receives a **Semantic Handoff Token (SHT)** as a *reference* to the work order, not as an authority-bearing credential. It appends time-stamped, immutable evidence of its responsibility and output.
4. An **independent Final Inspection Card** verifies the latest exact work product against the original, approved success criteria, applicable security/rights/privacy/STOP gates and independent evidence.
5. A satisfactory card may make a work order **eligible** for the separately governed release decision. An unsatisfactory card creates or updates a **linked, fingerprint-deduplicated corrective work order** in the existing queue if admission is allowed; the original uncertain attempt is **never replayed**.
6. Rework produces a *new* inspection card chained to the earlier one. Prior failures and original inspections stay immutable. The system continues to another eligible issue only when real worker capacity, authority and resource availability are established.

**Human agreement:** The four W8/W9 guarantees are approved at the behavioral level: lifetime exclusive ownership; fail-closed lost/replaced ownership throughout admission, model, Git and receipt work; non-replay and preservation of uncertain attempts; new grants only after provable release. [Human behavior record](https://github.com/BryanHarrisScripts/PlotPickle/issues/3142#issuecomment-6449639057). Exact test/input hashes, test oracle admission, Windows QA and merge remain separate gates.

### 2. Organizational identity — no actor without attribution

The [October 27 Organization Chart](../PlotPickleOrganizationChart.md) and current [README](../../README.md#roadmap-four-factories-and-one-semantic-story-coordinator) describe **four** target Factories. Historical October 24 roadmap wording refers to three plus the Coordinator; it is not a license to silently rewrite the locked execution order. The latest four-factory *organizational vocabulary* is used here.

| Namespace | Permanent meaning | Typical responsibilities |
| --- | --- | --- |
| `PP-F00` | Central/shared governance, **not a fifth Factory** | Human authority interfaces, independent Windows Supervisor, independent Quality, release governance, shared audit |
| `PP-F01` | Software Factory | Intake, architecture, authorized coding, test/build, integration, review, dispatcher |
| `PP-F02` | Learning & Evolution Factory | Research, education, skills evaluation and proposals |
| `PP-F03` | Story Builder Factory | Source-grounded writing, visual production, motion, audio and finishing |
| `PP-F04` | Game Factory — STORY: The Unwritten | World/rules creation, deterministic play, game QA |
 
**Proposed immutable registry key:** `PP-Fxx-Dyy-Knnnn`. `Fxx` is the stable factory/shared namespace; `Dyy` is a registered department *within* that namespace; `K` is an actor kind (`H` Human, `W` authorized worker, `S` service, `A` automation, `X` external adapter); `nnnn` is a unique, never-reassigned actor number within that factory/department/type. E.g. `PP-F01-D03-W0001` is a proposed Software coding worker identity. Identity is **not a permission or a claim of independently running processes**.

**Suggested initial department registry, to ratify before operational use:**

- `F00-D01` Plant Operations / Independent Supervisor; `F00-D02` Independent Quality / Windows Product Gate; `F00-D03` Release Management; `F00-D04` Human governance and truth administration.
- `F01-D01` Engineering Management / intake; `F01-D02` Architecture / scout; `F01-D03` Coding workshop; `F01-D04` Build / focused test; `F01-D05` Integration; `F01-D06` Engineering review; `F01-D07` Dispatcher.
- Define F02/F03/F04 department numbers against their **existing** org-chart role owners when that factory is integrated, not speculatively populated with phantom agents.

Version this registry and preserve historical aliases for renames. A worker's canonical `actorId` persists through restarts; a separate `executionId`, `attemptId`, actual process-owner/signer reference and credential-bound principal identify *this* execution. One actor may take different assigned roles only through distinct authorized role claims. Provider adapters, model invokers, token readers, event writers, issuer services, supervisors, independent verifiers, automated schedulers and Human approvers must be attributable; map external systems through registered service/adapters, not fabricated identities. A read-only token inspection can be audited separately from the handoff chain and must not advance work-order state.

### 3. Stable token identity; growing metadata without history rewriting

A token is a **non-bearer locator** (`shtRef`) for a stable `workOrderId`. A readable label such as `PP-SHT-WO-000042` may be shown in UI; the durable identity is a unique opaque ID scoped in the authoritative existing ledger. A token is **not** an API key, lease, delegation envelope, executable grant, approval signature or access-control shortcut.

Metadata grows as **append-only, content-addressed handoff events**, never by mutating past cards or earlier handoffs:

`work order + SHT reference → event 1 → event 2 → ... → inspection 1 → corrective work order → event ... → inspection 2`

The canonical event contract (schema proposal, **not deployed**) includes:

| Group | Required fields / meaning |
| --- | --- |
| Provenance | `schemaVersion`, `registryVersion`, `eventId`, `workOrderId`, `shtRef`, `inspectionCycleId`, `eventType` |
| Integrity and ordering | `sequence`, `previousEventDigest`, `eventDigest`, canonical serialization and issuer/signer evidence reference; append is an atomic compare-and-set/transaction, not a read-then-write race |
| Time | `recordedAtUtc` in ISO 8601 with timezone, independently observed `startedAtUtc` / `finishedAtUtc` if known, source clock/provenance, monotonic elapsed duration where measurable. Never trust wall clock to order conflicting writes |
| Organizations | `fromActorId`, `toActorId`, `factoryId`, `fromDepartmentId`, `toDepartmentId`, actor type, authenticated runtime/actual process identity refs; never infer independence from role names |
| Scope | `issueRef`, `attemptId`, `executionId`, queue claim/resource and fencing reference, exact approved scope, Human intent/permission **references** and spend ceilings; no bearer secrets |
| Source and output | Immutable source revision (Git commit/PPF project + revision/game state), candidate revision, PR, digest/URI of sanitized artifacts and durable engineering receipt |
| Quality | Versioned Human-approved criterion IDs, expected/actual outcomes, `PASS` / `FAIL` / `BLOCKED` / `UNPROVEN` / `NOT_APPLICABLE`, source and independent verifier evidence refs |
| Transition | `SUBMITTED`, `CLAIMED`, `EXECUTED`, `HANDOFF_PROPOSED`, `HANDOFF_ACCEPTED`, `HANDOFF_REJECTED`, `INSPECTED`, `REWORK_QUEUED`, `STOPPED`, `BLOCKED`, etc.; separated from existing Development Run ledger states |
| Next step | Named next department/actor *or* `UNASSIGNED`, preconditions, owner-visible blocker, evidence freshness, STOP/replay status and permitted next-action class |

**SHT projection:** derive `lastAcceptedHandoffEventId`, latest inspection/card ID, latest verified candidate source, `currentResponsibleActorId`, `lastDepartmentId`, last accepted UTC time, `nextDepartmentId`, unmet criteria and truthful status from immutable records. An unaccepted/failed transfer remains inspectable but must **not** replace the last accepted handoff. Append collisions, same request with different payload, missing predecessor, bad digest, stale registry, denied permission or ambiguous ownership fail closed. An idempotent retransmission of the *same* authorized event may return the prior recorded result; it may never execute the external side effect again.

**Privacy:** store identity and minimal sanitized metadata, evidence links/hashes and permission references. Do not put real credentials, arbitrary local paths, private story text, model prompts/responses, hidden reasoning, identifiable personal details, unreleased media or publisher tokens in public GitHub telemetry.

### 4. End-to-end Software Factory protocol

```text
Human-approved issue and success criteria
    → existing eligible work queue / STOP and capability check
    → atomic per-job + per-resource claim (single approved coding worker first)
    → coding worker's bounded isolated source edit, tests and durable receipt
    → separately admitted publish step and exact PR head
    → independent, credential-separated W8/W9 / CI / Windows Product Gate
    → Final Inspection Card
        ├─ ACCEPTED        → release gate rechecks exact head + delegated authority
        │                      → merge receipt → close/advance eligible queue item
        ├─ REWORK_REQUIRED → deduplicated linked corrective work order
        │                      → NEW grant/attempt when eligible → new inspection
        └─ BLOCKED         → preserve evidence and hold pending missing proof,
                               STOP, eligibility, consent or reconciliation
```

**One request, two separately evidenced replies (#3302):** engineering/execution receipt is not the verifier receipt. Verifier must be independently credentialed and gather real exact-head results; it must not be the same worker certifying its own assertions. A coding result can be `EXECUTED` and still have inspection status `BLOCKED`.

**First production milestone:** prove **two distinct, consecutive genuine issues**, one authorized coding worker, real model invocation and isolated change, actual tests, independently verified exact-head PR, permitted merge and automatic start of the second issue from the existing durable queue. No manual second prompt; no replay of the first attempt. A closed browser/ChatGPT turn is not proof of an unattended agent. Confirm running, supervised worker/process, genuine credentials and supported unattended invocation. Keep old reserved Pi jobs and private stages intact.

### 5. Final Inspection Card — objective release-quality certificate

One card **per inspection cycle**, content-addressed and signed by the appropriately independent verifier, refers to the entire SHT history and immutable evidence. Required fields:

- `inspectionId`, `workOrderId`, `shtRef`, `inspectionCycleId`, `previousInspectionDigest` where applicable; `createdAtUtc`, `inspectorActorId`, authenticated verifier/runner/signature references.
- Original intent and **version-locked success criteria**, authoritative W8/W9 truth edition and admitted digest references. Do not redefine criteria after looking at the implementation. Explain legitimate exceptions and Human-approved amendments explicitly.
- Exact original source/base, candidate commit/PPF revision, current PR head, branch and committed diff/artifact digests; source provenance and inspected scope.
- Criterion-by-criterion **observed** outcome, independently verifiable links and timestamps, result provenance, actual native Windows/browser/product outcomes where required, and evidence limitations. A status of `SKIPPED`, stale, cancelled, timed out, unknown, absent or synthetic cannot become `PASS`.
- Defect fingerprint(s), severity, steps to reproduce, owning department, whether safely actionable, unresolved dependencies, failed/uncertain irreversible operations, and links to prior or resulting corrective work orders.
- Explicit disposition: `ACCEPTED`, `REWORK_REQUIRED` or `BLOCKED`. `ACCEPTED` means *inspection criteria* satisfied, **not merged**, creative canon approved, approved to spend, released or distributed.
- Next authorized action, fresh review requirement, STOP and replay flags, responsible role, resource/lease reconciliation and release-gate eligibility **separate from inspection disposition**.

**Example illustrative projection (not a real acceptance receipt):**

```json
{
  "workOrderId": "PP-WO-000042",
  "shtRef": "PP-SHT-WO-000042",
  "inspectionCycleId": "IC-0002",
  "previousInspectionDigest": "sha256:<previous-card-digest>",
  "inspectorActorId": "PP-F00-D02-W0001",
  "candidateHead": "<exact-commit-sha>",
  "lastAcceptedHandoff": "EV-0018",
  "criteria": [
    {"id":"W8-OWNERSHIP","result":"PASS","evidenceRef":"receipt:<independent-exact-head-proof>"},
    {"id":"WINDOWS-PRODUCT-GATE","result":"UNPROVEN","evidenceRef":null}
  ],
  "disposition": "BLOCKED",
  "mergeEligible": false,
  "nextAction": "Obtain independently signed owner-Windows Product Gate"
}
```

The final release controller may derive `READY_TO_MERGE` only after **fresh** exact-head PR/CI checks, verified admission, independently signed applicable Product Gate, other reviews and the standing bounded Human merge policy. GitHub must confirm the actual merge SHA. A card must never authorize itself.

### 6. Reinspection and corrective queue, without replay

When inspection finds a real, reproducible defect:

1. Log a sanitized, source-bound `FAIL` with criterion ID, evidence and stable defect fingerprint, preserving the original card and all failed handoffs.
2. Produce or reuse **one** linked correction issue/work order in the **existing** backlog (search/dedupe before creation); carry original work order/card and relevant independent evidence references, not an executable token or copy of a private prompt.
3. Evaluate eligibility, work authorization, dependency holds, STOP, available budget and resource claim. The queue can mark `WAITING`/`BLOCKED` rather than automatically executing.
4. For an eligible repair, assign a **new** unique `attemptId` and grant. Never replay the earlier paid call, Git mutation, publication or one-use ID—even if an old lease expired or a crash left uncertain outcome.
5. After actual repair, obtain a **new** independent inspection against a pinned new head/revision, with `previousInspectionDigest` chaining the original. Historic failures cannot be edited into successes.
6. For newly discovered defects *after* `ACCEPTED`, create a linked follow-up and new inspection cycle instead of silently mutating the accepted historical card.

A `BLOCKED` card (unproven provider request, missing independent verifier, uncertain result, STOP, no authority, unreconciled resources) **must not auto-requeue executable work**. Waiting and review are legitimate outcomes.

### 7. W8/W9 coding-resource and failure guarantees — mandatory before #3311 release

Owner-confirmed guarantees (quoted in operational terms; see linked Human record in §1):

1. The first granted attempt exclusively owns the **required coding resource** across capacity reservation, isolated Git worktree, model request, code write/commit and durable result receipt. A second distinct grant cannot run overlapping coding operations or consume a private grant reservation while the resource remains owned.
2. Removing/replacing a lock path or otherwise losing ownership **during admission or at any later stage** must cause a fail-closed outcome. No attempt may delete a different owner's lock or claim success after uncertain ownership.
3. Crash/stop/timeout leave inspectable durable state. An uncertain one-use grant is **non-replayable**; neither expiry nor a new process can silently reclaim it.
4. The next fresh grant proceeds **only** after the previous release and ownership state have been genuinely established; no guessing from stale heartbeat or elapsed lease.

**Known #3311 defect:** `scripts/engineering-team/gateway/authorized-coding-once.mjs` verifies a lock's file identity before awaiting execution but then unconditionally unlinks its pathname in cleanup. Another process could remove/replace the file during the long-running model/Git phase; a naive extra pre-unlink `lstat` still leaves a check/unlink race. Require a **single authoritative, enforceable claim/fencing-and-release mechanism** with atomic claim/compare-and-release semantics or a proven OS-exclusive ownership primitive, and active ownership checks/fencing at irreversible operation boundaries. On lost ownership: stop further side effects when safely possible, never certify completion, preserve uncertain receipts and require reconciliation. Do not delete historical stages, locks or active worktrees as an expedient repair. Verify exact Windows semantics and STOP/process descendants independently.

**Truth admission rule:** The current #3311 modified test/source digests are **not approved** merely because the Human approved the behavior. [Original proposed packet](https://github.com/BryanHarrisScripts/PlotPickle/pull/3311#issuecomment-6448631062) became stale after the discovered active-execution replacement race. Fix code and prepare new deterministic overlap/lost-owner/crash cases, then submit a **separate trusted-base, independently Human-reviewed WHITE-PAPER-V3 W8/W9 amendment** with actual new UTF-8 LF SHA-256 digests and oracle limitations. Only run changed governed tests **after** admission through `config/verification/test-catalog.json#truthGovernance`; exact-head CI and owner-Windows Product Gate remain separate.

### 8. Asynchronous scheduling and Pi Durable: reuse, do not duplicate

Reuse `scripts/engineering-team/windows/autonomous-queue.mjs`, existing authenticated MCP/Windows Supervisor, established Git worktree receipts, `scripts/engineering-team/durable-checkpoint.mjs`, and the Pi Durable adapter. Pi Durable 1.3.0 provides useful **bounded checkpoint/recovery plumbing**, not authorization, atomic multi-worker locks, a ChatGPT wake-up, independent verification, source of truth or permission to re-run uncertain calls. In the current ChatGPT-led Software Factory route, **do not activate the older Pi coding dispatcher or replay its five historical blocked issue attempts**. Consider using Pi Durable as a checkpoint-only internal component after the single-worker proof and adapter boundary have been verified.

To add capacity after two real cycles, replace the lifetime **global** resource lock with independently tested, **per-job and per-resource** claims (issue, worktree path, branch, provider quota, Git remote update, verifier hardware and merge serialization). Claims need atomic admission, fencing, crash reconciliation, precise lock identity, independent Windows process owner, bounded leases/heartbeats and STOP; there must be no bypass under clock skew, duplicate delivery, expired lease, lock deletion, process failure, resource conflicts or network partition. Enable **two truly independent coding workers** only after deterministic competing-claim tests, controlled Windows crash/recovery and resource-conflict tests. Increase capacity only on measured sustained throughput, available disk/RAM/GPU/provider quota and correct resource isolation. Distinct actor labels or simultaneous callbacks are not proof of independent workers.

### 9. Delivery slices (no competing projects)

| Slice | Concrete deliverable | Exit / acceptance |
| --- | --- | --- |
| **0 — Safety and truth** | Repair #3311 lock ownership and release, prepare precise changed regression cases, separate Human-reviewed trusted-base W8/W9 amendment | Governed test admission and actual relevant independent exact-head CI/Windows evidence; preserve all uncertain attempts |
| **1 — Two autonomous single-worker cycles** | #3142 durable dispatch and #3302 separate execution/verifier receipts; real PR/merges on **two distinct issues** | Complete genuine Issue A → merge → automatically start Issue B → independently verified merge, no second Human prompting or uncertain replay |
| **2 — Stable identities and SHT ledger** | Versioned actor/factory/department registry; immutable work-order/event identities; hash chain, atomic append, idempotency and last-accepted-handoff projection | Admitted unit/integration tests for multi-actor trace, duplicates, stale/conflicting predecessor, STOP and crash; no new authority grants |
| **3 — Final Inspection Card** | Independently signed criterion-level card with provenance, exact SHA, inspection limitations, three dispositions and owner-visible links | Separate actual verifier proof, missing/stale/false-green negative cases; inspect same card in CMD/UI/MCP without differing claims |
| **4 — Reinspection / rework** | Linked, fingerprint-deduplicated correction work order and distinct attempt; new immutable card referencing predecessor | Demonstrated defect → eligible repair → new exact-head inspection; original failure retained; BLOCKED cannot accidentally trigger spend/replay |
| **5 — Two-worker asynchronous scale** | Per-job/resource atomic claims and fencing, genuinely separate workers, persistent recovery, scheduling against resources | Controlled simultaneous claims, crashes, stale lease, lock replacement, Windows STOP, exact-head quality and throughput/resource measurements |

Slices 2–4 can be prepared in documentation/contract isolation while Slice 0 is blocked, but may not be represented as operational proof or weaken the first-cycle priority. The Software Factory work order remains owned by #3142 and #3302, with quality requirements in existing governance.

### 10. Independent acceptance matrix

| ID | Required observable proof | What is **not** proof |
| --- | --- | --- |
| A01 | Full-lifetime exclusive ownership for two distinct grants, with one held inside an actual injected long-running model phase | A lock acquired/released only during capacity check |
| A02 | Lost/replaced pathname while model/Git/receipt active fails closed and never removes new owner's lock | Another non-atomic check just before unlink |
| A03 | Crash, stale lease, STOP and process-tree loss produce inspectable non-replay states | Process exit or old heartbeat alone |
| A04 | Separate Human truth approval, trusted-base W8/W9 binding of **final** changed file/input digests, admitted independent tests | User intent quote or model-authored tests by themselves |
| A05 | Real two-issue independent exact-head engineering + Product Gate + merge/next queue proof | Mock model, source identity check, six green CodeQL jobs alone |
| A06 | Stable Fxx/Dyy/Knnnn actor identity, unique attempts, immutable linked append, verified last *accepted* handoff | UI label or a modified JSON history |
| A07 | Independent criterion-by-criterion inspection card; stale/absent/failed outcomes reject acceptance | Self-report or synthetic green |
| A08 | Fingerprinted linked rework, separate grant, second inspection chained to first; original card unchanged | Retrying the old one-use grant |
| A09 | Honest CMD/MCP/GUI inspection status plus authorized STOP and owner-observable blockers | Claims of background ChatGPT work without a live worker |
| A10 | Two concurrently **independent** workers, per-resource conflicts, crashes and safe recovery in controlled native Windows tests | Merely increasing configured max concurrency |

### 11. Operator view and success measures

An operator opening a work order should see: **Work Order**, **SHT identity**, owning Factory, current department/worker, *last accepted handoff* with UTC/local display time, exact candidate/source, current success criteria, current inspection card/verifier, unresolved issues, STOP/replay state and *next actionable owner*. Expand to view every earlier handoff, failed/unaccepted transfer, prior card and linked corrective issue. Source and evidence links must be clickable; a display label must never imply verified external activity.

Track first-pass independent acceptance rate; defect recurrence by fingerprint/department; handoff-to-inspection and inspection-to-rework latency; verification false-green rate; blocked/unknown non-replay counts; completed independently verified PRs per active authorized worker; disk/RAM/GPU/provider usage; actual successful next-issue dispatch without manual prompting. No manufactured metrics from synthetic fixtures.

### 12. Constraints, safe rollout and current facts

- **Authority:** STOP, Human-controlled approval/spend, rights/creative canon and exact-head merge gates stay with their established owners. Learning findings may propose a software work order; Story and Game outputs retain PPF/right/rule boundaries; no cross-factory handoff silently changes canon.
- **One authoritative queue and evidence ledger:** SHT/card are *views and immutable records over existing work orders*; do not add an alternate database/scheduler/agent framework or manufacture independent QA by name.
- **Present status (2026-10-27 checkpoint):** #3311 is **DRAFT, unmergeable, not independently admitted at current changed W8/W9 digests**. The owner-Windows Supervisor was observed running, but coding worker, unattended two-cycle completion, signed Product Gate and automatic merge were not verified. This brief and owner comments **do not** change those observations.
- **Failure modes:** no synthetic PASS upgrades, no unauthorized worktree cleanup, no release from stale head, no silent provider retry, no cancellation of existing STOP and no fake completion from a healthy tunnel.
- **Rollback:** documentation can be reverted through normal Git history; future runtime rollout must be feature-gated and preserve prior ledger/card receipts, registry IDs, protected Human content and old stage custody during rollback.

### 13. Decision and source register

- [Human-approved four W8/W9 behaviors](https://github.com/BryanHarrisScripts/PlotPickle/issues/3142#issuecomment-6449639057).
- [Identity and accumulating SHT metadata decision](https://github.com/BryanHarrisScripts/PlotPickle/issues/3142#issuecomment-6449765406).
- [Final Inspection Card + correction-loop decision](https://github.com/BryanHarrisScripts/PlotPickle/issues/3142#issuecomment-6449831802).
- [Current #3311 review of lock unlink/replacement flaw](https://github.com/BryanHarrisScripts/PlotPickle/pull/3311) (review ID `5671721522`).
- [Original proposed but **not** approved test-truth digest packet](https://github.com/BryanHarrisScripts/PlotPickle/pull/3311#issuecomment-6448631062).
- [Earlier asynchronous Semantic Handoff scheduling agreement](https://github.com/BryanHarrisScripts/PlotPickle/issues/3142#issuecomment-6448727959).
- [Existing independent verifier contract #3302](https://github.com/BryanHarrisScripts/PlotPickle/issues/3302).

**Owner-facing commitment:** no routine hand-carrying logs or babysitting. The system does the work when genuinely enabled and authorized, and escalates meaningful decisions and blocked/uncertain states with exact evidence. Neither this document nor a running ChatGPT conversation constitutes an already-operating, unattended Factory.
