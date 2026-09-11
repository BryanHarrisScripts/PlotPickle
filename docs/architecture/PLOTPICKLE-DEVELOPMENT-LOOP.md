# PlotPickle Development Loop

<!-- PLOTPICKLE:OSS-INFLUENCE:github-spec-kit -->

PlotPickle uses a small, repository-native specification discipline for non-trivial product and architecture work:

```text
IDEA
  -> ASSESS
  -> DEVELOPER BRIEF
  -> ISSUE
  -> PLAN
  -> BUILD
  -> TEST / FIX
  -> CONVERGE
  -> PR GATES
  -> MERGE
```

This process is materially informed by GitHub Spec Kit's spec-driven development ideas, especially its constitution/specification/planning discipline and its post-implementation `converge` step. PlotPickle does **not** install or initialize Spec Kit and does not adopt a second development authority. `AGENTS.md`, GitHub Issues, developer briefs, PlotPickle Agent Skills, focused UAT, PR Gate and Product Gate remain authoritative.

## 1. IDEA

Capture the raw proposal without assuming it belongs in the product. An idea may come from a Human, tester, OSS project, model/provider capability, bug report, visual observation or architecture review.

## 2. ASSESS

Before committing to substantial work, ask whether the idea solves a current PlotPickle problem and whether the capability already exists. For meaningful architecture/product proposals, assessment should record enough evidence to reach one of three outcomes:

- **GO** — the idea has a bounded product need and a compatible ownership path;
- **CLARIFY** — important requirements or authority boundaries are unresolved;
- **STOP** — the idea duplicates existing architecture, adds unnecessary complexity, or does not justify implementation.

Assessment is intentionally lightweight for obvious small repairs.

## 3. DEVELOPER BRIEF

For non-trivial work, describe the desired behavior, current owner to reuse, authority boundaries, non-goals, acceptance criteria and validation plan before implementation. The brief is a change specification, not a retroactive attempt to document the entire repository.

## 4. ISSUE

Track the bounded change in GitHub. The issue is the Human-visible work record and should link to the developer brief when one exists.

## 5. PLAN

Identify the smallest safe implementation path, files/owners to reuse, deterministic regressions to add, expected UAT/build coverage and any unresolved questions. Do not create a competing architecture merely because implementation would be easier in isolation.

## 6. BUILD

Implement the smallest change that satisfies the approved scope. Preserve stable IDs, authority boundaries, user-authored content and provider independence unless the issue explicitly changes them.

## 7. TEST / FIX

Run the nearest focused regressions first, then the required PlotPickle UAT/build checks. Failures are evidence: fix the product or stale contract for the right reason rather than weakening the gate.

## 8. CONVERGE

Convergence answers a different question from testing:

> Did the finished change actually satisfy what the issue/developer brief promised, with evidence, and without unrelated scope?

For a convergence-managed change, add one machine-readable manifest under `config/development-convergence/`. The canonical evaluator is `scripts/run-development-convergence.mjs`.

Each acceptance criterion must map to concrete repository evidence. Evidence may prove that a required file/contract exists or that a focused regression explicitly covers the promised behavior. Convergence also compares the changed-file list with the manifest's allowed scope.

The result is exactly one of:

- `CONVERGED` — every declared criterion has valid evidence and the diff stays within declared scope;
- `NOT_CONVERGED` — one or more criteria lack evidence, evidence is stale/missing, or unrelated changes are present.

A clean convergence run does not edit source, manufacture tasks, approve its own implementation or replace tests. Its JSON report is written under `.artifacts/development-convergence/` for review/CI evidence.

### Independence rule

The implementation agent may prepare the manifest and evidence mapping, but cannot make that assertion authoritative merely by saying the work is complete. GitHub CI reruns the convergence evaluator from the tested PR head, and PR Gate/Product Gate remain independent deterministic authorities afterward.

## 9. PR GATES

Convergence does not mean the software works. Required CI still validates focused contracts, security, OSS governance, auth/storage boundaries, production builds and Windows product packaging as applicable.

## 10. MERGE

Merge only the exact tested head after required checks are green. Do not self-certify a different commit, bypass failed convergence, or treat an implementation-agent summary as evidence.

## Observable execution ledger

The development loop must be observable while it runs. For non-trivial pull-request work, maintain one persistent PR conversation comment titled `PlotPickle Development Run` and identify it with:

`<!-- plotpickle-development-run-ledger:v1 -->`

The ledger is not a new authority. It is a Human-visible operational view over the existing Issue, branch, PR, GitHub Actions, convergence, PR Gate, Product Gate, and merge evidence.

Use exactly these run states:

- `WORKING` — repository inspection, editing, or focused validation is active;
- `WAITING` — PR Gate or Product Gate is pending/running;
- `FIXING` — a failed test/gate is being diagnosed or repaired;
- `BLOCKED` — safe continuation requires a permission, external dependency, destructive ambiguity resolution, or Human decision;
- `READY` — PR Gate and Product Gate both succeeded on the same current head SHA;
- `MERGED` — GitHub confirmed the merge after the exact tested head was ready.

The ledger records the issue, PR, branch, current head SHA, current step, changed-file summary, both required gate results, current failure/blocker when applicable, next action, and last meaningful action. Gate success from an older head is stale and must never authorize merge.

Repository-aware assistants should update the existing ledger comment whenever the run changes material state instead of adding another status comment. `scripts/development-run-ledger.mjs` is the canonical validator/renderer so Human and automated clients share the same state model and same-SHA rules.

When the Human explicitly says `build, test, fix and merge when green`, treat that as bounded authority for the current task to continue through ordinary repair/retry cycles. A failing test or running GitHub workflow is not itself a reason to stop. Continue until `READY`, then merge and verify `MERGED`, unless a genuine `BLOCKED` condition requires the Human.

The ledger may expose concise engineering decisions and failure causes, but it must not expose hidden reasoning, chain-of-thought, full prompts/responses, credentials, private story text, or unrelated personal information.

## When convergence is required

Use a convergence manifest for non-trivial work where a developer brief or multi-part acceptance contract exists, especially architecture changes, new capabilities, authority/security changes and multi-surface product behavior.

Tiny copy fixes, obvious one-line repairs and housekeeping do not need a heavyweight spec artifact merely to satisfy process ceremony. They still need the nearest appropriate regression/build discipline from `AGENTS.md`.

## Relationship to GitHub Spec Kit

GitHub Spec Kit is an **open-source methodology reference**, not a PlotPickle runtime or developer dependency. PlotPickle adapts the useful process ideas to its existing architecture rather than running `specify init`, adding `.specify/` as a second authority, or replacing GitHub Issues and PlotPickle's existing gates.

No Spec Kit source code or templates are required by this development loop. If PlotPickle later copies or materially adapts MIT-licensed source/templates rather than only methodology, the copied material must retain the applicable MIT copyright/licence notice and be recorded in the OSS registry.