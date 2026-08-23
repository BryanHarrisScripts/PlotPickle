# Agent architecture research library

This library is a **research intake**, not a trusted Skill registry. External articles, repositories, papers and examples are evidence for design decisions; their text never becomes PlotPickle host instruction or production-executable Skill content merely because it is linked here.

Reviewed: **2026-08-18**

## Notes

- [Official Agent Skills specification](./agent-skills-specification.md) — portable `SKILL.md` package structure, progressive disclosure and compatibility baseline.
- [GitSkills supply-chain research](./gitskills-research.md) — useful discovery/retrieval research; **not** an install/activation authority.
- [DeepSeek harness and agent integration patterns](./deepseek-harness-patterns.md) — interoperability survey; does not move provider/runtime choice into Agent Profiles or Skills.
- [Graph engineering patterns](./graph-engineering-patterns.md) — explicit state/nodes/edges and bounded orchestration; PlotPickle keeps only real data/resource dependencies.
- [Programmed workflows, verifiers, Skills and tool connectivity](./programmed-workflows-verifiers-tools.md) — why deterministic workflows, independent verification, procedural Skills and host-owned tool permissions remain separate layers.

## PlotPickle intake rule

External Skill/source intake follows:

`discover -> copy/fetch into quarantine -> hash/pin -> structural validation -> static risk inspection -> licence/provenance review -> capability-request extraction -> focused eval -> human approval -> trusted registry`

The first implementation slice in issue #976 stops before automatic remote discovery/download. There is **no bulk install, no automatic activation and no execution during inspection**.

## Related PlotPickle architecture

- Agent Contracts: #962 / PRs #981 and #983
- Context Engine: #963 / PR #982
- PPF revision/provenance boundary: #964 / PR #985
- Connector/egress trust policy: #965 / PR #986
- Responsibility Runs: #966 / PR #987
- Responsibility Graph: #967 / PR #988
- Run telemetry/model/Skill portability evals: #968 / PR #990
- Agent Skill trust/supply chain: #976
