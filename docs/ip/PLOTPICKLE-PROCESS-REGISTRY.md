# PLOTPICKLE PROCESS REGISTRY

**Registry version:** 0.1  
**Canonical as of:** 2026-08-22  
**Status:** Living architecture and IP-identification index

## Purpose

This document gives stable names to distinctive PlotPickle processes, methods, trust boundaries, and system concepts so that engineering, architecture, product documentation, invention review, licensing discussions, and future legal review can refer to the same thing consistently.

The naming convention is intentionally simple:

> **PLOTPICKLE + ONE WORD**

Architecture and IP-oriented documents use the uppercase form, for example **PLOTPICKLE CASEBOOK**. Normal product prose may use **PlotPickle Casebook**.

This registry is a naming and technical-lineage record. It does **not** determine patentability, inventorship, legal priority, trademark registration, freedom to operate, or ownership of generic words. Git history and linked implementation records can help reconstruct development history, but they are not a substitute for a formal invention disclosure or professional legal review.

## Registry rules

1. The word following PLOTPICKLE is one word or one established project token such as PPF.
2. A registry name identifies a stable method or architectural responsibility, not merely a screen label.
3. Existing code identifiers do not need to be mass-renamed when a registry name is adopted.
4. Registry names do not grant authority. Existing security, Human, PPF, Agent, Skill, and provider boundaries remain authoritative.
5. A later implementation may replace underlying infrastructure without changing the PlotPickle process name when the method remains the same.
6. Implementation anchors below are engineering-lineage references, not claims of first conception or legal priority.

## Locked architecture decisions

- **PLOTPICKLE CASEBOOK** remains PlotPickle-owned. It defines Business Cases, Human journeys, outcome evidence, fault checks, and attended control.
- **PLOTPICKLE NAVIGATOR** remains PlotPickle-owned. Microsoft Playwright is the current browser automation engine beneath it; Playwriter is not adopted. If a Business Case later proves that persistent or attached browser sessions are required, that capability is added behind NAVIGATOR rather than replacing Casebook.
- External systems such as Caura may be studied for useful governance concepts, but PlotPickle keeps ownership of its memory and authority model. Caura is not a PlotPickle dependency.
- **PLOTPICKLE CONTRACT** remains provider-neutral. Image-provider syntax belongs below the Contract boundary.
- Human, Agent, BUZZ, and Node/install identities remain separate authorities.
- PPF/canonical project state remains above retrieved memory, observations, peer material, and model assertions.
- A model, worker, or Human assertion alone is never sufficient evidence that an automated Business Case passed.

## Registry overview

| Canonical name | Existing technical lineage | Primary responsibility | Maturity |
| --- | --- | --- | --- |
| **PLOTPICKLE CASEBOOK** | Casebook Business Cases | Human-centered business-outcome verification | Active |
| **PLOTPICKLE NAVIGATOR** | Creative Browser | Browser interaction and observation abstraction | Active |
| **PLOTPICKLE GATE** | Human Authority Checkpoint | Protected Human-only authority transition | Active |
| **PLOTPICKLE EXECUTION** | Semantic Execution | Evidence-bound action, verification, and repair lifecycle | Active |
| **PLOTPICKLE LEDGER** | Responsibility Run / run telemetry | Attributable execution and evidence record | Active |
| **PLOTPICKLE CONTRACT** | Visual Contract | Provider-neutral visual constraint authority | Active |
| **PLOTPICKLE COMPILER** | Visual Contract prompt compiler | Provider-specific translation of a Contract | Active |
| **PLOTPICKLE CONTEXT** | Context Engine | Bounded, provenance-aware task context assembly | Active |
| **PLOTPICKLE MEMORY** | Creative/project memory | Governed retained knowledge below canon authority | Evolving |
| **PLOTPICKLE GRAPH** | Story Knowledge Graph | Derived story relationships with provenance | Active |
| **PLOTPICKLE BINDER** | Canon Binder | Promotion and retrieval of canonical creative decisions | Active |
| **PLOTPICKLE LOCKS** | Continuity Locks | Explicit continuity preservation constraints | Active |
| **PLOTPICKLE TRUST** | Agent Skill Trust | Procedure integrity and provenance without new authority | Active |
| **PLOTPICKLE VAULT** | Profile vault / profile-private storage | Per-Human encrypted private state | Active |
| **PLOTPICKLE IDENTITY** | Identity authority contracts | Separation and binding of Human, Agent, BUZZ, and Node identity | Active |
| **PLOTPICKLE REPAIR** | Evidence-driven bounded repair | Repair only from confirmed findings within bounded authority | Active |
| **PLOTPICKLE PPF** | Portable Project File / project specification | Portable canonical creative/project state | Active |

