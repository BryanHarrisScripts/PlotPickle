# Graph engineering patterns

Reviewed: **2026-08-18**

Primary source:

- https://docs.langchain.com/oss/python/langgraph/graph-api

## What the source contributes

Graph-oriented agent/workflow systems make execution structure explicit through state, nodes and edges. This is useful when multiple specialist operations can run independently, when downstream work truly depends on upstream structured output, or when a workflow needs deterministic routing after a node completes.

## PlotPickle takeaways

Adopted in #967:

- explicit node contracts;
- declared structured input/output schemas;
- real data dependency edges;
- bounded parallel scheduling for independent work;
- explicit machine routes such as pass/retry/reroute/escalate/stop;
- separate treatment of shared mutable/exclusive resources;
- missing-child detection and bounded fan-in;
- fresh verifier separation where the worker cannot be the sole grader.

## Not adopted

- no graph edge merely because one UI step appears after another;
- no general-purpose graph framework as a new PlotPickle authority plane;
- no graph node receives permissions from its position in the graph;
- no unlimited fan-out/fan-in or recursive discovery;
- no graph node writes PPF canon directly.

Each PlotPickle graph node remains a bounded child Responsibility Run and is still subject to Agent Contract, Context, connector/egress, verification and PPF boundaries.

## Skill implication

A Skill may describe a graph procedure, but it cannot create graph permissions. Node scopes/connectors/resources remain host-owned. External graph-oriented Skills are quarantined exactly like any other external Skill.

## Related PlotPickle work

- Responsibility Runs: #966
- Responsibility Graph: #967
- connector policy: #965
- portability evals: #968
- Skill trust: #976
