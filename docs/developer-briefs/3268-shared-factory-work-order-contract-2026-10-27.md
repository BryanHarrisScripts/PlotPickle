# Shared Factory Work Order and Semantic Handoff Method
## #3268 · #3142 · #3302 · approved extension · 27 October 2026

**Status:** Owner-approved methodology, not a deployed multi-factory dispatcher. Source of governance: [README](../../README.md), [Organization Chart](../PlotPickleOrganizationChart.md), #3142 Semantic Handoff and immutable evidence, WHITE-PAPER-V3 W8/W9, and merged [Service Manager brief](3268-always-on-single-installer-service-manager-2026-10-27.md).

## One operating pattern, four different domain contracts

All four factories use the **same bounded work-order lifecycle** but not interchangeable acceptance authorities. Core stages:

`INTAKE → REQUIREMENT_PINNED → ELIGIBILITY/GRANT → CLAIM/RESOURCE_LEASE → EXECUTE → DOMAIN_TEST → INDEPENDENT_INSPECTION → DOMAIN_APPROVAL → RELEASE/HANDOFF → NEXT_ELIGIBLE`.

Every transition requires a durable, uniquely attributed event bound to `workOrderId`, `factoryId`, `executionId`, source/contract revision, actual principal, current authorization, evidence hashes and the previous event digest. The `Semantic Handoff Token` is an address/reference to existing work-order evidence—not a bearer credential and not an approval signature.

Each factory supplies a **versioned capability profile** (`workerRole`, `skillSetRevision`, `domainContractRevision`, `toolAllowlist`, `provider/expenseEnvelope`, `resourceRequirements`, `independentVerifier`, `HumanApprovalGate`, `publicationAuthority`, `STOP/recoveryPolicy`). Profile selection is not permission: a separate owner-issued grant must be checked at execution time and again before irreversible steps. No work order can grant a worker capabilities it did not already possess.

| Factory | Worker specialization | Domain test and independent inspection | Final authority |
| --- | --- | --- | --- |
| F01 **Software Factory** | Scout, coder, build/integration tester, issue dispatcher | Source diff, deterministic tests, exact-head CI, independent QA, real owner Windows/browser Product Gate | Granted green-only PR merge/release controller, never self-approved |
| F02 **Learning & Evolution** | Researcher, source assessor, curriculum evaluator, Skills specialist | Provenance, source reliability, competing evidence, teaching usefulness, safety/rights, independent evaluation | Authorized lesson/Skill/knowledge admission; research findings remain proposals until then |
| F03 **Story Builder** | Script analyst, production designer, storyboard/keyframe/motion/audio specialists | Exact PPF scene/shot references, rights, character/world continuity, artistic/technical quality, provider/cost receipts | **Human** Save/Lock, canon and publication choices; no automatic accepted creative canon |
| F04 **Game Factory — The Unwritten** | Rules/world builders, game logic developers, testers, playtest coordinator | Deterministic legal moves and state, rules consistency, knowledge boundaries, reproducible playtests, rights | Authorized game rules/world release; play-session outcomes never rewrite PPF canon |
| **Semantic Story Coordinator** (not a Factory) | Narrative causality and cross-medium consistency | Selected PPF revision, references and alternatives, rights/continuity impact | Proposals to author; cannot promote to canon or release itself |

A shared gate `INDEPENDENT_INSPECTION` means evidence comes from a separately credentialed, independently qualified principal who did not author the candidate; **it does not** mean QA can make creative or rights decisions for the Human.

## Immutable errors, retries and next work

- `FIX`/failed inspection creates a linked, fingerprint-deduplicated corrective work order, retaining the original attempt and inspection history. It does not erase a failing verdict or replay an uncertain action.
- `STOP_REQUESTED`, expired/revoked grant, invalid exact revision, lost claim, unknown process owner and incomplete receipts block new work; never automatically clear STOP or resume a paid or irreversible action.
- A work order can become eligible for `NEXT_ELIGIBLE` only after its actual domain-specific approval; mere model output, a green synthetic fixture, heartbeat or service startup is not delivery.
- Independent per-job/per-resource ownership is required before more than one coding or media worker operates concurrently. Two distinct worker labels inside the same process do not prove independent execution.
- Separate work from the manager: the always-on PlotPickle Service Manager owns **service lifecycle and observation**, not factory tasks, artistic canon, truth administration, signer credentials or release approval.
- Factory-specific Skills and contracts are versioned interfaces to the *same* queue, leases, semantic handoff ledger and service health/inventory. Avoid four competing dispatchers or service managers.

## Initial technical embodiment

The first #3268 code slice, `core/sidecars/runtime/unified-service-inventory.mjs`, only lists registered services and planned factory responsibilities; `scripts/engineering-team/windows/services/inspect-unified-services.mjs --status` reads existing status sources without starting processes. This is a **status projection**, not the shared work-order engine and not proof that factories or independent reviewer processes exist.

**Independent admission requirement:** New test editions in `tests/issue-3268-unified-service-inventory.test.mjs` must be reviewed against approved WHITE-PAPER-V3 W8/W9 and registered at exact source hashes by a genuinely separate authorized reviewer before they can pass the protected test-truth gate. Do not self-admit in this PR.

## Scope of future delivery

1. Read-only inventory and diagnostic categories, with no action or grant.  
2. Independently verified Windows identities, signed reviewer receipts and source-bound tests.  
3. Bounded reusable work order/claim/evidence contract; begin with one genuine Software Factory cycle.  
4. Domain-specific F02/F03/F04 worker profiles and verification gates; stage as disabled until proven.  
5. Coordinated always-on Windows Service installation, future workers, UI and controlled issue promotion.  

This deliberately does not authorize autonomous model spend, narrative publication, a new identity, second tunnel, background inference, or unverified merges.
