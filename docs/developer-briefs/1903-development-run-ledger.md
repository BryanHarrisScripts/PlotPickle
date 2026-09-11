# Developer Brief — #1903 Observable Development Run Ledger

## Goal

Make the existing ChatGPT/connected-GitHub/GitHub-Actions development loop Human-visible without replacing any part of that architecture.

The PR conversation becomes the durable observability surface. One persistent `PlotPickle Development Run` comment shows what the repository-aware assistant is doing, what GitHub is verifying, why a run failed, what happens next, and whether the exact tested head is actually safe to merge.

## Current owner to reuse

This feature extends the repository-native development loop in `docs/architecture/PLOTPICKLE-DEVELOPMENT-LOOP.md` and the authority rules in `AGENTS.md`.

GitHub Issues remain the work record. GitHub pull requests remain the code-review/change record. PR Gate and Product Gate remain independent deterministic verification authorities. The ledger is an observability record only; it does not become a new authority.

## Required behavior

The ledger has exactly these run states:

- `WORKING` — repository inspection, planning, editing, or focused validation is actively in progress;
- `WAITING` — at least one required GitHub gate is pending or running;
- `FIXING` — a failed test/gate is being diagnosed or repaired;
- `BLOCKED` — an external dependency, permission boundary, destructive ambiguity, or required Human decision prevents safe continuation;
- `READY` — PR Gate and Product Gate both report success on the same current head SHA;
- `MERGED` — the exact tested head was merged and GitHub supplied merge confirmation.

The ledger must record the issue, PR, branch, current head SHA, current step, PR Gate status, Product Gate status, changed-file summary, next action, last meaningful action, and—when applicable—the current failure or blocker.

`READY` must fail closed if either required gate is missing, failed, or successful only on a stale head SHA. `MERGED` must additionally require GitHub-confirmed merge evidence.

The ledger uses the stable marker `<!-- plotpickle-development-run-ledger:v1 -->` so a repository-aware client can find and update the same PR comment rather than adding status-comment spam.

## Build / test / fix / merge shorthand

When the Human explicitly instructs a repository-aware assistant to `build, test, fix and merge when green`, that grants bounded authority for that task to continue through the repository-native repair loop:

`BUILD -> TEST/FIX -> CONVERGE -> PR GATES -> READY -> MERGE -> MERGED`

The assistant should not stop merely because one test fails or one GitHub workflow is still running. It should inspect the exact failure, make the smallest safe repair, rerun required verification, and keep the ledger current.

The assistant stops before completion only when safe continuation requires a Human decision, an unavailable permission/credential, a destructive ambiguity, or an external infrastructure condition it cannot repair.

Merge authority remains bounded to the explicit Human instruction. Without explicit merge authority, `READY` is the terminal assistant state.

## Privacy and evidence boundary

The ledger may contain repository metadata, file paths, gate names, test names, concise failure causes, timestamps, and operational next steps.

It must not contain hidden reasoning, chain-of-thought, full prompts, full model responses, credentials, tokens, user story text, private conversation content, or unrelated personal information.

## Non-goals

- No product UI or runtime dependency.
- No new model, agent runtime, local orchestration service, Hunk dependency, Pi/Cline requirement, or background daemon.
- No replacement for PR Gate, Product Gate, focused UAT, convergence, or GitHub merge evidence.
- No ledger files committed repeatedly to represent live run state; live status belongs in the single PR comment.

## Implementation

1. Add `scripts/development-run-ledger.mjs` as the canonical deterministic validator/renderer.
2. Add focused regression coverage for state validity, same-SHA gate rules, merge evidence, and repository policy.
3. Extend `AGENTS.md` and the canonical development-loop document with the observable-ledger contract.
4. Add the focused regression to PR Gate.
5. Dogfood the ledger on the implementation PR by creating one comment and updating that same comment through gate/repair/merge states.

## Acceptance criteria

1. A machine-testable state model exposes `WORKING`, `WAITING`, `FIXING`, `BLOCKED`, `READY`, and `MERGED`.
2. Renderer emits one compact Human-readable ledger with the stable marker and both required gates.
3. `READY` is rejected unless PR Gate and Product Gate are `SUCCESS` on the same current head SHA.
4. `MERGED` is rejected without GitHub-confirmed merge evidence.
5. Repository rules define the single-comment update policy and deterministic meaning of `build, test, fix and merge when green`.
6. PR Gate independently reruns the focused ledger regression.
7. No production UI/runtime dependency is introduced.
