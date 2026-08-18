# Story Knowledge Graph

PlotPickle's Story Knowledge Graph is a **derived, read-only evidence index**. It is not a second canon store.

> **PPF = truth. Knowledge Graph = derived understanding. Context Engine = evidence gate. Agents = judgment. Writer = canon authority.**

## Authority boundary

Canonical project state continues to live in the PPF. Graph construction reads a project or approved source material and emits a separate `StoryKnowledgeGraph`. No graph API accepts a PPF mutation callback, canon write scope, or project-store handle.

The Context Engine exposes graph slices as `story-knowledge-graph` sources with `allowedUse: evidence` and `trust: unverified`. Their authority is capped below `ppf-canon`, and the existing Context Engine character budget still decides whether they fit in a task packet.

Absence from the graph is never evidence that a fact is absent from canon. Structured extraction proves output shape, not completeness or truth.

## V1 data flow

```text
PPF / approved story source
        |
        +--> deterministic PPF seed (available now)
        |       characters, locations, blocks, relationships
        |
        +--> provider-neutral extractor contract (future/optional)
                Fast route: high-volume structured extraction
                Quality route: ambiguous resolution / synthesis
                        |
                        v
             typed extraction batches
                        |
                        v
              resolver + singleton fallback
                        |
                        v
                derived graph + health
                        |
            +-----------+-----------+
            |                       |
      deterministic eval        bounded query
            |                       |
            v                       v
      P/R/F1 + loss signals      Context Engine
                                    |
                                    v
                                  Agent
```

Local inference concurrency is intentionally bounded to one extraction/resolution call at a time by the routing contract. Browser, CPU and deterministic graph work may still run independently. No provider or model name is hard-coded into the graph contract.

## Silent-loss rules

Resolution is not allowed to delete a source entity. When a supplied resolver omits a name, the assembler keeps it as a singleton canonical node and increments `orphanCount`.

Relations that cannot be assembled are not silently discarded. The graph records:

- `unresolvedSource`
- `unresolvedTarget`
- `selfLoop`

These counters, the source entity/relation counts, resolver merge count, node/edge count, and connected component count form health telemetry. Connected components are diagnostic only; fewer components do not prove a better graph because over-merging can create misleading connectivity.

## Provenance

Every entity and edge carries bounded provenance:

- project-relative/source identifier
- source revision
- stable evidence identifier
- optional evidence location/excerpt
- extractor ID, version, and model route (`deterministic`, `fast`, or `quality`)

The graph does not retain credentials, absolute machine paths, hidden reasoning, provider secrets, or chain-of-thought.

## Revisions

A graph records `sourceRevision`, and `storyKnowledgeGraphIsStale()` compares it with current canon. `diffStoryKnowledgeGraphs()` compares semantic entity and predicate-aware relation keys between revisions, making it suitable for bounded screenplay/PPF revision comparisons without interpreting unattempted material as deletion.

Afterglow is a natural future revision-aware consumer because the repository already distinguishes the complete v9 canonical baseline from the partial v10 rewrite. V1 only establishes the graph/eval contract; it does not automatically promote a partial rewrite into canon.

## Evaluation

`scripts/story-knowledge-graph-eval.mjs` scores a prediction against a hand-labeled gold set. The initial bounded fixture uses canonical relationships already present in the bundled Afterglow PPF data.

The evaluator reports:

- entity precision / recall / F1
- **predicate-aware** relation precision / recall / F1
- endpoint-only relation P/R/F1 as a diagnostic (never the quality gate)
- orphan rate
- dropped-edge rate and reasons
- bad-merge rate for predicted alias clusters

Prompt, extractor, resolver, or model-route changes should be evaluated against the same gold set before being considered improvements. A high-precision graph may still have poor recall, so completeness questions such as “who never…?” or “which is the only…?” must not be inferred from graph absence.

## Scale

V1 intentionally uses typed in-memory/JSON structures. A graph database is not justified until measured project scale or traversal latency requires one. The contracts keep persistence separate so a later storage adapter does not change PPF authority or Context Engine trust rules.
