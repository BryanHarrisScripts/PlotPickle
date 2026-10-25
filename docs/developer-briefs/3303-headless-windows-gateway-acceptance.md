# #3303 — Isolated headless Windows gateway acceptance contract

## Problem and observed evidence

PR #3301's exact candidate `baf03e17f008aa900cd4e6b54e86c6b622fc5d42` passed architecture and mocked Windows sentinel tests. The authenticated owner-Windows `factory-pr-head` verified its SHA, and `factory-pr-stage` statically staged six changed files. Neither proves the outbound OBSERVE transport on the owner Windows host. `plotpickle-app-candidate-start` was blocked by `APP_ALREADY_RUNNING_OWNED`; the running MAIN application must not be stopped merely to test a CLI-only gateway change.

## Implemented bounded suite (owner-Windows acceptance not yet observed)

The existing authenticated `factory_run_named_test` now accepts the fixed `factory-gateway-acceptance` suite with an exact candidate PR/head and an immutable prior `factory-pr-stage` request ID. It delegates to the existing isolated engineering runner with a fixed `node-test` target, `tests/issue-3259-outbound-openai-once.test.mjs`. The test uses its existing disposable fixture roots and injected fake HTTPS provider. The runner records the exit code and a sanitized output digest, without launching an app or using a new generic command endpoint. No live API key, paid model request, source write, user-session interruption, GUI port, credential read, or replay is allowed. Keep source channel/candidate distinct from the production clean-MAIN outbound adapter.

Reject absent stage receipt, wrong candidate SHA, changed stage contents, expired request, missing test, missing dependencies, failed test, and unverifiable output. Record a fresh request ID, source head, candidate head, test path and digest, runner identity, start/end times, exit code, and independently obtained evidence digest. The new suite deliberately leaves `independentVerification=false`; independent owner-Windows/product acceptance must still be established by a separate verifier. The fixed suite cannot claim a real provider call or coding agent. Do not silently convert a static staging success into product acceptance.

Acceptance: the authenticated runner proves PR #3301's headless gateway behavior while MAIN remains running, and an independent receipt reader confirms exact-head evidence. CI/architecture, owner-Windows acceptance and required code-owner/convergence gates must all pass on the exact PR head before merging. Govern changes by `README.md`, `AGENTS.md`, `config/development-verification-routing.json` and the verification test catalog. Parent #3302, related #3142/#3259.

## Scope boundary

The suite requires a refreshed authenticated tunnel runtime whose advertised schema includes `factory-gateway-acceptance`; Git sync alone does not reload the live Node process or plugin. The existing PR #3301 must remain staged at its exact head, and the running MAIN/PR_TEST app is not stopped. A passing fixed suite is a headless Windows regression receipt, not a real paid provider request, end-to-end coding dispatcher or independent product acceptance. Do not merge #3301 merely on this fixture.
