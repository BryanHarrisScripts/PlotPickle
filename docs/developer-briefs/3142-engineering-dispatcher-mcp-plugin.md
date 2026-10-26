# #3142 — Engineering Dispatcher custom MCP plugin (first execution bridge)

Date: 2026-10-25. This is stacked on PR #3311, whose owner-Windows Product Gate remains unproven. This is NOT an unattended Software Factory. The existing Factory MCP Tunnel retains observation, diagnostics, exact-head verification and immutable legacy receipts. The new interface does not change the old tunnel's tool catalog or credentials.

## Separation of responsibilities

New entry point: scripts/engineering-team/mcp/dispatcher/engineering-dispatcher-plugin.mjs --http. It binds only to 127.0.0.1:43116/mcp. A separately deployed trusted authenticated HTTPS tunnel must restrict the approved ChatGPT owner and inject x-plotpickle-engineering-dispatch-token. Do not expose the loopback server directly to the internet or forward untrusted public client headers. That new tunnel integration and ChatGPT plugin installation are not included in this PR.

Execution reuses #3311 owner-granted coding and publication modules. No new AI runtime, queue, arbitrary shell endpoint, Pi replay, model-generated commands or merge tool is introduced. The local owner sets PLOTPICKLE_ENGINEERING_DISPATCH_ENABLED=1 and a separate 48–128-character random PLOTPICKLE_ENGINEERING_DISPATCH_TOKEN in a protected Windows environment. The model-backed worker independently requires an OpenAI API credential and an owner-issued bounded one-use coding grant. The separate ChatGPT-authored patch route never calls a model API and instead requires a distinct owner-issued private chat-edit grant. Its publisher requires a second, distinct owner-issued grant and scoped GitHub publication credential. No remote caller can create grants or supply secrets, target files, instructions, commands or merge policy.

## Seven tools

1. engineering_dispatch_status — read enabled/STOP/possibly stale lock state, explicitly ONE_SHOT_BRIDGE_ONLY; no queue or dispatcher heartbeat proof.
2. engineering_apply_chat_patch_once — apply one exact, bounded ChatGPT-authored text substitution through a distinct owner-private one-use chat-edit grant. This is a separate, no-model-API path that creates only an isolated local commit; the dispatcher must require editOrigin:authenticated-chat-proposal and modelInvoked:false in both success and receipt readback. No test execution, publication, merge or unattended queue is implied.
3. engineering_prepare_once — after exact clean MAIN and STOP/PAUSE checks, consume only the existing owner coding grant. Create an immutable local-commit receipt with the newly discovered SHA, issue and deterministic branch, but never publish. The owner can inspect that SHA before separately issuing an exact-commit publication grant. This is the first phase of a safe two-phase handoff, not automatic publication.
4. engineering_publish_prepared_once — consume a separately issued publication grant after a confirmed prepare receipt exists. Require the original prepare request ID, coding grant ID, exact clean MAIN and the newly discovered local commit to match. The existing publisher independently validates the exact-commit owner grant and GitHub draft-only publication. A separate engineering receipt is required before reporting success. No model rerun, grant issuance, independent-verification claim or merge authority.
5. engineering_execute_once — legacy combined invocation requiring two preexisting owner grants. This is only viable if the exact commit was already known; do not use it to claim an autonomous fresh model-edit-to-PR cycle.
6. engineering_dispatch_receipt — read confirmed sanitized result (including LOCAL_COMMIT_PREPARED) or STARTED_UNCONFIRMED. Never replay an ambiguous request.
7. engineering_dispatch_stop — write durable local STOP admission marker. Blocks new requests; cannot claim child-process termination or cancellation of an in-flight API call, and intentionally cannot clear itself.

The MCP endpoint checks Host/Origin, token and bounded JSON messages. Credentials never enter tool arguments or GitHub records. The server does not install a service, schedule tasks, grant owner consent or expose a re-enable API. Caller-supplied issue prose cannot reach executable commands.

