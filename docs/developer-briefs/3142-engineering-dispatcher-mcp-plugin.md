# #3142 — Engineering Dispatcher custom MCP plugin (first execution bridge)

Date: 2026-10-25. This is stacked on PR #3311, whose owner-Windows Product Gate remains unproven. This is NOT an unattended Software Factory. The existing Factory MCP Tunnel retains observation, diagnostics, exact-head verification and immutable legacy receipts. The new interface does not change the old tunnel's tool catalog or credentials.

## Separation of responsibilities

New entry point: scripts/engineering-team/mcp/dispatcher/engineering-dispatcher-plugin.mjs --http. It binds only to 127.0.0.1:43116/mcp. A separately deployed trusted authenticated HTTPS tunnel must restrict the approved ChatGPT owner and inject x-plotpickle-engineering-dispatch-token. Do not expose the loopback server directly to the internet or forward untrusted public client headers. That new tunnel integration and ChatGPT plugin installation are not included in this PR.

Execution reuses #3311 owner-granted coding and publication modules. No new AI runtime, queue, arbitrary shell endpoint, Pi replay, model-generated commands or merge tool is introduced. The local owner sets PLOTPICKLE_ENGINEERING_DISPATCH_ENABLED=1 and a separate 48–128-character random PLOTPICKLE_ENGINEERING_DISPATCH_TOKEN in a protected Windows environment. The worker independently requires an OpenAI API credential and an owner-issued bounded one-use coding grant. Its publisher requires a second, distinct owner-issued grant and scoped GitHub publication credential. No remote caller can create grants or supply secrets, target files, instructions, commands or merge policy.

## Five tools

1. engineering_dispatch_status — read enabled/STOP/possibly stale lock state, explicitly ONE_SHOT_BRIDGE_ONLY; no queue or dispatcher heartbeat proof.
2. engineering_prepare_once — after exact clean MAIN and STOP/PAUSE checks, consume only the existing owner coding grant. Create an immutable local-commit receipt with the newly discovered SHA, issue and deterministic branch, but never publish. The owner can inspect that SHA before separately issuing an exact-commit publication grant. This is the first phase of a safe two-phase handoff, not automatic publication.
3. engineering_execute_once — legacy combined invocation requiring two preexisting owner grants. This is only viable if the exact commit was already known; do not use it to claim an autonomous fresh model-edit-to-PR cycle.
4. engineering_dispatch_receipt — read confirmed sanitized result (including LOCAL_COMMIT_PREPARED) or STARTED_UNCONFIRMED. Never replay an ambiguous request.
5. engineering_dispatch_stop — write durable local STOP admission marker. Blocks new requests; cannot claim child-process termination or cancellation of an in-flight API call, and intentionally cannot clear itself.

The MCP endpoint checks Host/Origin, token and bounded JSON messages. Credentials never enter tool arguments or GitHub records. The server does not install a service, schedule tasks, grant owner consent or expose a re-enable API. Caller-supplied issue prose cannot reach executable commands.

Private dispatcher records live in the existing %LOCALAPPDATA%/PlotPickle/engineering-team/conversation-gateway/engineering-dispatcher/ domain. Exclusive create locks serialize one-shot work. Uncertain model, GitHub or receipt results retain the lock and reservation for owner reconciliation. A reported draft PR retains focusedTestExecuted:false, independentVerification:false, automaticMergeAuthorized:false and replayAuthorized:false. A positive receipt is not proof of code correctness, CI or independent Windows acceptance.

## Test boundary and release plan

tests/issue-3142-engineering-dispatcher-plugin.test.mjs uses disposable private directories and an injected worker. It covers authentication, hidden tool discovery, Windows/head fail-close, fixed arguments, one-use reservation, duplicate rejection, STOP precedence, ambiguous no-replay and receipt readback. The prepare-only phase additionally tests a previously unknown commit, zero publication calls, cross-grant rejection, malformed prepared receipts and immutable no-replay behavior. It does not prove a real model invocation, published GitHub PR, Windows process ownership/STOP, signed independent witness or unattended scheduling.

Next implement a separate owner-granted publish-prepared tool bound to the exact prepare receipt, after the owner has issued a publication grant containing the now-known local commit. Never weaken validatePublicationGrant's exact-commit requirement, replay a completed prepare request, or infer permission to publish from the coding grant. Finish #3311's owner-Windows live coding/publication/verifier acceptance first. Then independently install and test the second authenticated tunnel, real separate owner grants, Windows authorization and host/STOP semantics. Add a durable Windows supervisor queue/lease bridge, process-tree STOP, crash/restart reconciliation, separately signed owner-Windows verification and green-only merge policy. Prove issue B starts automatically after issue A merges without manual ChatGPT messages. Historical blocked Pi reservations remain immutable and are never silently replayed.

Do not mark #3142 complete, report Factory ONLINE, or merge this plugin from hosted synthetic tests alone.
