# PlotPickle Review Stage

<!-- PLOTPICKLE:OSS-INFLUENCE:sideshow -->

## Purpose

The Review Stage is PlotPickle's shared projection and feedback-delivery contract for Human review of developer evidence and creator/story evidence. It does not own project canon, deterministic PASS/FAIL, agent execution, or persistence.

The contract follows five product rules:

1. show the work;
2. ground it in exact evidence and source revision;
3. ask the Human for a bounded decision or comment;
4. route feedback to the exact responsible Agent or existing review authority;
5. preserve provenance while leaving canonical mutation to its existing owner.

## Existing authorities reused

The Review Stage deliberately projects existing systems instead of creating another store.

| Concern | Existing authority | Review Stage role |
|---|---|---|
| Developer/UAT evidence | UAT Semantic Review and deterministic verification | Project events, evidence and Human annotations into one review session |
| Creator/story feedback | Unified Feedback and project review threads | Project target-anchored review records into the same session/item/part shape |
| Agent work | Responsibility Runs | Address feedback to the exact Agent/run; do not create a second agent harness |
| Creative approval | Responsibility Run writer decisions and Creative Transactions | Display decision state; never self-promote a candidate |
| Canon mutation | PPF / revision-aware apply and Creative Transaction commit boundaries | No write authority |
| Persistence | Existing profile-private/project/run providers | Persist Review Stage envelopes through the owning provider, not a new database |

The shared implementation is `lib/review-stage.ts`. Sessions are explicitly `projectionOnly: true`, and every item is `canonicalMutationAllowed: false`.

## Developer story

The built-in UAT Semantic Review remains the deterministic source of truth. `app/api/auth/uat-guide/route.ts` projects the current UAT run into a developer Review Stage session and preserves the original Human review record for UI compatibility.

Human comments also receive a durable Review Stage feedback envelope with an exact item identity and target Agent identity. Duplicate submissions with the same run, event, decision and comment resolve to the same feedback identifier. Delivery is idempotent and rejects the wrong Agent.

Human review never changes the deterministic event result. A FAIL remains a FAIL until the deterministic authority records a later retest.

## Creator story

`app/feedback-workspace.tsx` projects the existing Unified Feedback model into a creator Review Stage session. Exact project/story target references remain owned by Unified Feedback. Existing comments, proposed changes and resolutions become Review Parts; the Review Stage itself never writes story fields.

A linked revision that differs from the current project revision is marked stale. Stale evidence remains visible as history, but a later acceptance or apply path must revalidate against the current source before canonical mutation.

## Feedback lifecycle

The shared lifecycle is:

`feedback-created → pending-delivery → delivered-to-agent → acknowledged → acted-on / answered → resolved`

The envelope records Human actor, session, item, exact target Agent and timestamps. Delivery and acknowledgement are idempotent after the transition has occurred. Attempts to deliver or acknowledge as a different Agent fail closed.

The lifecycle is observable state, not chain-of-thought. Review Stage content may show evidence, conclusions, proposed changes and concise responses, but must not expose hidden reasoning.

## Accessibility and Surface Grammar

Review Stage is an experience-layer contract rather than a new visual system. Existing Skin V1/UAT and Feedback surfaces retain their keyboard, focus, semantic HTML, reduced-motion, contrast and Surface Grammar obligations. Any future dedicated Review Stage surface must use the same shared contract and existing presentation primitives.

## Local/cloud and permissions

The Review Stage does not change Story Mode or provider routing. Default UAT remains local and zero-spend. Creator review inherits the capabilities and consent boundaries of the workflow that produced the proposal. A review action cannot expand an Agent's permissions, connector scope, context scope, cloud budget or canon authority.

## OSS acknowledgement

PlotPickle's Review Stage was influenced by the open-source Sideshow project from modem-dev/sideshow, particularly the idea of a visual companion surface where agent work can be inspected and Human feedback can stay attached to the work being reviewed.

Sideshow is MIT-licensed. PlotPickle does not embed Sideshow, depend on its runtime, copy its UI identity, or claim affiliation with its authors. This implementation is native PlotPickle code built on PlotPickle's existing UAT, Unified Feedback, Responsibility Run, Creative Transaction and PPF authorities. If source code is copied from Sideshow in a future change, that change must preserve the applicable MIT copyright and licence notice.

## Acceptance invariants

- Developer and creator review use the same Review Session / Item / Part / Evidence / Decision model.
- Review items carry exact subject and source-revision references.
- Stale evidence is explicit.
- Human comments cannot change deterministic PASS/FAIL.
- Review feedback can target only the intended Agent and duplicate delivery is idempotent.
- Agent responses are observable outputs, not hidden reasoning.
- Creator review remains projection-only and cannot mutate canon.
- Creative Transactions / PPF remain the only canonical apply/commit path.
- There is no Review Stage database, canon store, story store, provider router or second agent harness.
