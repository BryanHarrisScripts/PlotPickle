# #3099 — BUZZ local Engineering Team handoffs and measured communication study

Parent #3096, local execution #3098, experiment follow-up #3099.

## Narrow implemented scope

Use PlotPickle's existing scripts/buzz-live-activity.mjs local Node journal.
The Human signer is not used for agent operational events. A locally recorded
event is not an externally signed BUZZ message. Local summary events preserve
the campaign/run/task references, role origin/recipient, receipt counts and
unverified status without copying model output, full evidence paths, prompts
or hidden reasoning into a shared room.

An on-demand Engineering Team command can include --buzz-local to opt in to
local BUZZ journaling, e.g.:

    $head = git rev-parse HEAD
    $base = git merge-base origin/main HEAD
    node scripts/engineering-team/run-local.mjs --run --head $head --base $base --task pr-3099 --mode structured --buzz-local

This does not post remotely or initiate a cloud request. The operator must
already meet the same clean-checkout, exact-head and approved local provider
constraints as #3098. BUZZ stores handoff metadata in the existing local
backbone and the richer underlying execution receipt remains private.

## Experiment contract

Measure the serialized bytes and number of actual structured versus lossy
handoffs and role observation counts from two already completed on-demand
campaign receipts. Both arms require the exact commit, task reference, role
roster and budget. The comparison blocks stale, cancelled, partial or
unmatched arm results. This early-stage report deliberately leaves defect
detection effect, false-positive rate, provider cost and winner/conclusion
unknown until independently verified experiments have the necessary real
receipts and independent adjudication.

No finding can be promoted to verified from a BUZZ message or agreement among
models. Neither mode changes the source-of-truth ledger or GitHub merge gate.

## Evidence scope and risks

Node tests prove bounded local journal writes, proper Guildhall routing,
lossy payload reduction, matched-arm input constraints, rejection of
privilege-raising messages, and no use of external signing.
This is not a field result from two actual Pi/Cline workers; simulated
role adapters are used in the CI tests. External BUZZ signed agent identity,
real relay round-trip, controlled ordering/randomization, reliable duplication
protection under competing processes and independent defect-rate evaluation
remain unproven and are not enabled by this package.

The versioned local journal is a best-effort coordination record, not
a durable transaction log. #3099 remains open until the real controlled trial
and agent-signature acceptance are demonstrated.

The exact-head Architecture Verification and approved White Paper V3
W8/W9 truth bindings govern merger of this source-only increment.
