# PlotPickle PR release testing — one Human evidence loop

Status: Proposed operating procedure for Human review. This document does **not** change
`AGENTS.md`, `docs/PLOTPICKLE-PRODUCT-CONTRACT.md`, the W8/W9 normative source,
GitHub branch protection, or existing reviewer/Product Gate authority. Do not treat
a passing checklist, approval comment, or document merge as proof that a missing
independent Windows gate ran.

## Intent

Keep verified work moving to MAIN rather than accumulating a shelf of green PRs.
Reuse the OSS Radar reporting principle: **one existing record, concrete evidence,
one Human disposition, no redundant issue or category**. The record for software
is the existing PR's `PlotPickle Development Run` ledger/comment, not a new
release issue, queue, label, status taxonomy, dashboard, service or signer.

Each PR carries only the product test steps actually relevant to its changed
behavior, selected using `config/development-verification-routing.json` and the
existing `lib/verification/development/proof-routing.mjs`. No new manual
risk categories are introduced. Documentation-only changes normally need no
Windows app launch. Authenticated Factory, security and worker/release changes
retain their independently grounded requirements.

## One PR at a time — the release procedure

1. **Prepare** — Identify the PR and exact current 40-character head SHA,
   scope, issue promise, risk/proof obligations selected by existing routing,
   rollback path and Human-visible product change. Review the actual diff.
2. **Automated proof** — Record the exact-head GitHub Architecture Verification,
   relevant focused tests/build, existing convergence results and Windows CI
   jobs. Cite run/job URLs, including SKIPPED or FAILED outcomes. A skipped
   *required* job is not a PASS. Architecture CI does not prove a live app.
3. **Human acceptance test** — Stage the *same* exact PR head in an isolated
   candidate worktree/approved preview. Do not run unreviewed candidate code
   using owner credentials or change installed MAIN. The Human performs the
   short, change-specific steps below and links observed evidence. Record
   `NOT_RUN` if the app is shut down or candidate installation cannot be
   trusted; do not infer PASS from screenshots of another revision.
4. **Review the source and test promise** — A qualified reviewer other than the
   implementation author checks the changed source/test assertions against
   their pinned W8/W9 obligations. Record attributable exact-edition approval
   through the existing protected process if required. Human product acceptance
   may attest observed UX/intent; it is **not** an F00-signed independent
   security verdict or a substitute for an admitted source/test edition.
5. **Decide** — Human returns one disposition on this PR:
   `PASS` (the listed product behaviors were genuinely observed),
   `FIX` (specific repro and expected behavior), or `BLOCKED` (unavailable
   environment, missing reviewer/receipt, unclear result). Update the existing
   ledger comment; do not create new tracking categories or daily PR issues.
6. **Release** — Only when *all* applicable PR Gate and Product Gate obligations
   are satisfied for the **same current head**, the owner-authorized merger
   checks current head/branch and merges using GitHub's expected-head guard.
   Read back merged SHA and MAIN. If another PR changed MAIN first, update the
   remaining branch and retest; stale green results never authorize merging.
   Keep the issue open for promises not delivered by the merged slice.

The Human test takes the place of *repeating discussion* of acceptance, not
of independent evidence or a privileged gate. If a true required verifier is
unavailable, record `BLOCKED` and the single next unblock action. Never
rename `UNVERIFIED` to `PASS` to clear the board.

## Human release-test record — paste into the existing PR ledger

Use this compact section **once per exact tested head**. Edit that same
ledger/comment as facts change, as OSS Radar updates the same report rather
than creating an issue for every review.

```text
PLOTPICKLE HUMAN RELEASE TEST — PR #____
Issue / change: ____
Candidate 40-char SHA: ____
Trusted MAIN baseline SHA: ____
GitHub CI run URL + result: ____
Existing routed required product proofs: ____
Candidate preview/source evidence (receipt/link): ____
Human test steps performed (observed, not inferred):
  1. ____ -> PASS / FAIL / NOT_RUN, evidence: ____
  2. ____ -> PASS / FAIL / NOT_RUN, evidence: ____
  3. ____ -> PASS / FAIL / NOT_RUN, evidence: ____
Protected source/test edition review: APPROVED receipt/link / PENDING
Independent Windows/Product Gate (if required): PASS receipt/link / PENDING
Human identity / date / decision: ____ / ____ / PASS | FIX | BLOCKED
Defect or blocker (if any): ____
Next action / rollback: ____
Merge authorization: only after all required exact-head gates PASS.
```

A Human `PASS` means the Human actually exercised the described product
behavior. It cannot be generated by the source author, a passing fixture,
a fabricated reviewer, a stale image, or an automated script echoing PASS.
Never paste private tokens, profile content, story files or private key material
into GitHub.

## Examples using the existing backlog (not approvals)

- **#3370**: test recovery's original consumed grant, exact blocked phase,
  no-write reconciliation, STOP and no-replay on the actual owner Windows
  host; obtain *independent* W8/W9 and applicable privileged Product Gate.
  Prior isolated 7/7 recovery tests are useful evidence, **not** release.
- **#3371**: open candidate Settings > Compute > Services; observe
  self-development option, disabled activation, normal creative path, no
  unexpected permissions or Factory activation. Include a compact layout
  check and approved native candidate/owner Windows observation.
- **#3372**: open candidate Collab > Elara Agent Workspace; observe source
  match, durable conversation readback, honest NOT ASSIGNED specialist,
  blocked/unknown handling and responsive layout. Do not claim specialist
  execution or merge from the UI.
- **#3373**: create/read a mission draft with a real authenticated local
  profile after reauthentication; reject unauthorized/cross-origin writes,
  preserve profile isolation/restart readback and never start an agent.
  Require the appropriate independent security/Windows proof. Coordinate
  this PR with #3372 because both change the test catalogue.

These four PRs started from the same old MAIN. Review and merge eligible PRs
**serially**, reconcile their overlapping protected catalogue editions after
each merge and re-run exact-head CI. Do not attempt batch merges using each
PR's original green SHA.

## What this deliberately does not build

No new PR classification system, new F00/Windows service, replacement
Product Gate, additional CI workflow, separate ledger, default-on release
automation, fake reviewer identity or source-truth exception. Any actual
change to the locked release contract requires its own explicitly reviewed
contract amendment; this procedure alone does not enact one.

Next iteration, only after the first real Human acceptance record is used:
make the existing ledger render or prefill these fields if repetition is
measurable. Prefer a short working Human test over more governance machinery.