---

## PLOTPICKLE CASEBOOK

**Purpose:** Prove that PlotPickle can complete a real Business Case rather than merely proving that individual functions or tests execute.

**Method:** CASEBOOK defines a Human journey, drives automatable steps, pauses at Human-only authority, records before/after evidence, requires independent outcome proof, exercises bounded fault conditions, and retains a safe evidence record. A worker claim cannot make a Case green. In attended mode, a critical non-pass asks the Human whether to stop or continue to the next Business Case.

**Distinguishing boundaries:**

- Human authority participates in the protocol but cannot simply declare PASS.
- Secrets stay in PlotPickle/native prompts and are excluded from Casebook records.
- Independent proof and required fault detection remain separate from worker assertions.
- One failed case does not need to create a cascade of predictable downstream failures.

**Implementation anchors:** #1234, #1235, #1236, #1239, #1269, #1271, #1273; `scripts/run-casebook-attended.mjs`; `scripts/casebook-attended-runtime.mjs`; `scripts/creative-uat/casebook-phase3b3-live.mjs`.

**Related processes:** NAVIGATOR, GATE, EXECUTION, LEDGER, REPAIR.

**IP review note:** Candidate method/system for later prior-art and claim review; no patentability conclusion is made here.

## PLOTPICKLE NAVIGATOR

**Purpose:** Give PlotPickle a browser-control and observation layer that belongs to PlotPickle rather than to a particular automation vendor.

**Method:** NAVIGATOR exposes semantic browser actions, current-page observation, screenshots/evidence, navigation recovery, and Human-visible interaction while hiding the underlying browser automation implementation from higher-level Business Cases.

**Infrastructure policy:** Microsoft Playwright is the current engine. Playwriter is not adopted. Persistent-profile or attached-tab capability, if later required by a proven Business Case, belongs behind NAVIGATOR so CASEBOOK remains unchanged.

**Implementation anchors:** #1235, #1236, #1273; `scripts/creative-uat/browser-actions.mjs`; `scripts/run-creative-writer-uat.mjs`; `scripts/run-casebook-attended.mjs`.

**Related processes:** CASEBOOK, GATE, LEDGER.

**IP review note:** The potentially distinctive subject is the PlotPickle interaction/evidence method and ownership boundary, not Playwright itself.

## PLOTPICKLE GATE

**Purpose:** Protect actions that require a Human's authority, secret, consent, native approval, or irreversible decision.

**Method:** GATE suspends automated action, presents a Human-facing instruction, pauses sensitive evidence capture when required, allows the Human to act only in the authorized application/native surface, resumes only after explicit Human continuation, and then independently observes the result.

**Distinguishing boundaries:** Agents do not receive a Human's passphrase, private BUZZ key, native approval, or equivalent authority merely because the workflow needs it.

**Implementation anchors:** #1236 and #1269; `scripts/casebook-attended-runtime.mjs`; `scripts/run-casebook-attended.mjs`.

**Related processes:** CASEBOOK, NAVIGATOR, EXECUTION.

**IP review note:** Candidate Human-in-the-loop control method for later review.

## PLOTPICKLE EXECUTION

**Purpose:** Prevent an Agent/model from converting an assertion such as "done" into actual completion.

**Method:** EXECUTION keeps work scoped, requires an authorized target and current observation before bounded action, requires post-action observation before evaluation, and permits only bounded repair after failed verification. Completion requires evidence rather than model confidence.

