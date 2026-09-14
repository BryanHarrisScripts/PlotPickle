# Developer Brief — #2034 OSS Radar Discovery Recall

## Assessment

**GO.** The existing OSS Radar owners are sound, but the current compound-query and metadata-only funnel can structurally miss relevant adjacent systems before final ranking. Issue #2034 authorizes a bounded recall correction without reopening #2015 or changing Human adoption authority.

## Goal

Evolve the deterministic GitHub-only funnel to:

```text
atomic query families
→ normalize and deduplicate
→ hard rejection
→ Discovery Score
→ bounded README and primary-manifest enrichment
→ Enriched PlotPickle Score
→ real Top 5 for Human review
```

A repository with InkOS-like sparse metadata and rich architectural documentation must have realistic routes through discovery, enrichment, and final relevance scoring.

## Existing owners to reuse

- `config/oss-radar/discovery-contract.json` owns lanes, query families, budgets, evidence vocabulary, diagnostics, and trust policy.
- `lib/verification/oss-radar/discover-github.mjs` owns GitHub discovery and shortlist orchestration.
- `query-normalization.mjs` and `scoring.mjs` own deterministic identity, filtering, evidence, and ranking.
- `history.mjs` and the Radar renderers own durable evidence and Human-readable telemetry.
- `.github/workflows/oss-radar.yml` remains the scheduled/manual GitHub-only entry point.

No product-runtime owner or second Radar architecture is added.

## Required behavior

1. Replace compound searches with 19–40 versioned narrow queries grouped into stable families.
2. Add the first-class Adjacent Systems / Architectural Comparators lane.
3. Keep the initial configuration-owned envelope at no more than 20 results per query, 500 raw pointers, 25 enrichments, and 5 final review entries.
4. Apply hard rejection before any third-party content retrieval.
5. Preserve the preliminary metadata-only score as `Discovery Score`.
6. Inspect only README plus one configured primary manifest for the bounded shortlist.
7. Store deterministic derived concepts, lane evidence, digests, sizes, and retrieval status; never persist full third-party documents.
8. Re-score enriched candidates and use `Enriched PlotPickle Score` for final ordering.
9. Record discovery coverage and per-query retained, enriched, and Top-5 contribution evidence across runs.
10. Provide an InkOS-derived synthetic sentinel and a live diagnostic command whose changing GitHub result is not a CI authority.

## Authority and security boundaries

Third-party repository content is untrusted research data. Radar may issue bounded read-only GitHub GET requests. It may not clone repositories, recurse through source or documentation trees, execute README instructions, run package scripts, install dependencies, load external Skills, grant tools, or disclose credentials to repository content.

Existing licence rejection, unknown-licence WATCH ceiling, deterministic ranking, same-day idempotence, one rolling monthly issue, least-privilege workflow permissions, and Human adoption authority remain unchanged.

## Non-goals

- external LLM interpretation or ranking;
- autonomous dependency adoption, source import, curriculum copying, or implementation issue creation;
- guaranteeing that a changing live GitHub search always returns InkOS;
- changing #1977 or #2015 completed ownership;
- turning OSS Radar into a product-runtime dependency.

## Acceptance and evidence

- Configuration and focused tests prove atomic query families, query-count and budget validity, and the comparator lane.
- Fixture tests prove cross-query deduplication, configuration-owned ceilings, and licence rejection before enrichment.
- Enrichment tests prove README success/missing/oversized handling, malformed or absent manifests, derived-only persistence, and inert adversarial text.
- The synthetic InkOS fixture reaches enrichment, gains material deterministic relevance, and outranks a metadata-strong comparator.
- Report tests prove enriched Top-5 ordering, exact real-candidate behavior, same-day idempotence, coverage, and query-effectiveness history.
- API/rate-limit failures retain query-specific diagnostics.
- The verification catalog selects the #2034 regression without live network access.
- Exact-head Architecture Verification and the required GitHub gates pass before merge.

## Live UAT

After focused CI is green, run the implementation branch against GitHub, verify the configured funnel/enrichment bounds, confirm no third-party code executes, confirm a real Top 5 publishes when at least five candidates are retained, and record the `Narcooo/inkos` diagnostic result. The deterministic fixture remains the regression authority if live search ranking does not currently surface InkOS.
