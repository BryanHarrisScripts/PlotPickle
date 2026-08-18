# DeepSeek harness and agent integration patterns

Reviewed: **2026-08-18**

Primary source:

- https://github.com/deepseek-ai/awesome-deepseek-agent

## What the source contributes

DeepSeek AI's official agent-project collection is useful as an interoperability survey: the same model family appears across different agent products, coding tools, frameworks and integration styles. The important PlotPickle lesson is that a model should not define the product agent's identity or authority contract.

## PlotPickle takeaways

Adopted:

- keep Agent Profiles/Contracts model-agnostic and request capability roles such as `fast`, `quality`, `deep`, `vision` or `repair`;
- keep provider/model/runtime differences below the product-role layer;
- normalize provider/runtime quirks in a provider harness rather than copying them into each agent definition;
- use portability evals before considering a different model/runtime suitable for a PlotPickle role.

This aligns with PlotPickle's current provider adapter and portability work in #968.

## Not adopted

- no DeepSeek-specific identity fields in Agent Contracts;
- no Skill is trusted because it targets or was demonstrated with a particular model;
- no provider/model may grant additional tools or PPF authority;
- no automatic fallback from failed local inference to a paid DeepSeek or other cloud endpoint.

## Supply-chain implication

A Skill sourced from a model-specific agent ecosystem is still treated as an external Skill. Its model association may be useful evaluation metadata, but it does not change quarantine, provenance, hash or approval requirements.

## Related PlotPickle work

- Agent Contract capability roles: #962
- connector/provider authority boundary: #965
- model/runtime portability evals: #968
- Skill supply-chain trust: #976
