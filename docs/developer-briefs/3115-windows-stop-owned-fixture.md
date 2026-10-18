# Issue #3115 — Windows STOP: owned process-tree fixture acceptance

## Product purpose

PlotPickle's human-governed Software Factory must reliably cancel work it
starts before any Chat/Work-driven or unattended agent repair route is enabled.
Real Windows contracts-only UAT at main commit
\`e12fd834dd83a1aedc706a3e52d596535a9b7ff9\` completed as
\`observed-pass\`, but did not test cancellation, browser UAT, independent
review, autonomous merging or Chat-to-Windows connectivity.

The existing \`scripts/windows-uat-control.mjs\` uses a local STOP request and
SIGTERM on its direct UAT child. Direct-child exit is **not proof** of every
descendant's exit on Windows. Do not falsely promote that receipt.

## This deliverable

\`scripts/windows-stop-proof.mjs\` is a separate, **opt-in, Windows-only,
no-model/no-browser** fixture proving STOP mechanics without risking running
PlotPickle work. A human operator runs the exact command:

    cd C:\Users\bryan\plotpickle
    $head = git rev-parse HEAD
    node scripts/windows-stop-proof.mjs --prove --head $head

The fixture refuses non-Windows operating systems, an obsolete/mismatched
checkout, malformed arguments and all external PID/kill/shell operations.
It allocates a random one-time private scope beneath
\`%LOCALAPPDATA%\PlotPickle\engineering-team\windows-stop-proof\`.
It spawns one **owned** short-lived Node parent, one descendant it creates,
and a separate owned unrelated sentinel process. Both leaves self-expire after
35 seconds even if a test run fails. Parent/descendant/sentinel readiness
is confirmed against a private random token and actual spawned process IDs.

The single STOP call uses native \`taskkill.exe /PID <ONLY THE SPAWNED
PARENT> /T /F\`. This command is never exposed to external IDs and the
capability is limited to **in-memory spawned child handles**. It waits for
direct-parent exit, confirms descendant nonexistence, confirms unrelated
sentinel survival and requires repeated STOP to be a no-op. It always
attempts cleanup of its live owned parent and sentinel.

A PASS is emitted only when all evidence checks are true, not from a
successful taskkill exit alone; the result reports
\`processTreeTerminationProvenForFixture=true\`, while explicitly reporting
\`productionUatTreeTerminationProven=false\`, \`browserUatProven=false\`,
\`remoteControlConnected=false\`, \`independentVerification=false\`,
\`mergeEligible=false\`. A failed or partial proof is BLOCKED, not green.
No PID, secret, raw command, private path or provider material is included
in the returned result or private result.json. An immutable private
reservation records the exact source head and no replay authority.

**Important security boundary:** this fixture is a separate acceptance
experiment. It does not change how the actual UAT worker cancels jobs,
cannot stop arbitrary processes by PID, does not start a service, and does
not connect Chat, Work, Cline, Pi, GitHub commands or story assets.
A future scoped implementation must prove process-tree ownership and
termination for the actual task, not blindly copy the proof result.

## Verification

The portable Node tests enforce CLI PID/role rejection, deny arbitrary
handle stop, require sentinel and descendant proof and reject a fabricated
Windows PASS on Linux. The native Windows \`--prove\` invocation after
exact-head CI merge provides the first actual OS process-tree observation;
CI fixture/unit tests do not.

The next stages remain a real Windows browser app UAT (with consent and
disposable profiles) and a securely paired Chat/Work-to-Windows transport,
followed by bounded independently reviewed agent implementation/repair/PR/
green/policy-authorized merge. Preserve all previous UAT and Cline Durable
attempts, including their blocked/uncertain receipts.
