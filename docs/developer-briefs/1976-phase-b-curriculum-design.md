# #1976 — Phase B: curriculum design map

## Status

Phase B is design-only. Phase A research is merged; Phase C authoring has not started.

- Parent issue: #1976
- Phase A research ledger: `docs/research/1976-screenwriting-gap-ledger.json`
- External research snapshot remains pinned to `jtydhr88/screenwriting-skills@92022d2123676857e73f3ae94a9b76b6cb3f65b8`
- Permanent navigation remains 6 Paths / 24 Craft Modules
- Canonical LEARN bodies, counts and hashes remain unchanged in Phase B
- No Sage, EA, Journey or provider behavior changes belong here

## Goal

Turn the Phase A gap analysis into a bounded PlotPickle curriculum design before any teaching body is written.

Phase B decides:

1. which high-value gaps become canonical lesson candidates;
2. which candidates are Essentials, Deep Dives or Medium Extensions;
3. which supporting material is better represented as a Case Study or Exercise rather than a separate lesson;
4. one stable lesson ID, canonical topic owner and exactly one Craft Module owner for every approved lesson candidate;
5. the order in which Phase C should author the material without attempting all enrichment at once.

## Authority model

The Phase B design is PlotPickle-owned.

The external repository remains a research index only. It does not determine PlotPickle wording, lesson structure, pedagogy, sequence or authority.

The curriculum remains guided, never gated. New material must not create prerequisites that block access, completion gates, grades, mastery scores or mandatory timeframes.

## Approved lesson candidate families

Phase B should design only the highest-value Phase A findings:

- unified scene craft;
- screenplay format and delivery;
- source-to-screen adaptation craft;
- television episode and season architecture;
- series engine and bible design;
- writers' room and story-breaking workflow;
- half-hour comedy / sitcom craft;
- professional pitching, representation and career practice.

This is intentionally smaller than the full 21-area research ledger. Strong-overlap topics do not need duplicate lessons, and specialist traditions/corpora remain optional future enrichment.

## Content-kind rules

Use these categories:

- **Essential** — broadly useful craft that belongs in the general PlotPickle journey.
- **Deep Dive** — a focused expansion of an existing craft area for learners who want more depth.
- **Medium Extension** — craft whose rules are specific to a medium such as television or half-hour comedy and must not be presented as universal screenplay law.
- **Case Study** — a rights-safe PlotPickle-authored analysis used to illuminate a lesson; not copied screenplay/case-study prose.
- **Exercise** — an applied activity attached to a lesson; not a new canonical lesson unless later promoted deliberately.

## Stable lesson-ID rule

Phase B reserves stable IDs before bodies are written. IDs must:

- be unique against the current 81 archived lessons;
- be descriptive rather than numbered by future global sequence;
- remain stable if visible ordering changes later;
- map to exactly one canonical topic and exactly one Craft Module owner;
- allow cross-links to other Craft Modules without creating duplicate ownership.

## Ownership rule

The 24 Craft Modules are durable containers. Phase B may assign new lesson candidates to existing modules only.

A lesson may have multiple related modules, but one and only one `ownerCraftModule`.

Do not create Course 25, Path 07, a second curriculum tree, or a separate progress store.

## Authoring waves

To keep Phase C bounded, use three authoring waves rather than one large curriculum rewrite.

### Wave C1 — general craft bridges

Author first:

- scene craft;
- screenplay format and delivery;
- source-to-screen adaptation;
- professional pitching and representation.

These close general-purpose gaps without requiring the television medium layer.

### Wave C2 — television medium extensions

Then author:

- episode and season architecture;
- series engine and bible design;
- writers' room and story breaking;
- half-hour comedy / sitcom craft.

These must be explicitly labeled as medium-specific where appropriate.

### Wave C3 — optional enrichment after C1/C2 integrity

Only after the first two waves are stable, consider independently authored:

- international craft-tradition deep dives;
- comparative case studies;
- specialist stage/opera material;
- additional genre/medium exercises.

C3 is not approved for body authoring by Phase B itself.

## Rights and provenance boundary

Phase C must write all lesson bodies from scratch in PlotPickle's voice.

Do not copy or adapt external `SKILL.md`, `reference.md`, published screenplay excerpts, proprietary case-study prose or source-book wording.

For new teaching:

- verify current industry rules/rates against official sources at authoring time;
- prefer primary/authorized references where practical;
- keep creative craft concepts separate from legal advice;
- use invented or rights-safe examples when a screenplay excerpt is unnecessary;
- preserve provenance notes for research inputs.

## What Phase B must not change

Do not:

- edit `learn/*.json` lesson bodies;
- add the reserved lesson IDs to the canonical archive yet;
- change `learn/index.json` counts or hashes;
- alter `learn/program-map-spec.mjs` lesson references;
- change Journey or Explore behavior;
- change completion authority;
- add Sage or EA awareness;
- import external prose;
- begin Phase C in the same PR.

## Verification

Phase B is complete when deterministic checks prove:

1. every approved lesson candidate has a unique stable ID;
2. no candidate ID collides with an existing canonical lesson ID;
3. every candidate has one allowed content kind, one canonical topic and exactly one existing Craft Module owner;
4. all related Craft Module references resolve to `course-01` through `course-24`;
5. the design contains the eight approved high-value lesson candidates and no accidental Phase C bodies;
6. supporting Case Study and Exercise items attach to a lesson candidate rather than inventing a second curriculum tree;
7. Phase A's 12-topic / 81 archived lesson / 95 source / 88 presentation baseline remains unchanged;
8. authoring waves are explicit and C3 remains optional/deferred;
9. external research remains research-only and no body text is imported;
10. exact-head Architecture Verification is green before merge.

## Build order

1. Commit this Phase B brief first.
2. Create the deterministic curriculum design map.
3. Add the focused Phase B design test.
4. Update #1976 development convergence to Phase B.
5. Open the Phase B PR and run exact-head Architecture Verification.
6. Fix only actual verification defects.
7. Merge when green and stop. Do not begin Phase C in the same PR.
