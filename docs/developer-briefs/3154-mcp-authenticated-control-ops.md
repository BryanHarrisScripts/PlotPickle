# #3154 — Authenticated MCP control operations (first Windows slice)

Parent #3110. This uses the existing PlotPickle Factory queue, private issue ledger and dependency preflight; it does not create another worker or grant model, spending, creative/canon, GitHub merge or shell rights.

## Server and tool discovery

The existing `scripts/engineering-team/mcp/factory-readonly-server.mjs` remains read-only unless the paired host is explicitly configured with a secret environment value `PLOTPICKLE_FACTORY_MCP_CONTROL_TOKEN` (48–128 characters, letters/digits/underscore/hyphen). The trusted HTTPS/MCP tunnel must inject that secret in the `x-plotpickle-factory-control-token` header **only for the authenticated owner**. Never put the secret in a ChatGPT tool argument, issue, screenshot, URL, repository file, raw log or browser-accessible JavaScript. Do not forward arbitrary public client headers as if they were trusted. Rotate/revoke the secret on the Windows host and tunnel together.

Unauthenticated MCP discovery retains precisely the original three read-only tools. Authenticated discovery adds these controls:

- `factory_run_dependency_preflight` with a fresh 32-character lowercase hex `requestId` and current exact 40-character `expectedHead`. Only on a stopped Windows worker at clean, updated main. Reuses the existing isolated `npm ci --ignore-scripts` proof. No Pi model or issue reservation. A probe can take minutes; if the MCP call times out, inspect the receipt instead of replaying the same request.
- `factory_admit_issues` with unique fresh `requestId`, `expectedHead`, and an explicit list of one to five new open eligible issue numbers. Requires the preflight proof, clean exact main, an absent service lock and all existing native local queue admission checks. Existing #3141/#3158/#3160 attempt reservations are never reused. This does **not** start the worker or grant merge authority.
- `factory_control_receipt` with the exact `requestId` returns a sanitized immutable outcome (or STARTED_UNCONFIRMED). It cannot replay work or read arbitrary private files.

The request ID is stored with write-once semantics in `%LOCALAPPDATA%\\PlotPickle\\engineering-team\\autonomous-queue\\mcp-control-requests` before side effects. A duplicate or ambiguous write is blocked rather than retried. The original issue-attempt receipts and worktrees remain untouched.

## Native acceptance to complete

1. GitHub CI must independently pass required seven-layer architecture and new MCP adversarial tests on the exact PR head. A skipped Windows Product Gate is not native proof.
2. Owner updates clean main on the Windows machine, stops the scheduled factory task using the existing owner-operated Windows controls, and verifies no live worker/process tree. Do not delete a live or uncertain service lock.
3. Owner provisions the token through a local secrets source and pairs an authenticated HTTPS transport that injects its header. An insecure public endpoint or ChatGPT-supplied static token is unacceptable. Restart the actual MCP server and refresh/reconnect the plugin so the new tool catalogue can be discovered.
4. In ordinary Chat, verify authenticated `tools/list` exposes the three new operations. Confirm an unauthenticated request still cannot invoke them. Run one native exact-head preflight with a fresh request ID. Check its durable outcome and new `factory_status.dependencyPreflight`.
5. Only after INSTALL_PREFLIGHT_READY, admit fresh #3164 with a new request ID while the Windows worker is stopped. Resume the existing owner-operated scheduled task; observe the real Pi code edit, contracts, build, draft PR and independent CI. A native issue-to-draft-PR acceptance is not satisfied by mocked MCP tests.

## Remaining #3110 control plane

This first slice does **not** remotely start or terminate the Windows worker, verify owned process-tree STOP, open a code PR, automatically merge code, or start the next issue. Those are separate #3142/#3135/#3148/#3143 and #3154 acceptance increments. Do not advertise the whole unattended factory as live until actual paired-host receipts demonstrate it. In particular, authorization to perform a preflight or to admit fresh issues does not authorize replaying uncertain attempts, paid model dispatch or bypassing exact-head CI.
