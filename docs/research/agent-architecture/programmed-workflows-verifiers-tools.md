# Programmed workflows, verifiers, Skills and tool connectivity

Reviewed: **2026-08-18**

Primary sources:

- https://www.anthropic.com/research/building-effective-agents
- https://agentskills.io/specification

## What the sources contribute

Agent-system design benefits from separating predictable programmed workflows from open-ended model decisions. Evaluation/verification can be a distinct step rather than letting the worker simply declare its own work successful. Separately, Agent Skills provide reusable procedural packages that can be discovered progressively.

## PlotPickle takeaways

Adopted:

- use deterministic code for state transitions, budgets, routing, authority checks and canonical writes;
- use model agents where language/creative/reasoning flexibility is actually needed;
- keep authoritative deterministic verification outside the worker that produced the output;
- use writer approval as the final gate for creative canon;
- use Skills for reusable procedures and examples;
- use host-owned connector policy for tool/network/credential authority.

This is why PlotPickle deliberately keeps four concepts separate:

1. **Agent Contract** — who/what role is acting and what it may request.
2. **Skill** — the reusable procedure it may follow.
3. **Connector/tool grant** — the host-owned capability actually available for this Run.
4. **Verifier/writer gate** — the authority that decides whether work passed or becomes creative canon.

## Not adopted

- no “agent says done, therefore PASS” rule;
- no Skill text that silently becomes a system-level permission;
- no tool schema or MCP server that grants itself network/credential/PPF access;
- no automatic paid-cloud escalation because the local model failed;
- no hidden infinite evaluator/optimizer loop—Responsibility Runs have explicit attempts/time/token/tool/cloud limits.

## Skill supply-chain implication

External procedure text is untrusted data during intake. Static inspection may identify requested capabilities or dangerous patterns, but those observations do not execute the Skill and do not expand the host grant. Approval requires a pinned/hash-stable revision plus focused evaluation.

## Related PlotPickle work

- Agent Contracts: #962
- connector/egress policy: #965
- Responsibility Runs: #966
- Responsibility Graph: #967
- portability/Skill evals: #968
- Skill supply-chain trust: #976
