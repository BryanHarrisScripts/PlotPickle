# #3110 first local control slice — contracts-only Windows UAT

## Purpose and limits

PlotPickle is a **human-governed Story Factory built and maintained by a
human-governed Software Factory**. This is only the first local Software
Factory execution primitive, not the story pipeline or remotely connected
Chat/Work automation.

The Windows command at scripts/windows-uat-control.mjs
implements local, opt-in, exact-head, bounded **contracts-only** UAT
with a private immutable reservation. It does not:
- connect Chat or Work to Windows, listen on a port or poll GitHub;
- use Cline, Pi or an AI model, run browser UAT, touch story canon or media;
- edit repository sources, publish a PR, infer verified results, merge;
- replay an interrupted attempt or touch the original protected Engineering
  Team scope 5778c81f038c722cd56ccb2fc3f43b88a547a894c12a11fed645c8ea23df2fa6.

## Explicit local command (ONLY after checking head and base)

    cd C:\Users\bryan\plotpickle
    $head = git rev-parse HEAD
    $base = git rev-parse HEAD~1
    node scripts/windows-uat-control.mjs --start --head $head --base $base --task issue-3110

The result is **dispatched-unconfirmed** until the launched Windows worker
writes a fresh heartbeat; do not represent dispatch as a started or passed test.
The command prints a 64-character private scope. For exactly that scope:

    node scripts/windows-uat-control.mjs --status --scope <scope>
    node scripts/windows-uat-control.mjs --stop --scope <scope>

Status is read-only and requires no model or browser access. Stop writes an
idempotent local operator request. An isolated worker only attempts to
terminate the **UAT child it created**, never an arbitrary stored PID. A stop
request is not equivalent to STOPPED until the worker confirms child exit.
If worker heartbeat expires, report **unconfirmed** or **stop-requested**,
not green. Windows process-tree closure of descendants is **not yet proven**:
the terminal value "cancelled-child-exited" only confirms the direct child.

The worker runs the existing scripts/run-uat-autopilot.mjs with
--contracts-only and a private artifact directory, checks the admitted
exact head again, and accepts a bounded, fresh contracts-only JSON receipt
with coherent subprocess exit code and timestamps. Status "observed-pass"
means that narrow synthetic contract run, **never a browser UAT pass,
independent defect verification, or permission to merge**.

Duplicate --start or --worker on the same deterministic scope fails closed,
even after a prior successful receipt or crash; attempt 2 is never
automatically authorized. Protected Pi Durable previously-started tasks are
unrelated to these UAT-only attempts and are not replayed. A missing
child exit, malformed private report, stale checkout or corrupt reservation
is BLOCKED/UNKNOWN, never PASS.

Local runner is not an OS sandbox. The user's own account remains the
operator identity. The device-paired authenticated envelope, private runner
installer, background scheduled campaign, model routing, exact independent
verification, GUI parity, real Windows child-tree stop, code repair and
delegated merge policy remain separate acceptance stages of #3110 / #3100.
No GitHub issue text or unsigned task is treated as a local shell instruction.

## CI evidence

Synthetic Node fixtures use private temporary directories, no real provider
or background daemon. They cover duplicate requests, exact head and scope,
local launch, real signal/request separation, missing/malformed report,
synthetic PASS with no browser-proof promotion, and symlink path rejection.
White Paper V3 W8/W9 and independently green exact-head Architecture
Verification remain mandatory. Actual Windows installation/start/stop and
real browser/agent UAT are NOT established by CI.
