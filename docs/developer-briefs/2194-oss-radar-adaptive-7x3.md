# Developer Brief — #2194 OSS Radar Adaptive 7×3 Intelligence

## Goal

Evolve PlotPickle OSS Radar from a single global Top 5 leaderboard into a daily architecture-intelligence report that keeps PlotPickle current as AI terminology, models, agents, protocols, tooling and implementation patterns change.

## Product contract

The internal daily report is organized by seven stable PlotPickle architecture responsibilities, expressed with plain-language Human-facing aliases:

1. What the user sees and interacts with — Experience Skins
2. How the experience stays consistent — Experience Contract
3. How work moves from idea to finished story — Production Orchestration
4. How agents, skills and tools work together — Agent & Skill Mesh
5. How story knowledge, canon and evidence stay coherent — Story / Canon / Evidence
6. How models, providers and local/cloud compute plug in — Provider Runtime
7. How PlotPickle stays reliable, secure and maintainable — Validation & Operations

Target three complementary, distinct repositories per area, for up to 21 findings per day.

## Key behavioral change

Previously reviewed repositories are no longer allowed to dominate the next day's report simply because they remain highly scored. Unchanged prior reviews are suppressed. Reappearance requires deterministic material-change evidence under the existing history rules.

Same-day reruns remain idempotent and update the existing daily comment.

## Discovery model

The seven architecture areas organize output, not discovery.

The existing discovery lanes remain useful search lenses. #2194 adds adaptive query families for generative UI, graph/context systems, coding-agent harnesses, CLIs, MCP gateways, security/audit, observability, human-agent collaboration and adjacent plugin-based systems.

Production loads the existing discovery contract plus the versioned adaptive overlay at:

- config/oss-radar/discovery-contract.json
- config/oss-radar/adaptive-intelligence.json

The merged live contract uses 42 atomic queries at 11 results per query, keeping the theoretical pointer envelope below the existing 500-pointer ceiling.

## Enrichment

README/manifest enrichment stays bounded and read-only.

The shortlist expands to 42 and is balanced across discovery lanes before global fill so one globally strong category cannot starve other areas.

Additional deterministic evidence concepts include generative UI, UI contracts, context/knowledge graphs, token efficiency, coding harnesses, security audits, CLI/extensions and API/model gateways.

## Ranking

Popularity remains evidence, never authority.

The adaptive scoring profile increases the relative influence of architecture, adaptability, agent/workflow flexibility and system evolution over narrow storytelling-only relevance.

The guiding principle is:

PlotPickle should be architecturally stable but technologically adaptable.

## Selection

The architecture selector:

- maps candidates to architecture areas using discovery-lane evidence, enriched concepts and bounded keyword evidence;
- selects in rounds so all seven areas receive equal opportunity;
- requires unique repositories across the report;
- adds deterministic complementarity bonuses for new query-family/evidence coverage inside an area;
- suppresses unchanged prior reviews;
- allows material resurfacing under existing history rules;
- never invents candidates to fill a short lane.

## Public digest

The internal report owns all 21 findings.

The public/X digest remains intentionally shorter and samples one repository per architecture area where available rather than simply taking the first five global entries.

## Safety boundaries

Unchanged:

- GitHub-first operation;
- Human adoption authority;
- no dependency installation;
- no code import;
- no external Skill execution;
- no README instruction execution;
- no third-party source execution;
- least-privilege workflow permissions;
- hard licence and stale/archive rejection;
- same-day idempotent publishing.

## Verification

Focused regression:
tests/issue-2194-oss-radar-adaptive-7x3.test.mjs

It proves:

- merged seven-area 7×3 contract;
- 21 unique findings when supply is sufficient;
- three complementary findings per area;
- architecture priority weighting above storytelling-only weighting;
- next-day unchanged-review suppression with fresh replacements;
- public sampling across architecture areas.

The daily workflow runs #1977, #2034, #2087 and #2194 Radar regressions before live Radar execution.

## Live UAT

After merge, run OSS Radar manually on main and verify today's #2014 comment is updated in place with seven architecture sections and up to 21 distinct findings.

Refs #2014 #1977 #2015 #2034 #2194.