**Implementation anchors:** #1218 and #989; Semantic Execution and verification-graph contracts and their issue-linked tests.

**Related processes:** CASEBOOK, LEDGER, REPAIR, CONTEXT.

**IP review note:** Candidate execution-control method; later review should distinguish PlotPickle's evidence and authority composition from general agent loops.

## PLOTPICKLE LEDGER

**Purpose:** Make automated work attributable and reviewable.

**Method:** LEDGER records a bounded Responsibility Run and related telemetry so that actor/profile, requested responsibility, tools/actions, evidence, timing, retries, provider/spend information where applicable, and outcome can be examined without granting the recorder execution authority.

**Implementation anchors:** #966 and #968; `build/responsibility-run-gateway.ts`; `build/run-telemetry-gateway.ts`; `tests/issue-966-responsibility-runs.test.mjs`.

**Related processes:** EXECUTION, CASEBOOK, REPAIR, TRUST.

**IP review note:** Candidate provenance/accountability system for later review.

## PLOTPICKLE CONTRACT

**Purpose:** Preserve visual intent independently of whichever image provider generates the asset.

**Method:** CONTRACT separates hard constraints, derived constraints, and open choices; assigns reference roles and attribute ownership; represents scene elements and relationships; carries geometry/composition/lighting/text requirements and negative constraints; and produces validation requirements that survive provider changes.

**Authority rule:** Locked project/character/reference authority cannot be weakened by decorative provider choices.

**Implementation anchors:** #1267; `.agents/skills/visual-contract/SKILL.md`; `core/visual-contract/visual-contract.ts`; Marquee integration in `modules/learn/model/marquee-director.ts`.

**Related processes:** COMPILER, LOCKS, BINDER, PPF.

**IP review note:** Candidate provider-neutral creative constraint method for later prior-art review.

## PLOTPICKLE COMPILER

**Purpose:** Translate a provider-neutral CONTRACT into instructions a selected generation provider can execute.

**Method:** COMPILER consumes the Contract rather than redefining intent. Provider formatting, syntax, or prompt style may change, while hard constraints, accepted story evidence, exact required text, negative constraints, and reference intent remain invariant.

**Implementation anchors:** #1267; `core/visual-contract/visual-contract.ts`; `modules/learn/model/marquee-director.ts`; `tests/issue-1080-marquee-marketing-reference.test.mjs`.

**Related processes:** CONTRACT, LOCKS, BINDER.

**IP review note:** Candidate translation layer; legal review should focus on invariant-preserving compilation rather than generic prompt generation.

## PLOTPICKLE CONTEXT

**Purpose:** Assemble only the information an Agent/task is allowed and needs to use, with explicit provenance and authority.

**Method:** CONTEXT assigns source type, source identity, trust, authority, allowed use, revision, timestamps, and bounded budgets. PPF/current authoritative material outranks approved memory; observed/federated/external material cannot promote itself into host instruction or canon.

**Implementation anchors:** #963; `lib/context-engine.ts`; `modules/creative-room/sage-context-engine.ts`; `modules/plan/foundations-context-engine.ts`; `tests/issue-963-context-engine.test.mjs`.

**Related processes:** MEMORY, PPF, TRUST, EXECUTION.

**IP review note:** Candidate trust/provenance context-composition method for later review.

## PLOTPICKLE MEMORY

**Purpose:** Retain useful creative/project knowledge without letting recalled material silently become canon or cross Human/project privacy boundaries.

**Method:** MEMORY is subordinate to PPF/canonical authority and is consumed through CONTEXT with provenance and allowed-use controls. Shared-memory governance concepts such as scope, provenance, lifecycle, and invariant policies may be strengthened inside PlotPickle when real Business Cases require them.

**Architecture decision:** Caura may be studied for governance concepts but is not installed and does not own PlotPickle memory. Potential lifecycle states such as candidate, confirmed, superseded, outdated, and archived are design vocabulary unless/until explicitly implemented and tested.

