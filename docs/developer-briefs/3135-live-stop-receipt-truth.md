# #3135 — first bounded increment: truthful remote STOP evidence

Issue #3135 follows a real authenticated Windows START/STATUS/STOP round-trip on current main. Issue #3132 dispatched a contracts-only child. Status #3133 returned `observed-pass`; STOP #3134 also returned `observed-pass` with `cancellationAcknowledged:false`, which means STOP occurred **after** the process completed. GitHub matching evidence is retained under parent #3110.

## Increment delivered by this PR

Fix the existing Windows UAT and authenticated GitHub reporting layer so every STOP receipt distinguishes:
- `ALREADY_TERMINAL_NOOP`: target was terminal before STOP; no cancellation occurred
- `STOP_REQUESTED_UNCONFIRMED`: stop request was recorded, but no child exit has yet been verified
- `DIRECT_CHILD_CANCELLATION_OBSERVED`: after a request, direct child exit was observed; descendant cleanup still unproven
- `CANCELLED_BEFORE_CHILD`: worker cancelled without launching a child
- `TERMINAL_DURING_REQUEST_UNPROVEN`: target became terminal during the stop request, causal cancellation not established
- `STOP_UNVERIFIED`: authenticated report lacks a recognized authoritative disposition and fails closed

`ownedDescendantsVerifiedGone:false` is always explicit in this slice because the existing production Windows worker only observes its direct child. The additional field is immutable advisory reporting; it does not change the queue, permit arbitrary shell/PID execution, alter `taskkill`, inject sleeps into production UAT, enable unattended polling, create permissions, dispatch Pi/Cline, or change Story Factory state.

## Verification

The two existing W8/W9 source-bound suites add negative tests for post-PASS STOP, repeat STOP, STOP-request without acknowledgement, pre-child cancellation and current GitHub receipt projection. Preserve their original oracles and refresh source/test SHA-256 input bindings exactly. The `config/development-convergence/3135-live-stop-receipt-truth.json` manifest requires local + paired code and tests to carry the semantics.

The actual *live* Windows process-tree STOP remains a separate next #3135 slice. It needs a safely bounded long-running disposable fixture, native running worker/owned child+descendant process existence, independent STOP acknowledgement, unrelated sentinel survival and exact-head private receipts. Do not infer that proof from green CI or a post-completion STOP. #3135 must remain OPEN after this reporting increment.
