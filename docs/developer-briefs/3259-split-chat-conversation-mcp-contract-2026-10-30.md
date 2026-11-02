# #3259 — Truthful, role-separated conversation MCP contract

Owner direction (October 30, 2026): use the **existing authenticated PlotPickle Factory MCP Tunnel and ChatGPT Chat**, not a new API coding worker, as the first manual headless communication acceptance. This source-only PR does not restart, modify, duplicate, or revoke the running tunnel.

## Evidence and problem

On older MAIN (October 24), authenticated ChatGPT Chat completed two real PlotPickle questions with saved correlated answers, including after tunnel reconnect (issue #3259). On October 30 MAIN `11ed71a83a94708eaca5fd3eb4284bfae133b46c`, an owner-local headless test created one genuine `PENDING` question, while ChatGPT's calls to the existing `factory_conversation` tool were **blocked by upstream safety checks before the MCP server received them**. The precise client-side safety classification is unavailable. The separate `factory_status` call and fixed MCP regression succeeded. Neither status nor source tests can independently prove that a new external reply was received.

The previous `factory_conversation` combined observation, delivery acknowledgement and write-once reply in one tool with `readOnlyHint:false`. Also, the `conversationStatus` and `readGatewayReceipt` read paths could create missing directories. Declaring that whole existing tool read-only would have been dishonest.

## Source proposal

Retain `factory_conversation` without changed behavior for existing clients and October 24 receipt continuity. Append three narrowly described, authenticated tools to the reviewed MCP catalogue:

- `factory_conversation_observe` — status `pending` or `receipt`; genuinely read-only and metadata-only, excludes private question/answer text; `readOnlyHint:true`.
- `factory_conversation_receive` — write-once question delivery marker and durable delivery ID; `readOnlyHint:false`.
- `factory_conversation_reply` — write-once correlated answer requiring expected HEAD, question ID, delivery ID and answer ID; `readOnlyHint:false`.

The read-only code validates existing private directory identities, refuses symlinks and missing/corrupt evidence without creating new directories. Observation strips question and answer text before MCP response serialization; receiving the actual question still requires explicit, authenticated delivery acknowledgement. No model, arbitrary script, outbound event delivery, worker ticket, protected test catalogue approval or merge authority is added. Existing `conversationMcpAction`, source pin, 15-minute expiry, idempotency, data-integrity, principal/transport authentication and fail-closed write-once behavior remain the only execution path.

The authenticated catalogue expands by three conversation names. The same repair also registers the previously published `factory_host_diagnostics` tool in the authoritative `diagnostics` manifest group, which had been missing from the launcher verifier's expected authenticated list; this is a truthful inventory correction, not a new diagnostic capability. `Assert-PlotPickleMcpCatalog.ps1` and its disposable Windows fixture now check 14 authenticated names by default and 15 with the existing engineering opt-in. These are source-side expected counts, not live tunnel proof. The launcher verifies `config/mcp/factory-tool-catalog.json`. **Do not hot-reload or upgrade a currently running tunnel in this PR.** An installed launcher / ChatGPT plugin may still advertise the old tool definitions until an owner-approved offline and reversible catalogue/plugin refresh, with exact version/source verification. Any new tool may still be denied by OpenAI safety checks; accurate definitions are not a permission override.

## Tests and release gates

Regression update covers existing historical two-way behavior plus exact tool names/annotations, missing-directory read without write, authenticated/unauthenticated split, wrong source, unexpected extra arguments, replay and explicit failure codes. Adjust only historical hard-coded counts that must reflect the reviewed catalogue, and verify the existing diagnostic tool's presence from the server's actual authenticated list. No unrelated design UI change, Worker 1 authorization, automatic merge, paid API invocation or service lifecycle action.

Protected CI/WHITE-PAPER-V3 W8/W9 test truth rules remain mandatory; changes to existing test editions require independent source-bound reviewer ADMIT and separate protected catalogue maintenance. **Do not self-admit or turn a skipped/failed required check green**. Require exact PR HEAD CI, independent review, owner-Windows validation and explicit authorization before merging. An open DRAFT PR is the safe review vehicle, not release acceptance.

## Post-merge operational validation (future separate owner-controlled action)

1. Confirm exact clean Windows MAIN matches the merged source; inspect existing launcher catalogue and plugin connection before touching any process.
2. Choose an authorized controlled offline tunnel upgrade/rollback window; preserve the current working tunnel and supervisor/dispatcher until then.
3. Reconnect only under owner approval and confirm the advertised tool names/annotations, exact head, and unchanged read-only permissions.
4. Run one fresh headless question with a 15-minute window; in the active ChatGPT Chat, inspect via observation, receive it through the bounded acknowledged delivery tool and send the correlated answer using the write-once reply tool.
5. Read back independent receipt state `ANSWERED`, both directions `VERIFIED`, unchanged IDs, no replay, and validate negative auth/source cases on owner Windows. If client safety still blocks the operation, stop and use official OpenAI support; do not try permission escalation or a disguised endpoint.

Completion of the bilateral communication test is not the #3302 independent engineering-producer/verifier receipt pair, no evidence of ChatGPT background wake-up, and no autonomous coding milestone. Issues #3259, #3302 and #3142 remain independently gated.