**Implementation anchors:** `lib/creative-memory.ts`; `lib/context-engine.ts`; project-memory handling in #963; memory-core work associated with #1200.

**Related processes:** CONTEXT, PPF, VAULT, IDENTITY.

**IP review note:** Evolving candidate area; do not treat planned lifecycle vocabulary as implemented fact.

## PLOTPICKLE GRAPH

**Purpose:** Represent derived story knowledge and relationships without creating a second source of canonical truth.

**Method:** GRAPH derives nodes/relationships from story evidence while retaining provenance and evaluation boundaries. Derived graph material remains subordinate to canonical PPF state and can be regenerated or challenged from source evidence.

**Implementation anchors:** #999 and Story Knowledge Graph tests/contracts.

**Related processes:** PPF, CONTEXT, MEMORY.

**IP review note:** Candidate provenance-preserving derived-knowledge method for later review.

## PLOTPICKLE BINDER

**Purpose:** Collect and expose canonical creative decisions and approved visual/story references as a stable source of truth.

**Method:** BINDER distinguishes approved canon from exploratory candidates and gives downstream tools a canonical retrieval surface instead of allowing generated candidates to self-promote.

**Implementation anchors:** `lib/canon-binder.ts`; `app/visual-canon-binder.tsx`; `docs/PHASE-7-CANON-BINDER.md`; `docs/adr/0004-canon-binder-source-of-truth.md`.

**Related processes:** PPF, LOCKS, CONTRACT, CONTEXT.

**IP review note:** Candidate canon-promotion/retrieval method for later review.

## PLOTPICKLE LOCKS

**Purpose:** Preserve approved identity, appearance, world, scene, and visual continuity facts across exploration and generation.

**Method:** LOCKS express constraints that exploratory/generative operations must preserve, allowing variation around open creative choices without altering locked continuity authority.

**Implementation anchors:** `lib/continuity-locks.ts`; `app/continuity-locks-panel.tsx`; character/world visual development and continuity references.

**Related processes:** BINDER, CONTRACT, COMPILER, PPF.

**IP review note:** Candidate continuity-governance method; later review should distinguish it from ordinary negative prompting.

## PLOTPICKLE TRUST

**Purpose:** Allow a Skill/procedure to be verified and discoverable without granting it capabilities or authority.

**Method:** TRUST records deterministic package integrity/provenance for Agent Skills, supports quarantine of untrusted external procedures, invalidates approval when package content changes, and keeps capabilities/authority owned by the host rather than the Skill.

**Implementation anchors:** #976; `config/agent-skill-trust.json`; Agent Skill trust runtime and tests.

**Related processes:** CONTEXT, LEDGER, EXECUTION.

**IP review note:** Candidate procedure-integrity/authority-separation method for later review.

## PLOTPICKLE VAULT

**Purpose:** Keep each Human's private PlotPickle state encrypted and isolated, including on a physical computer shared by multiple Humans.

**Method:** VAULT derives/uses profile-scoped cryptographic authority and stores profile-private state as protected local records. Project data, private credentials, memory, retrieval/private caches, and other private state cannot become visible merely because another Human uses the same machine.

**Implementation anchors:** #1140 and #1141; `docs/architecture/PLOTPICKLE-PROFILE-VAULT.md`; `core/storage/profile-private/`; local credential/profile-private gateways.

**Related processes:** IDENTITY, MEMORY, PPF.

**IP review note:** Candidate composition of local-first multi-Human isolation; underlying cryptographic primitives themselves are not claimed by this registry.

## PLOTPICKLE IDENTITY

**Purpose:** Prevent Human, Agent, BUZZ, and PlotPickle Node/install identities from being conflated.

**Method:** IDENTITY assigns each identity class its own authority and binding rules. A BUZZ signer can represent a Human or Agent in community transport without becoming the PlotPickle Human login authority, and a Node identity does not inherit a Human's project authority.

**Implementation anchors:** #1072, #1123/#1124, #1137, #1144, #1212; PlotPickle Auth core; BUZZ Human identity guard and profile-scoped BUZZ gateways.

