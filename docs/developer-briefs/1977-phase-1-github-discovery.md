# Developer Brief — #1977 Phase 1: Deterministic GitHub Discovery

## Goal

Implement the first executable OSS Radar slice after the Phase 0 contract: read-only GitHub repository discovery using `GITHUB_TOKEN`, normalize repository metadata, apply deterministic filters/base scoring, and return a ranked candidate set suitable for later Phase 2 reporting.

This phase does not publish a daily report and does not write to GitHub.

## Authority

Phase 0 remains authoritative for dispositions, lanes, scoring weights, thresholds, license/activity policy, copyright boundaries and Human adoption authority.

Phase 1 may:
- read `config/oss-radar/discovery-contract.json`;
- query GitHub's repository search API with `GITHUB_TOKEN`;
- normalize repository metadata;
- apply deterministic hard filters and activity/license handling;
- calculate explainable base scores from repository metadata and lane/query evidence;
- deduplicate the same repository found through multiple queries;
- emit structured JSON to stdout for inspection or later consumers.

Phase 1 must not:
- create or update GitHub issues/comments;
- persist monthly/daily Radar history;
- install dependencies;
- import repository code or curriculum;
- fetch or copy third-party lesson bodies, scripts or long quotations;
- mutate PlotPickle product state;
- make an adoption decision;
- schedule itself;
- invoke a paid/model-assisted analysis path.

## GitHub client

Use Node's built-in `fetch`; add no SDK dependency.

The client:
- requires `GITHUB_TOKEN` for live execution;
- sends GitHub API media/version headers and token authorization;
- executes only enabled Phase 0 lane queries;
- adds deterministic recency/star qualifiers from the versioned contract;
- sorts GitHub search by recently updated repositories;
- caps results per query to a small configurable value;
- treats non-2xx responses as explicit failures with status context;
- supports injected `fetch` in tests so fixture tests require no network or secret.

Live discovery is read-only. No endpoint other than repository search is required in this phase.

## Normalized candidate

Each repository candidate should retain only useful evidence needed for deterministic filtering/scoring and later reporting:

- stable GitHub repository id;
- full name/name/url;
- description;
- owner type;
- primary language;
- topics;
- stars/forks/open issues;
- archived/fork flags;
- SPDX/license signal;
- created/updated/pushed timestamps;
- default branch;
- matched lane ids;
- matched query strings;
- normalized searchable text.

Do not retain README bodies or source-code bodies in Phase 1.

## Filtering

Apply the Phase 0 contract conservatively.

Hard reject when deterministically evidenced:
- archived repository;
- explicit clearly incompatible/unlicensed signal;
- outside activity rejection window unless a future explicit strategic-watch override is supplied;
- no meaningful overlap with the lane/query vocabulary that discovered it.

Fork status alone is not enough to prove a non-divergent fork. Do not invent divergence evidence. A fork can be retained with reduced maturity/evolution evidence until a later phase adds a stronger proof.

Unknown/no-assertion license:
- may remain discoverable as WATCH-grade evidence;
- cannot be marked adoption-eligible;
- receives no positive license-fit score.

## Base scoring

Use the Phase 0 100-point weight map and integration-cost penalty boundary. Phase 1 calculates only evidence available from GitHub repository metadata and query/lane matches.

Principles:
- keyword/query relevance drives opportunity fit and lane-specific value;
- recency/activity contributes to evolution and maintenance evidence;
- stars/forks are bounded maturity signals, never the ranking authority;
- known usable license metadata contributes license evidence;
- local/Windows keywords contribute only the small Windows/local dimension;
- no dimension may exceed its configured weight;
- no model-generated score is allowed;
- every score contains per-dimension numeric evidence plus deterministic reason codes.

Because Phase 1 lacks PlotPickle subsystem/history context, dimensions such as current-roadmap fit and integration cost must use conservative defaults rather than invented precision. Phase 3 can improve evolutionary relevance mapping later.

## In-run deduplication

The same repository may appear from several lane queries. Collapse duplicates by stable GitHub repository id (fall back to normalized full name only if id is absent), preserving:
- union of matched lanes;
- union of matched queries;
- strongest score/evidence;
- one normalized repository record.

Persistent cross-day history/deduplication remains Phase 2.

## CLI output

`node scripts/oss-radar/discover-github.mjs`

Output one JSON document containing:
- contract/version marker;
- discovery timestamp;
- enabled lanes/query count;
- raw result count;
- rejected count with deterministic reason totals;
- ranked retained candidates.

The CLI is an inspection/building-block surface, not the Human daily report.

## Fixture tests

Use repository-search-shaped fixture data covering:
- all six discovery lanes;
- one repository returned through multiple queries;
- archived rejection;
- stale rejection;
- unknown-license WATCH/adoption-ineligible behavior;
- known-license positive evidence;
- fork retained without falsely claiming non-divergence;
- deterministic ranking independent of input order;
- query construction and authorization header behavior;
- explicit API failure behavior;
- no write endpoint or product mutation path.

## Files / ownership

Expected Phase 1 changes:
- this brief;
- `scripts/oss-radar/discovery-core.mjs`;
- `scripts/oss-radar/discover-github.mjs`;
- fixture data under `tests/fixtures/oss-radar/`;
- focused `tests/issue-1977-oss-radar-discovery.test.mjs`;
- `config/development-convergence/1977.json` advanced to Phase 1;
- verification ownership mapping for `scripts/oss-radar/**` if required.

Do not alter GitHub Actions in this phase.

## Exit criteria

Phase 1 is complete when:
- live client is read-only and requires `GITHUB_TOKEN`;
- enabled versioned queries are deterministically converted into GitHub searches;
- repository metadata normalization is stable;
- hard filters and license/activity rules follow Phase 0;
- scoring is bounded, explainable and deterministic;
- duplicates collapse without losing lane/query evidence;
- fixture tests cover the major lanes and failure/boundary cases;
- no report/issue/history/schedule/model path is introduced;
- development convergence is `CONVERGED`;
- exact-head Architecture Verification is green.

Stop after merge before Phase 2 report/monthly issue lifecycle.