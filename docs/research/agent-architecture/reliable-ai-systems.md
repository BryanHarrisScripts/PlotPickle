# Reliable AI systems: workflows, verifiers, decomposition, Skills and tools

**Reviewed:** 2026-08-17  
**Project-provided article:** “Stanford and Berkeley wrote how to build a $100k/month AI company. Here's the full system.”

Primary links referenced by the article:

- DSPy paper: https://openreview.net/forum?id=sY5N0zY5Od
- Stanford AI Index 2026: https://hai.stanford.edu/ai-index/2026
- Kimi Code repository: https://github.com/MoonshotAI/kimi-code

## Source-derived principles

The article organizes its argument around five principles:

1. **Program the workflow instead of hand-tuning one giant prompt.** Break a reliable job into research/retrieval/reasoning/verification/output modules and optimize against explicit metrics.
2. **Build verifiers.** Code is a strong example because compilers, tests and type checks provide objective environmental feedback.
3. **Decompose by role, not agent count.** Sequential, parallel and recursive work help only when responsibilities and shared state are clear; overlapping agents can perform worse because of coordination cost.
4. **Encode repeatable expertise as Skills.** Reusable procedures compound rather than being re-explained in every session.
5. **Connect agents to real tools/data.** Tool protocols such as MCP can expose live systems, but they also create a permission and provenance boundary.

## PlotPickle interpretation

The model should be replaceable. PlotPickle's durable value should accumulate in the system around the model:

- Agent Profiles
- Agent Skills
- PPF/project history
- Context Engine and provenance
- host permissions
- Responsibility Runs and graph contracts
- evaluation/verification evidence
- BUZZ/Playhouse collaboration
- writer-facing approval and creative authority

A public model can occupy a capability role without becoming part of product identity.

## Decisions adopted

- #966 formalizes programmed bounded workflows as Responsibility Runs.
- #968 expands objective/deterministic verification and model-independent evals.
- #967 decomposes only when roles/jobs have real independent width.
- Agent Skills remain reusable procedural knowledge.
- #965 treats MCP/connectors as host-controlled capability adapters rather than authority.
- Capability routing keeps Sage/PLAN/Pi/visual jobs independent of one specific model family.

## Decisions not adopted

- Do not make DSPy a required framework before the existing eval layer can prove it improves a specific PlotPickle job.
- Do not make Kimi, Qwen, DeepSeek, OpenAI or another provider the product architecture.
- Do not use agent self-confidence as verification.
- Do not equate more agents with better output.
- Do not make MCP the universal internal nervous system; native/local adapters remain valid and policy stays above the connector layer.

## Follow-up research question

After #968 has stable scenario/rubric/contract evals, test whether automatic prompt/procedure optimization materially improves a bounded Sage/PLAN task. Optimize only against trustworthy metrics.

## Related issues

#962, #965, #966, #967, #968, #970.