**Related processes:** VAULT, TRUST, CASEBOOK, GATE.

**IP review note:** Candidate multi-identity authority/binding architecture for later review.

## PLOTPICKLE REPAIR

**Purpose:** Make automated repair evidence-driven, bounded, and incapable of broadening its own authority.

**Method:** REPAIR accepts confirmed findings rather than speculative Agent assertions, clusters/limits affected targets, performs bounded retries, requires post-repair verification, preserves failed approaches as failure/recovery history rather than successful procedure knowledge, and cannot silently expand the original task scope.

**Implementation anchors:** #989 and #1218; verification execution graph and Semantic Execution tests; existing isolated UAT repair-worker boundaries.

**Related processes:** EXECUTION, CASEBOOK, LEDGER, TRUST.

**IP review note:** Candidate closed-loop verification/repair method for later review.

## PLOTPICKLE PPF

**Purpose:** Provide a portable canonical project representation that keeps story/creative authority independent of any Agent, model, provider, or UI session.

**Method:** PPF carries canonical project state, structured creative decisions, revisions/provenance, and references needed by downstream PlotPickle processes. Agents may draft or propose changes, but PPF authority is controlled by the host/Human workflow rather than by model confidence or retrieved memory.

**Implementation anchors:** `docs/specification/PROJECT-SPEC.md`; PPF/project specification and revision-guard architecture; Canon Binder and Context Engine integrations.

**Related processes:** BINDER, CONTEXT, MEMORY, GRAPH, CONTRACT, LOCKS.

**IP review note:** Candidate portable creative-state architecture for later review; file-format and method claims require separate legal analysis.

---

## Relationship map

```text
PLOTPICKLE CASEBOOK
    ├── PLOTPICKLE GATE
    ├── PLOTPICKLE NAVIGATOR
    │       └── Microsoft Playwright (replaceable infrastructure)
    ├── PLOTPICKLE EXECUTION
    │       └── PLOTPICKLE REPAIR
    └── PLOTPICKLE LEDGER

PLOTPICKLE PPF
    ├── PLOTPICKLE BINDER
    ├── PLOTPICKLE LOCKS
    ├── PLOTPICKLE CONTEXT
    │       ├── PLOTPICKLE MEMORY
    │       └── PLOTPICKLE GRAPH
    └── PLOTPICKLE CONTRACT
            └── PLOTPICKLE COMPILER

PLOTPICKLE IDENTITY
    ├── PLOTPICKLE VAULT
    ├── Human / Agent / BUZZ / Node separation
    └── PLOTPICKLE TRUST
```

## Invariant examples

The registry names are most useful when paired with stable rules. Current PlotPickle invariants include:

- Retrieved or remembered material cannot promote itself to canon.
- A model saying "done" cannot make EXECUTION complete.
- A worker claim cannot make CASEBOOK pass.
- A Human may provide required authority at a GATE, but Human confirmation alone does not replace independent automated outcome evidence when a Case requires it.
- A Skill can be trusted without receiving new authority.
- A BUZZ identity is not automatically a PlotPickle Human identity.
- One Human cannot retrieve another Human's VAULT state merely because both use the same Node/computer.
- A generated visual candidate cannot override BINDER/LOCKS/PPF authority.
- Provider-specific COMPILER output cannot weaken CONTRACT hard constraints.
- Failed repair approaches are evidence of failure/recovery, not verified successful procedures.

## Adding a new registry entry

A new PLOTPICKLE name should be added only when all of the following are true:

1. The method has a distinct responsibility or repeatable process.
2. Its boundary can be described without naming a particular vendor/model unless that vendor is inherently part of the method.
3. Existing PlotPickle authority can be stated clearly.
4. At least one implementation, issue, test, ADR, or design record can anchor the technical lineage.
5. The name does not imply a legal conclusion that has not been made.

For later formal invention review, create a separate disclosure record with the problem addressed, alternatives/prior approach, method steps, distinguishing characteristics, contributors/inventorship facts, dated implementation evidence, public-disclosure history, and relevant prior-art search results.