Private dispatcher records live in the existing %LOCALAPPDATA%/PlotPickle/engineering-team/conversation-gateway/engineering-dispatcher/ domain. Exclusive create locks serialize one-shot work. Uncertain model, GitHub or receipt results retain the lock and reservation for owner reconciliation. A reported draft PR retains focusedTestExecuted:false, independentVerification:false, automaticMergeAuthorized:false and replayAuthorized:false. A positive receipt is not proof of code correctness, CI or independent Windows acceptance.

## Test boundary and release plan

tests/issue-3142-engineering-dispatcher-plugin.test.mjs uses disposable private directories and an injected worker. It covers authentication, hidden tool discovery, Windows/head fail-close, fixed arguments, one-use reservation, duplicate rejection, STOP precedence, ambiguous no-replay and receipt readback. The ChatGPT patch route additionally tests strict owner-grant selection, source-bound receipt origin, modelInvoked:false, forged-origin refusal and no replay. The two-phase flow additionally tests a previously unknown commit, zero premature publication calls, exact-commit and cross-grant rejection, separate publication handoff, malformed prepared receipts, mismatched publisher responses and immutable no-replay behavior. It does not prove a real model invocation, published GitHub PR, Windows process ownership/STOP, signed independent witness or unattended scheduling.

The two-phase prepare/publish tool pair now exists in this PR. The first call reveals the local commit; a separate owner must then provision a publication grant pinned to that SHA before the second call. This is a governed handoff, not yet an unattended dispatcher. Never weaken validatePublicationGrant's exact-commit requirement, replay a completed prepare request, or infer permission to publish from the coding grant. An unattended mode would require a separately approved delegated publication policy; none is installed here. Finish #3311's owner-Windows live coding/publication/verifier acceptance first. Then independently install and test the second authenticated tunnel, real separate owner grants, Windows authorization and host/STOP semantics. Add a durable Windows supervisor queue/lease bridge, process-tree STOP, crash/restart reconciliation, separately signed owner-Windows verification and green-only merge policy. Prove issue B starts automatically after issue A merges without manual ChatGPT messages. Historical blocked Pi reservations remain immutable and are never silently replayed.

Do not mark #3142 complete, report Factory ONLINE, or merge this plugin from hosted synthetic tests alone.

## Approved ChatGPT one-issue operating model (October 26, 2026)

The owner explicitly chose a **single-issue ChatGPT-driven engineering cycle**, not an unattended model dispatcher. One live ChatGPT instruction may select an eligible issue, author a bounded source patch through the new ChatGPT patch operation (no OpenAI API key), obtain one isolated Windows local commit, acquire a separately owner-issued exact-commit publication grant, create a DRAFT PR, independently verify exact-head CI and signed owner-Windows Product Gate, merge only under existing green-only authority, and **STOP**. A subsequent issue always requires another explicit ChatGPT instruction. No issue B, daemon model trigger, or automatic next turn is authorized.

The MCP server never invokes the ChatGPT conversation model itself. Its editOrigin field means "authenticated chat proposal", not independently attested model identity. modelInvoked:false means that the Windows worker made no model API request, not that this conversation used no AI.

The source-bound patch operation requires a private one-use engineering-chat-edit-once grant with explicit owner consent, exact source SHA, file digest, focused test and expiry. Existing publisher requires a second grant fixed to the resulting exact commit and scoped owner-side GitHub authorization. Those grants must come from owner-controlled policy; no issue prose, ChatGPT-generated body or MCP caller may silently create authority. Plugin installation, delegated owner grant provisioning, independent signer/Product Gate and controlled GitHub publication remain release dependencies.

**Acceptance:** prove exact-head CI and native Windows regression first; separately deploy and pair this custom authenticated plugin through a supported owner-approved route; prove one genuine live issue patch, source/PR/test receipts, independent owner-Windows acceptance and authorized merge; stop after the single issue. Fixture success alone cannot complete #3142. Preserve #3311 proof and all legacy blocked non-replayable reservations.


