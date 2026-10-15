# #2997 — Deterministic CMD current production task selection

## Purpose and observed failure

Brotherly Love Block 01 already has an admitted local production task. The current CMD status, resume and cancel paths choose the last task after filtering the gateway list. The gateway deliberately emits active tasks before settled history, so an older cancelled task can take precedence. PR #2996 is merged and does not address this lifecycle-selection error.

## Authority and scope

The authenticated server remains the owner of durable task IDs and encrypted checkpoints. CMD may read currently authenticated task views and dispatch explicit lifecycle commands, but must not create duplicate inference or infer completion. No screenplay, imported project, canon, provider routing, credit ceiling or MiniMAX H3 configuration changes.

## Implementation

- Use one shared selector for CMD status, resume and cancel, filtering current project/material receipt, exactly one Block, production type, and production grant evidence. Preserve the existing authenticated profile boundary.
- Prefer executing states over settled history. Within either class use immutable run creation time, then stable run ID as a tie-break. Do not use gateway ordering or task update time.
- Pin automatic reconciliation and post-lifecycle status to the exact run ID returned by admission/selected for the action. A missing pinned record must not fall back.
- Existing scheduler controls, encrypted history and cancellation protections are unchanged.

## Truth and test evidence

Approved source: WHITE-PAPER-V3 obligations W8 and W9 from the current trusted base. Synthetic targeted regressions are added to the existing governed #2995 node-test binding with refreshed full-file SHA-256 digest. They cover older cancelled/newer queued tasks in both orders; multiple settled tasks and creation ties; wrong project, profile, source receipt, Block, grant and task kind; missing task and pinned identity. These are fixture-level claims only, not proof of real Brotherly Love task state.

Required: truth admission, focused node regression, focused UAT contracts, production build, independent review, convergence and required exact-head GitHub PR/Product gates. The Windows protected task's real state must be read separately, only after corrected code is running. No automatic replay, cancellation or new production pass during this repair.
