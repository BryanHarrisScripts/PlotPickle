# Phase 6 — Promote Seven Architecture Checks to Merge Authority

Parent: #1922  
Issue: #1949  
Depends on: completed Phases 0–5.

## Goal

Promote PlotPickle's seven architecture checks from shadow observation to the repository's intended merge-authority contract, while keeping `PR Gate` and `Product Gate` temporarily available as advisory comparison workflows.

Phase 6 does not retire the two legacy workflows. That is Phase 7, and it is blocked until GitHub itself is observed requiring all seven architecture check contexts on `main`.

## Evidence entering Phase 6

Phases 3–5 proved the seven-layer execution model on exact PR heads. Phase 5 additionally proved that Experience changes can select the real rendered WebMCP observer rather than relying only on static source contracts. PR #1948 completed with PR Gate, Product Gate, and all seven architecture jobs green on the same exact head.

The seven stable check names are:

1. `Layer 1 Experience Skins`
2. `Layer 2 Experience Contract`
3. `Layer 3 Production Orchestration`
4. `Layer 4 Agent & Skill Mesh`
5. `Layer 5 Story / Canon / Evidence`
6. `Layer 6 Provider Runtime`
7. `Layer 7 Validation & Operations`

These names are now a compatibility contract. Phase 6 must not rename them.

## Repository promotion

The existing workflow file remains `.github/workflows/architecture-shadow.yml` to avoid unnecessary file/check churn, but its visible workflow identity is promoted to `Architecture Verification`.

The matrix job still exposes exactly the seven stable names above. Selection remains below GitHub Actions in the shared verification core. Every job checks out the exact PR head and passes that exact SHA into normalized evidence generation.

The machine-readable promotion contract is `config/verification/merge-authority.json`. It declares:

- the promoted architecture workflow;
- the exact seven intended required check contexts;
- `PR Gate` and `Product Gate` as `advisory-comparison` workflows during Phase 6;
- the expected GitHub `Main` ruleset configuration;
- the most recently observed ruleset state.

## GitHub ruleset boundary

The active repository ruleset is `Main`, ruleset ID `20214975`, targeting `~DEFAULT_BRANCH`.

At the start of Phase 6 it contains only:

- `deletion` protection;
- `non_fast_forward` protection.

It does **not** contain a required-status-check rule. Therefore neither the legacy gates nor the seven architecture checks are technically enforced by the GitHub ruleset today.

The connected GitHub integration can read this ruleset but does not expose repository-administration/ruleset mutation authority. Repository-side code must therefore never claim that promotion is externally enforced merely because the workflow is ready.

Until the ruleset is changed, `config/verification/merge-authority.json` must remain:

`repository-prepared-awaiting-ruleset`

with `requiredStatusChecksConfigured: false`.

## Required external ruleset handoff

A repository administrator must update GitHub's `Main` ruleset to require these exact status checks:

- `Layer 1 Experience Skins`
- `Layer 2 Experience Contract`
- `Layer 3 Production Orchestration`
- `Layer 4 Agent & Skill Mesh`
- `Layer 5 Story / Canon / Evidence`
- `Layer 6 Provider Runtime`
- `Layer 7 Validation & Operations`

Do not add `PR Gate` or `Product Gate` as new required contexts during this promotion. They remain comparison workflows until Phase 7 retirement.

After that change, Phase 6 must re-read ruleset `20214975` and confirm all seven names before issue #1949 can be closed completed.

## Guardrails preserved

- Unknown production ownership remains fail-closed.
- Every test retains one primary execution owner.
- Heavy, native, network and secrets activity remains permission-gated.
- Layer 1 live WebMCP remains a read-only observer with no canon/product authority.
- Test selection remains deterministic from repository evidence, never PR prose or Agent judgment.
- All seven jobs remain visible on every PR; unaffected layers emit baseline evidence rather than disappearing.
- `PR Gate` and `Product Gate` are not removed in Phase 6.
- Layer 7 architecture blueprint wording is not updated until Phase 7 is actually complete.

## Phase 7 entry condition

Phase 7 may begin destructive retirement work only after the active `Main` ruleset is observed to require all seven exact architecture check contexts. If that condition is false, Phase 7 may be planned/documented but the old PR Gate/Product Gate pull-request paths must remain intact.
