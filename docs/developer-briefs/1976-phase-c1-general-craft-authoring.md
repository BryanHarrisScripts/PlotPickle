# #1976 — Phase C1: independently author general craft bridges

## Status

Phase A research and Phase B curriculum design are merged. Phase C1 authors the first four approved lesson bodies from scratch, but does not yet promote them into the canonical `learn/*.json` archive.

- Parent issue: #1976
- Design authority: `docs/research/1976-curriculum-design-map.json`
- Authoring wave: C1 — general craft bridges
- Permanent navigation: preserve 6 Paths / 24 Craft Modules
- Current canonical baseline remains 12 topics / 81 archived lessons / 95 bundled sources / 88 presentation lessons during C1
- Canonical counts, hashes, manifests and program-map references are Phase D work
- No Journey, Explore, Sage, EA, provider or completion-authority changes belong here

## Goal

Independently author four complete PlotPickle teaching bodies using the stable lesson IDs and ownership decisions locked in Phase B:

1. `scene-craft-pressure-and-turn`
2. `screenplay-format-and-delivery`
3. `adaptation-source-to-screen`
4. `professional-pitching-and-representation`

Each body must be complete enough for Phase D to promote without inventing pedagogy during integration.

## Staging boundary

Phase C1 writes authored bodies under `learn/enrichment/1976-c1/` rather than editing the canonical topic files directly.

That boundary is intentional:

- Phase C is authoring.
- Phase D is canonical integration and integrity bookkeeping.

A staged C1 body is not counted as an archived lesson and is not Journey-visible until Phase D deliberately promotes it. This prevents partially integrated curriculum from changing counts/hashes or creating ambiguous ownership.

## Required lesson shape

Every C1 lesson must contain:

- stable `id` from Phase B;
- locked `topic` and `ownerCraftModule`;
- content kind;
- title and duration;
- overview;
- at least three objectives;
- substantive sections;
- definitions;
- one PlotPickle-authored or rights-safe example;
- checklist;
- common mistakes;
- exercise;
- apply target;
- tags;
- Phase B companion item(s);
- research/provenance notes without copied source bodies.

Do not assign future global lesson numbers in C1. Ordering belongs to Phase D integration.

## Authoring principles

### PlotPickle voice

Teach choices, pressure, evidence and workflow rather than formulas. State durable principles plainly, make options visible, and preserve Human creative authority.

### Guided, never gated

No quiz, grade, mastery score, pass/fail threshold or required revision. The learner may apply, reflect, keep the story unchanged or move on.

### Deterministic compatibility

Where a lesson points to a project artifact, use concepts PlotPickle can show deterministically: scene objective, visible pressure, turn, screenplay page, source-work note, treatment, pitch, query or readiness sheet. Do not imply an Agent observation is a project fact.

### Rights/provenance

The external `jtydhr88/screenwriting-skills` repository remains a research index only. Do not copy its prose, references, examples, scripts or case-study text.

Use PlotPickle's existing curriculum plus suitable primary/authorized sources to verify durable claims. Store only concise provenance metadata and source URLs; do not import source-page bodies.

### Mutable industry rules

Formatting, guild, representation, credit, option, submission and contract practices can vary by jurisdiction, employer, programme and time. Teach verification habits instead of freezing mutable rules into PlotPickle canon.

## Lesson-specific boundaries

### Scene Craft: Objective, Pressure and Turn

Unify existing PlotPickle scene concepts into a practical diagnostic: entry condition, objective, pressure, tactics, visible carrier, turn, exit condition and transition. Do not impose a mandatory beat count or scene formula.

Owner: `course-15` / Drafting.

### Screenplay Format and Delivery

Teach readability, master-scene conventions, consistency, spec-vs-production distinctions and delivery readiness. Emphasize that professional formatting exists within an accepted range rather than one absolute template. Do not encode mutable contest/submission rules as universal.

Owner: `course-15` / Drafting.

### Adaptation: Source to Screen

Teach selection, compression, expansion, combination, point-of-view choices and conversion of internal material into visible/audible screen action. Keep creative adaptation craft separate from rights/legal advice. Access to a source is not treated as permission to adapt it.

Owner: `course-16` / Drafting.

### Professional Practice: Pitching and Representation

Teach truthful project preparation, pitch/query purpose, representation as a professional relationship, verification of current rules and healthy career workflow. Do not promise access, representation or outcomes. Do not provide legal advice or freeze compensation/credit rules.

Owner: `course-24` / Industry.

## Research references for C1

Primary/authorized references verified at authoring time include:

- Academy of Motion Picture Arts and Sciences — Nicholl screenwriting resources / formatting guidance: `https://www.oscars.org/nicholl/screenwriting-resources`
- Writers Guild of America West — Guide to the Guild / Agency Department and current agency framework: `https://www.wga.org/the-guild/about-us/guide-to-the-guild`
- Writers Guild of America West — Agency Agreements: `https://www.wga.org/employers/agencies/agency-agreements`
- Writers Guild of America West — Screen Credits Manual: `https://www.wga.org/contracts/credits/manuals/screen-credits-manual`
- Writers Guild of America West — Writers' Deal Hub: `https://www.wga.org/members/employment-resources/writers-deal-hub`
- U.S. Copyright Office — Copyright Act definitions / derivative works: `https://www.copyright.gov/title17/92chap1.html`
- U.S. Copyright Office — derivative-work registration guidance: `https://www.copyright.gov/eco/help-limitation.html`

These sources support verification boundaries only. Their prose is not copied into the lesson bodies.

## What C1 must not change

Do not:

- edit canonical `learn/*.json` topic files;
- modify `learn/index.json` counts or hashes;
- modify `learn/journey-baseline.json`;
- modify `learn/program-map-spec.mjs`;
- add C2 television lesson bodies;
- add C3 specialist lessons;
- change Journey or Explore behavior;
- change progress/completion state;
- add Sage/EA behavior;
- import external source bodies or screenplay excerpts.

## Verification

C1 is complete when deterministic checks prove:

1. exactly the four Phase B C1 lesson IDs are authored;
2. each ID/title/topic/kind/owner matches Phase B exactly;
3. each body contains the required canonical teaching components;
4. companion items match Phase B and remain attached to their lesson;
5. examples are PlotPickle-authored/invented or explicitly rights-safe;
6. research sources contain metadata/URLs only, not copied source bodies;
7. the external research repository remains research-only;
8. no C2/C3 body has been authored;
9. current canonical counts/hashes remain unchanged because promotion is deferred to Phase D;
10. exact-head Architecture Verification is green before merge.

## Build order

1. Commit this brief first.
2. Author the four C1 bodies from scratch.
3. Add a focused C1 authoring test.
4. Update #1976 development convergence to Phase C1.
5. Open the C1 PR and run exact-head Architecture Verification.
6. Fix only actual failures.
7. Merge when green and stop. Do not begin C2 or Phase D in the same PR.
