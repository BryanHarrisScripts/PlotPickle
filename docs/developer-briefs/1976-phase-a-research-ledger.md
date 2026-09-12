# #1976 — Phase A: LEARN enrichment research ledger

## Status

Brief-first Phase A. This document defines the research-only slice before any curriculum-body changes.

- Parent issue: #1976
- #1918 Journey framework: preserve 6 Paths / 24 Craft Modules
- Curriculum bodies: unchanged in Phase A
- Canonical counts/hashes: unchanged in Phase A
- External repositories: research/gap-analysis inputs only
- Permanent PlotPickle teaching: independently authored only in later phases

## Goal

Build an auditable comparison ledger between PlotPickle's existing canonical LEARN curriculum and the external `jtydhr88/screenwriting-skills` research index. Classify each external skill area as:

- **strong overlap** — PlotPickle already teaches the central craft territory with meaningful depth;
- **partial** — PlotPickle covers the central territory but misses a material sub-area or medium-specific application;
- **gap** — the external area exposes a substantial craft territory that PlotPickle does not currently teach as a coherent subject;
- **specialist** — useful but intentionally optional/niche relative to PlotPickle's core screenwriting journey.

The ledger is a research artifact, not curriculum authority and not an import plan.

## Frozen research snapshot

Issue #1976 was opened against a 21-skill external inventory. The external repository later expanded from 21 to 24 skills on the same day. To preserve reproducibility, Phase A is pinned to the last 21-skill commit before that expansion:

`jtydhr88/screenwriting-skills@92022d2123676857e73f3ae94a9b76b6cb3f65b8`

The later 21 → 24 expansion is explicitly out of scope for this Phase A ledger. A future refresh may compare the newer snapshot without rewriting this historical analysis.

## PlotPickle baseline

Use the existing canonical #1918 Phase 0 baseline as the comparison authority:

- 12 curriculum topics;
- 81 archived lessons;
- 95 bundled source documents;
- 88 presentation lessons after Foundations expansion;
- 6 visible Paths / 24 Craft Modules remain the durable navigation framework.

Do not mutate those counts, hashes, lesson bodies, source bodies, IDs, or program-map ownership during Phase A.

## Copyright and provenance boundary

The external repository is a research index only.

Do not copy into PlotPickle:

- `SKILL.md` bodies;
- `reference.md` bodies;
- script excerpts/corpora;
- case-study prose;
- copyrighted examples;
- source-book phrasing.

Phase A may record only high-level topic summaries needed to explain coverage/gaps, plus stable source references and the pinned external commit.

Any later PlotPickle teaching must be authored independently in PlotPickle's own language and structure, with provenance appropriate to the new material.

## Phase A deliverables

1. One ledger covering all 21 skill directories in the pinned snapshot.
2. For each skill:
   - stable external skill ID;
   - high-level research territory;
   - PlotPickle classification: strong overlap / partial / gap / specialist;
   - current PlotPickle coverage owner(s);
   - missing or underdeveloped craft territory;
   - likely existing Craft Module home(s) if enrichment is later approved;
   - proposed later content shape: none / extension / deep dive / case study / exercise / new lesson candidate;
   - research/provenance note.
3. A compact summary of the highest-value gaps.
4. Deterministic validation that the ledger contains exactly the 21 pinned skill IDs once each and uses only the allowed classifications/content-shape values.

## Likely high-value gap families to test

Phase A should verify, not assume, the issue's initial priorities:

- television / series craft;
- episode and season structure;
- pilot architecture and series engines/bibles;
- writers' room process;
- half-hour comedy / sitcom craft;
- adaptation and screenplay-format craft;
- international/alternative screenwriting traditions;
- rights-safe analytical case studies;
- professional/industry practice depth.

## Existing Craft Module placement rule

The 24 Craft Modules are durable containers, not content-size limits. If Phase A finds a worthwhile addition, map it into the best existing module(s) rather than creating Path 07 or Craft Module 25.

Expected placement families:

- Modules 01–02: premise, theme, story promise, story-bible extensions;
- Modules 03 / 05 / 10: character conflict and advanced character systems;
- Modules 07–09: structure, series structure, pilot/season architecture, case studies;
- Modules 11 / 13 / 14: dialogue and comedy-dialogue extensions;
- Modules 15–16: screenplay craft, format, adaptation and drafting;
- Modules 17–18: scene/revision diagnosis and applied case studies;
- Modules 20–22: writers' room and collaboration craft;
- Modules 23–24: industry/business/professional practice.

## What Phase A must not do

Do not:

- author new curriculum lesson bodies;
- change `learn/*.json` curriculum bodies;
- import external prose or corpora;
- add new Paths or Craft Modules;
- renumber existing lessons or Craft Modules;
- alter curriculum hashes/counts;
- modify Sage/EA/Agent behavior;
- change Journey/Explore navigation;
- begin #1918 Phase 8 or Phase 9;
- turn a research classification into a mandatory build commitment.

## Verification

Phase A is complete only when deterministic checks prove:

1. the pinned external commit is recorded exactly;
2. all 21 pinned external skill IDs appear once and only once;
3. no unknown skill IDs appear;
4. every row has an allowed coverage classification;
5. every row has at least one PlotPickle coverage note and a placement/content decision;
6. all proposed Craft Module IDs resolve to the existing `course-01` through `course-24` map;
7. the current 81 / 95 / 88 curriculum baseline is untouched;
8. no external skill/reference body is copied into the repository;
9. the ledger identifies prioritized gaps without authoring curriculum;
10. exact-head Architecture Verification is green before merge.

## Build order

1. Commit this brief first.
2. Inventory the exact 21 skill IDs from the pinned external commit.
3. Compare each skill at high level against PlotPickle's canonical topic/program map.
4. Write the research ledger.
5. Add a narrow deterministic ledger validator/test and convergence evidence.
6. Run focused verification.
7. Open the Phase A PR and run exact-head Architecture Verification.
8. Fix only actual failures.
9. Merge when green and stop. Do not begin Phase B in the same PR.
