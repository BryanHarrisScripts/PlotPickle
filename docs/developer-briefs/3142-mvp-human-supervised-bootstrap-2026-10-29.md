# #3142 / #3274 — Human-supervised MVP Software Factory bootstrap
Date: 2026-10-29
Status: **Owner-directed proposed policy, not active release authorization**
Owner direction: **prove a working PlotPickle product and two complete human-supervised engineering cycles before investing further in automated Lane A credentials and autonomous merge infrastructure.**

## Scope and objective

Use the existing single authenticated Factory MCP tunnel, Windows supervisor, GitHub application and scoped PR worktrees to prove two **real engineering** cycles: authorized issue -> source change -> focused tests -> owner Windows evidence -> GitHub PR and required CI -> Human review -> Human-approved merge -> next issue. A source edit or test run alone is not one completed cycle.

The Human authorizes Phase 1 *mode selection* with the direction to prioritize product delivery and stop overengineering. This statement is **not** source-specific W8/W9 admission, endorsement of unreviewed test cases, or blanket merge approval.

## MVP working roles

- Human: approves each specific PR/test change against intended behavior and triggers or explicitly authorizes the exact-head merge. Saved story canon, production spend, credentials, release and STOP remain Human-controlled.
- ChatGPT engineering operator: edits bounded GitHub branches, diagnoses CI and tests, gathers authenticated read-only or allowlisted owner-Windows receipts, and proposes fixes. **Never labels its own approval independent.**
- Windows supervisor: reports STOP, heartbeat and exact-head ownership; RUNNING is not proof that an unattended coding agent exists.
- GitHub: preserves source, immutable commit identity, branch protection, the seven-layer Architecture Verification, security checks and merge history.
- Optional independent reviewer (future Phase 2): F00 registrar/signing root, Lane A admission, Lane B, fully unattended dispatcher and Worker 2 are **PARKED**, not deleted or silently activated.

## One bounded bootstrap governance decision before PR merges

The current implementation enforces `config/verification/test-catalog.json#truthGovernance` by checking exact test and input digests before CI. PRs #3334, #3335 and #3336 presently fail that guard for legitimate changed test/input editions. **Do not disable `scripts/verification-test-truth.mjs`, modify GitHub Actions to skip it, pretend a PR author's own verdict is independent, delete a regression to make checks green, or declare existing warnings irrelevant.**

The temporary MVP exception, *if specifically approved by the Human in GitHub for the exact PR source edition*, should permit a distinct `HUMAN_SUPERVISED_BOOTSTRAP` review classification. Its implementation must:
1. Require a Human review of the **actual exact PR head**, changed test/lockfile source and input SHA-256 digests, relevant normative obligations, expected positive/negative outcomes and explicit evidence limits.
2. Preserve all existing truth references, test executions, security checks, STOP semantics, sensitive data restrictions and product proof. Binding digest maintenance must be traceable to the Human-approved edition; an author-side catalogue edit cannot itself count as Human approval.
3. Fail closed on changed PR head, insufficient Human identity, expired approval, altered test/implementation input, reused/ambiguous approval or missing CI. Do not add a global bypass switch, repository-wide relaxation or untrusted PR-comment authority.
4. Use the established GitHub owner/reviewer credential and an externally attributable exact-edition review record. Treat the review as **Human-supervised**, not cryptographically independent F00 attestation.
5. Expire after **two human-supervised, verified merged engineering PRs** or **2026-11-30**, whichever happens first, unless renewed through another explicit owner approval. Require another proposal before autonomous production authority.

This policy document describes the change; **the active guard remains unchanged** until the narrowly scoped mechanism and exact-edition approvals are implemented and verified in their own reviewed change. It is never itself a green-check override or approval receipt.

## First-order execution order

1. Prioritize high-risk RE2JS dependency fix #3334 and CodeQL tunnel fix #3336 while retaining the existing exact-head security gates. Owner review and tracked resolution on MAIN are required before closing alerts #72/#73.
2. Finish one actual coding pilot #3335 on #3142 (private work-order redirected-parent denial) with its negative regression, source-specific Human approval, owner-Windows tests, CI, and verified merge.
3. Select a *different issue* and repeat the same complete human-supervised cycle. Count **0/2** until the first is independently observable as merged; count **1/2** only after the first real merge receipt and tests, **2/2** after the second.
4. Use PlotPickle Story Builder to deliver the first Brotherly Love Mini-Block 01 (25 editable shots), including Save/Lock, provenance and reviewable graphic-novel and narrated-motion progression. No fabricated provider output or canon changes.
5. After the MVP milestone, reassess whether an independently signed F00 and more coding workers solve an observed scaling need.

## Non-goals and preservation

No extra tunnel, new cloud service, always-on unattended ChatGPT session claim, legacy Pi job replay, key copying, signed-admission impersonation, CI-disabling toggle, automatic vulnerability dismissal, automatic worker expansion, or automatic merge. Historical blocked queue receipts and dormant F00 work remain untouched.

## Acceptance truth

Success is a working product slice and two evidence-backed merged source PRs under Human supervision. This document is a planning and governance proposal, **not** one of those two engineering cycles and not a release gate PASS.