## First owner-console ChatGPT grant — separate from connector deployment

The independently successful hosted run for an earlier #3314 head was GitHub Actions `40356337275` at `81745a565a6792ac30f9f3035b50bb8ebf9f28bc` (11 executed jobs green, 4 impact-selected skipped). **Any edits after that exact SHA require a new CI run; the old green run is not accepted for changed source.** Separately, the existing live Factory tunnel's `factory-pr-head` safely confirmed #3311 exact parent `4e1ac0e2cc55402c227ee7cca8cf42d82565f003` against clean MAIN `340dbeb0916a35eec37ae2aa9f078a53d9678b57`, request `8c1e3e0f94a64a2da1f9f534c7a8e091`, `CANDIDATE_HEAD_VERIFIED`. That is identity proof, **not** an owner Product Gate.

The next optional local owner-only operation lives in `scripts/engineering-team/gateway/chat/owner-chat-pilot-grant.mjs`. A reviewed, pinned C:-drive PR preview must contain that script, independently verified against the current GitHub PR #3314 head. It must execute with the **separate clean, trusted MAIN checkout as its working directory** and a real owner-interactive Windows console. No remote MCP request or ChatGPT message may issue this grant. The exact local consent is `AUTHORIZE_ONE_CHATGPT_SOURCE_EDIT`; the CLI accepts that one consent value and no issue prose, filenames, model names, API tokens or arbitrary commands.

This first proof is FIXED to issue **#3142**, source `scripts/engineering-team/mcp/factory-observer.mjs`, and already tracked focused test `tests/issue-3154-chatgpt-factory-mcp.test.mjs`. It derives the target's SHA-256 from clean MAIN, checks `origin/main`, checks STOP/PAUSE, issues a cryptographically random 32-hex grant ID, and fsyncs a private, 30-minute `engineering-chat-edit-once` grant. A durable `.pilot-3142-chat-reserved.json` marker allows **at most one grant**, even if a process dies between writes. There is no retry/overwrite/cleanup bypass. Only the grant ID and sanitized metadata may be returned to ChatGPT. A grant is **not** a source mutation or execution receipt; once issued, the authenticated dispatcher must still validate the source, STOP, reservation, file digest and exact replacement, and must never execute generated code.

Illustrative owner-console command *only after* current-head CI, review of a pinned PR preview and supported plugin pairing:
```powershell
$main = 'C:\Users\bryan\PlotPickle'
$candidate = '<owner-reviewed pinned #3314 preview root>'
$grantIssuer = Join-Path $candidate 'scripts\engineering-team\gateway\chat\owner-chat-pilot-grant.mjs'
Push-Location $main
try {
    & node $grantIssuer AUTHORIZE_ONE_CHATGPT_SOURCE_EDIT
    if ($LASTEXITCODE -ne 0) { throw 'OWNER_CHAT_PILOT_GRANT_NOT_ISSUED' }
} finally { Pop-Location }
```
Do **not** run the command against a guessed path or detached preview as cwd; it is not a deployment shortcut. If private owner storage does not exist/is not verified, the issuer blocks instead of creating arbitrary roots. No ChatGPT or OpenAI API key is required by this ChatGPT grant route.

**Still missing:** an owner-reviewed, independently paired HTTPS-to-loopback proxy which authenticates the actual ChatGPT plugin owner and privately injects `x-plotpickle-engineering-dispatch-token`. The new plugin only binds `127.0.0.1:43116/mcp` and must never be directly published to the public internet, have its token pasted in chat/GitHub or accept caller-controlled forwarding headers. The existing Factory tunnel has not acquired these seven tools. Product acceptance also requires the separate local draft publication grant/token, focused tests on the edited worktree, signed independent Windows witness and an exact-head PR Gate. Both #3311 and #3314 stay draft until proven; after a single accepted issue cycle, STOP.
