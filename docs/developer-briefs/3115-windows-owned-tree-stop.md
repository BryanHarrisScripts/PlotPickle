# #3115 — owned Windows process-tree STOP proof (fixture only)

## Purpose

PlotPickle's actual Windows contracts-only UAT succeeded at the exact main
SHA \`e12fd834dd83a1aedc706a3e52d596535a9b7ff9\`.
That **did not test STOP**, descendant process termination, browser automation
or direct Chat/Work control of the Windows machine.

This is a native Windows-only, one-shot and explicitly invoked fixture:
\`scripts/windows-stop-proof.mjs\`. It is deliberately **not wired into**
the existing production \`scripts/windows-uat-control.mjs\` runner.
There is no general PID-kill command, socket, OAuth/Chat control route,
GitHub comment execution, source patching, AI model call or story mutation.

The proof locally creates an isolated random private directory and an
irreversible attempt reservation. Using the script's own ChildProcess handles,
it starts one test parent (which spawns one known descendant), plus a
separately owned **unrelated sentinel**. It waits for all three processes to
write privately token-bound identity receipts and checks all three are
alive. It then uses the native \`taskkill.exe /PID <parent> /T /F\` tree kill
**only on its own actively tracked parent handle**. It verifies that the
direct parent emitted an exit event, the known descendant ceased to exist,
the unrelated sentinel remained alive, and a repeat STOP was a no-op.
It cleans up the sentinel, writes a bounded proof outcome and digest.
The fixture's leaf processes time out independently after 35 seconds; an
interrupted run remains unconfirmed, never auto-replayed.

## One Windows proof command, after PR is merged and code pulled

    cd C:\Users\bryan\plotpickle
    git pull --ff-only
    $head = git rev-parse HEAD
    node scripts/windows-stop-proof.mjs --prove --head $head

This command operates on the machine running it, not via GitHub or Chat.
No arbitrary PID can be supplied, and no other existing process is a target.
Do not run it inside an already active Windows UAT process under test.
The proof outputs no raw PIDs, process command lines, secret token, private
paths, or story data. A successful report must state:

- \`result=verified-fixture\`, \`processTreeTerminationProvenForFixture=true\`;
- all per-fact checks true, including known descendant absence and
  unrelated sentinel survival;
- \`productionUatTreeTerminationProven=false\`,
  \`browserUatProven=false\`, \`remoteControlConnected=false\`,
  \`independentVerification=false\`, \`mergeEligible=false\`.

The proof is not a daemon, does not start PlotPickle's browser or
Engineering Team, and never silently installs dependencies. The private
evidence scope is separate from the original failed \`0eba...\`,
passing \`ae379...\` and started-uncertain Cline/Pi Durable scopes.

## What remains after a successful Windows proof

The experimental Windows fixture can demonstrate native taskkill tree
behavior under owned, active ChildProcess handles. It does **not** make
arbitrary or old PID termination safe: PIDs can be recycled, and the
separate permanent Engineering Team runner still uses direct-child
\`SIGTERM\` and cannot certify descendant closure.

Before using tree cancellation in the long-lived production runner,
implement a Windows-owned isolation primitive (e.g. an OS Job Object
with a limited worker identity), explicit process creation identity,
timeout/failure/host-crash handling, and terminal receipts independently
checking the process tree. Never accept a saved PID from GitHub or
Chat as a command to kill. Add authenticated Windows device pairing
only in a separate reviewed/approved issue, then actual browser UAT.

## CI limitations

Node fixture tests can verify the parser rejects external PIDs,
the per-fact evaluator fails closed, stale/unowned handles are refused,
and no result claims product production proof. CI (typically Linux)
cannot substitute for **actual owner Windows STOP evidence**.
