# Harness Improvement Proposals

PlotPickle may learn from repeated execution failures, but it does not permit unrestricted recursive self-modification.

## Protected harness

The protected host remains authoritative for canonical PPF state, writer authority, trust/connector/egress policy, credentials and secrets, Story Knowledge Graph derivation rules, deterministic evals, Full Verification, audit evidence and the Harness Improvement Proposal promotion contract itself.

A Harness Improvement Proposal (HIP) cannot target protected files, cannot edit the eval that judges it, cannot self-certify its own verification evidence and cannot promote itself to `main`.

## Experimental execution layer

A HIP may propose bounded changes to execution concerns such as context-selection strategies, prompt assembly, routing/scoring heuristics, agent procedures, tool sequencing, model-selection heuristics and execution-graph shapes.

The expected lifecycle is:

`repeated failure evidence -> proposed -> isolated branch/worktree -> baseline verification -> candidate verification -> host promotion or rejection -> rollback if a promoted change later regresses`

Both baseline and candidate promotion evidence must be authoritative PASS results produced by a verifier other than the proposer. Tests, workflow definitions and Full Verification authority are protected targets.

## Adaptive Context Engine

Task strategies are a selection layer in front of the existing Context Engine. Current strategies are `general`, `continuity`, `scene-rewrite`, `structure-review` and `visual-continuity`.

A strategy may decide which optional evidence is most relevant before final assembly. It cannot rewrite source trust, allowed use, authority, canonical status or the host-owned character/token budget. Writer instructions, PPF canon and task schema evidence are always retained by the strategy layer. The existing Context Engine still performs final normalization, authority ordering, clipping and receipt generation.

Adaptive packets extend the Context Receipt with the selected strategy id, strategy version and candidate count. This makes strategy selection auditable without changing the protected Context Engine trust contract.

Sage now chooses a deterministic context strategy from the writer's current question before delegating final assembly to the protected Context Engine.

## Responsibility Run interrupts

Responsibility Runs already enforce host-owned limits for attempts, elapsed time, parallel children, context, tokens, tool calls and cloud cost. The interrupt layer delegates cancellation to the existing Responsibility Run state machine and records an immutable receipt containing the requesting identity, signal, reason, prior state and the exact limit snapshot at interruption.

An interrupt does not reset or increase a budget and cannot mutate verification evidence or canonical project state.

## Non-goals

This design does not install Exo, Daytona, E2B or another runtime. It does not add a Judge Agent. It does not let an agent alter credentials, permissions, evals, PPF authority or promotion rules. It does not autonomously merge code.

The intended future automation is conservative: Pi or a BUZZ specialist may notice a repeated failure and prepare a HIP, but Git isolation, deterministic verification and host-controlled promotion remain the governing boundary.
