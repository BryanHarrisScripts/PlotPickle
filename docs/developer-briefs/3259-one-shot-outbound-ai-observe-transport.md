# #3259 — Gated one-shot outbound AI OBSERVE transport (P3 foundation)

October 24, 2026. This is a narrowly scoped, non-promoting code increment toward a real outbound AI dispatcher. It does NOT implement #3142's persistent ChatGPT-only engineering dispatcher, coding tool loop, source edit/test/PR cycle, Windows supervisor Start, background ChatGPT Chat wakeup, or autonomous merge.

## Existing owner and authorization

Reuse the canonical P1/P2 durable gateway question/answer journal in scripts/engineering-team/gateway and its immutable source-bound receipts. No new queue, HTTP/MCP method, scheduler, provider installation, service, arbitrary shell or Windows PID control. The existing independently consented Windows supervisor still records modelDispatchAllowed=false. Do not modify that authority in this slice.

The only executable entry point is a local Windows-only, explicit one-shot CLI in outbound-openai-once.mjs. It verifies clean MAIN and the approved PlotPickle Git origin through gatewayAppSource, then requires an already persisted fixed, nonprivate OBSERVE question. A separate private, local, owner-provisioned owner-outbound-grant.json binds a unique grant ID, exact question ID, SHA-256 question payload digest, source HEAD, selected OpenAI model, expiry, one request, max 64–256 output tokens, and exact consent AUTHORIZE_ONE_OUTBOUND_AI_OBSERVE_REQUEST. No grant creation UI or automatic grant issuance is added. The API credential comes only from the local process OPENAI_API_KEY environment and is never written to a receipt or source tree. There is no default model, paid request or auto-enable.

## Transport and recovery

The adapter makes exactly one HTTPS OpenAI Responses request to a fixed endpoint, with store=false and no tool permissions. A private write-once grant reservation is fsynced BEFORE the request; another question, retry, timeout, crash or ambiguous response cannot reuse it. A successful, validated output is recorded using the existing gateway answer writer and a separate immutable completion receipt. Any uncertain outcome remains STARTED_UNCONFIRMED, with no model success, independent verification, source mutation or replay claim. There is no automatic retry after a possible charge. A verified answer may be read through the existing GUI/MCP journal, but this test does not attest the provider or an autonomous coding agent.

The source module imports without side effects and does not attach to the supervisor. An owner-controlled future PR must introduce a credential-vault-backed, revocable ENGINEER grant and bounded tool-execution protocol with a native worker lifecycle, isolated worktree edits, tests, PR creation and independent exact-head Windows acceptance. No amount of OBSERVE test success should flip factory_observer CHATGPT_ONLY_DISPATCHER_NOT_IMPLEMENTED to ready.

## Test and truth boundaries

Deterministic fixture tests exercise private one-shot grant binding, exact source, fake HTTPS provider response, canonical journal persistence, absent credential/consent, mismatched question/head, uncertain external outcome, no retry, credential redaction and disposable Git clean/dirty identity. The approved WHITE-PAPER-V3 W8/W9 test-catalog binding covers those limited assertions. They do not demonstrate a real paid model request, API credential provisioning, Task Scheduler process health, Windows product acceptance or live coding. No paid service was called by this engineering PR.

Run the focused Node test, test-truth admission, seven architecture layers, production build if selected, and native Windows/verification-routing checks on the exact PR head. Do not merge until all required exact-head checks are completed successfully and applicable Product Gate proof exists. Keep #3142, #3259, #3279 and #3291 open.
