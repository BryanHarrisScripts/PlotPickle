# #3303 — Isolated headless Windows gateway acceptance contract

## Problem and observed evidence

PR #3301's exact candidate `baf03e17f008aa900cd4e6b54e86c6b622fc5d42` passed architecture and mocked Windows sentinel tests. The authenticated owner-Windows `factory-pr-head` verified its SHA, and `factory-pr-stage` statically staged six changed files. Neither proves the outbound OBSERVE transport on the owner Windows host. `plotpickle-app-candidate-start` was blocked by `APP_ALREADY_RUNNING_OWNED`; the running MAIN application must not be stopped merely to test a CLI-only gateway change.

## Required implementation (not yet supplied by this document)

Add an allowlisted `factory-gateway-acceptance` named test to the existing authenticated Windows runner, not a shell/command execution endpoint. The runner must bind an existing stage receipt and exact candidate PR/head, verify the staged source and test catalog, execute the existing `tests/issue-3259-outbound-openai-once.test.mjs` in an isolated process and disposable private gateway root with an injected fake HTTPS provider, and independently inspect its exit code, test count and immutable output digest. No live API key, paid model request, source write, user-session interruption, GUI port, credential read, or replay is allowed. Keep source channel/candidate distinct from the production clean-MAIN outbound adapter.

Reject absent stage receipt, wrong candidate SHA, changed stage contents, expired request, missing test, missing dependencies, failed test, and unverifiable output. Record a fresh request ID, source head, candidate head, test path and digest, runner identity, start/end times, exit code, and independently obtained evidence digest. Mark `independentVerification=true` only after a separate verification authority has read and validated the resulting evidence, not merely because a test subprocess exited zero. Do not silently convert a static staging success into product acceptance.

Acceptance: the authenticated runner proves PR #3301's headless gateway behavior while MAIN remains running, and an independent receipt reader confirms exact-head evidence. CI/architecture, owner-Windows acceptance and required code-owner/convergence gates must all pass on the exact PR head before merging. Govern changes by `README.md`, `AGENTS.md`, `config/development-verification-routing.json` and the verification test catalog. Parent #3302, related #3142/#3259.
