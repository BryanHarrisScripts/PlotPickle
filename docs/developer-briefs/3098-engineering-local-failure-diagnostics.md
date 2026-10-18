# #3098 — Real Windows BLOCKED attempt: evidence-preserving local diagnostics

Issue #3098 / parent #3096. The operator's first real on-host Engineering
Team campaign on main \`35ef622a8...\` returned only:

    Engineering Team blocked: Engineering Team run was blocked; the reserved attempt cannot automatically replay.

The previous CLI hid *all* errors (including missing managed Pi Durable or
unavailable Pi/Cline/model) behind a single generic string, wrote only
\`execution-or-evidence-failure\` and prevented operator inspection of the
reservation in \`operator-reporting.mjs\`, which lists completed receipts.

## Scope: do not retry or fabricate a root cause

The original private failed task and exact checked-out commit are preserved.
The first run has no typed error; its root cause **cannot be reconstructed**
from the displayed stderr. It may have stopped before any actual provider
request or may contain a write-once uncertain-dispatch marker. Never delete
the reservation, truncate private JSONL, reset profile/model credentials or
recommend a new \`--attempt\` from a missing diagnostic alone.

This fix adds read-only command:

    node scripts/engineering-team/diagnose-local.mjs --latest --json

Optional \`--head <40hex>\` selects a matching checkout history. It reports
only validated private reservation metadata, sanitized new failure code and
execution phase, saved/started/uncertain file **counts**, and existing
managed-Pi/managed-Pi-Durable installation readiness. It never prints model
text, source files, prompt, stderr, raw provider exception, user identifiers
or a private filesystem path. It does not modify any record, run a model,
install a package, start Cline or resume a task. The existing pre-fix
generic failure reports \`LEGACY_FAILURE_NOT_CLASSIFIED\` and phase UNKNOWN.
A step started marker signals possible ambiguity, *not* proof of real provider
network delivery. Neither missing marker nor saved evidence proves an
inference occurred.

Future explicit executions record one of the reviewed bounded phase names
(adapter-selection, native-runtime-open/admit/resume/wait/check, role started/
dispatch/saved, local-buzz), an allowlisted role, and a sanitized typed error
category, e.g. \`PI_DURABLE_UNAVAILABLE\`,
\`REVIEW_ADAPTER_UNAVAILABLE\`, \`CLINE_VERSION_MISMATCH\`,
\`UNCERTAIN_STEP_REPLAY_DENIED\` or \`EXECUTION_FAILED_UNKNOWN\`.
Unknown details remain unknown, and the full exception is never copied to
public telemetry or GitHub. Existing \`failure.json\` and Pi Durable state are
immutable. A later \`--resume\` logs a separate sanitized resume-failure,
without overriding the original failure.

## Acceptance / next steps

First inspect the original attempt without dispatch:

    git rev-parse HEAD
    node scripts/engineering-team/diagnose-local.mjs --latest --head (git rev-parse HEAD)

On PowerShell use \`$head = git rev-parse HEAD\` and
\`--head $head\` instead of POSIX shell substitution.

If Pi Durable is missing, the user can explicitly authorize its existing
managed installer through the supported setup flow; never auto-install
based on a read-only status. If an uncertain step marker exists, no retries
until its protected evidence has been independently reconciled.

Synthetic regression covers legacy failure, privacy leak, stale/malformed
scope, mixed finished/uncertain artifacts, intentional stage observation
and duplicate refusal. GitHub CI is *not* a Windows provider proof. Run
targeted tests + all required WHITE-PAPER-V3 W8/W9 bindings, independent
exact-head CI, and merge only green. The parent issue remains OPEN pending
a source-bound actual Pi/Cline/UAT campaign and true native recovery evidence.
