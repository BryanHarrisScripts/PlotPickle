# PlotPickle Agent Architecture Research Library

This directory preserves external research and architecture sources that materially influence PlotPickle design decisions.

These files are **research notes, not executable Agent Skills and not authority**. External claims are summarized and linked to their source. PlotPickle decisions are called out separately so later maintainers can see what was adopted, what was rejected, and why.

## Notes

- [DeepSeek Harness patterns](deepseek-harness-patterns.md) — event-log-derived context, loop reminders, truthful truncation/policy feedback, permission-preserving code mode, fresh-context restart.
- [Graph Engineering patterns](graph-engineering-patterns.md) — bounded nodes, real dependency edges, fan-out/reduce/verify/synthesize, fresh verification, failure routes and hard caps.
- [Reliable AI systems: workflows, verifiers, decomposition, Skills and tools](reliable-ai-systems.md) — programmed workflows, objective verification, role-based decomposition, reusable Skills and connector/tool integration.
- [GitSkills and the Agent Skill supply chain](gitskills-supply-chain.md) — public Skill scale, copying/reuse, quarantine, provenance, curation and eval implications.
- [Official Agent Skills specification notes](agent-skills-specification.md) — format, progressive disclosure, optional scripts/references/assets, validation and PlotPickle authority boundaries.

## PlotPickle architecture these notes support

`Agent Profile -> Agent Skills -> Context Engine -> Host Trust/Policy -> Responsibility Run -> optional Graph -> Capability Router -> provider/model adapter -> verifier -> writer gate -> PPF`

Key invariants:

- A Skill is procedure, not permission.
- PPF remains creative truth; memory and external sources are context, not canon.
- External/BUZZ content is untrusted by default.
- A worker is not the sole verifier of its own work.
- Local failure never silently becomes paid cloud work.
- Graph execution is used only where work has genuine independent width.
- Research corpora can inform PlotPickle; they do not become runtime authority merely because they are popular or signed.

## Related roadmap

- #962 Agent Profiles
- #963 Context Engine
- #964 PPF revision/provenance
- #965 Trust/Policy
- #966 Responsibility Runs
- #967 Graph execution
- #968 Observability/evals
- #969 backup/retention/docs
- #970 umbrella roadmap
- #976 Skill trust/supply-chain foundation
- #977 research-library tracking

## Maintenance rule

When a new external source changes a design decision, add or update a note with:

1. source title, URL and review date
2. source-derived findings
3. PlotPickle interpretation
4. decisions adopted
5. decisions explicitly not adopted
6. related issue/PR numbers

Prefer summaries plus links. Do not copy full third-party articles into this public repository.
