# Developer Brief — #1977 Phase 3: Evolutionary Relevance Mapping

## Goal

Turn Phase 1 repository evidence and Phase 2 report/history into PlotPickle-specific evolutionary guidance without adding model analysis or scheduled automation.

Phase 3 must map a candidate to explicit PlotPickle systems, LEARN/Craft Module areas, STORY/game-engine boundaries, visual-story workflows, AI architecture, local-first/voice, documentation, testing and roadmap vocabulary, then assign one deterministic Human-facing disposition: `SAVE`, `IMPROVE`, `ADD`, `LEARN`, or `WATCH`.

## Authority boundary

The disposition is a Radar classification, not an adoption decision. Human review remains authoritative. Phase 3 may not install code, import curriculum, mutate product/canon, create implementation issues, schedule itself, or use model-assisted analysis.

## Versioned relevance map

Add one versioned relevance configuration under `config/oss-radar/`. Each target records:
- stable id and label;
- PlotPickle system/subsystem;
- allowed Radar lanes;
- deterministic keyword/topic evidence;
- optional LEARN Craft Module ids/ranges;
- optional related PlotPickle issue ids;
- internal evolution categories;
- primary intent: save-work, improve-existing, add-capability, learn-craft, or watch;
- a minimum evidence requirement.

Mappings are evidence indexes, not claims that a repository already integrates with PlotPickle.

## Classification

Rules are deterministic and explainable.

- `WATCH`: unknown/non-adoptable license ceiling, weak/no PlotPickle mapping, or insufficient evidence.
- `LEARN`: strong craft/education mapping with sufficient writer/student value.
- `ADD`: strong missing-capability mapping with sufficient missing-piece/evolution evidence.
- `IMPROVE`: strong mapping to an existing PlotPickle subsystem with sufficient evolution evidence.
- `SAVE`: strongest bounded case only — component-oriented mapping, usable license metadata, sufficient maturity, and strong save-work evidence.

Never infer README/source behavior that Phase 1 did not fetch. Store matched terms, lanes, target ids and numeric thresholds as classification evidence.

## Report changes

Replace Phase 2's universal WATCH label with the deterministic Phase 3 disposition. For each finding show:
- primary disposition;
- mapped PlotPickle target(s);
- Craft Module / issue fit where evidenced;
- why the classification was chosen;
- what PlotPickle can investigate/learn without claiming unobserved behavior;
- recommended review mode: adopt-component, adapt-idea, independently-author-teaching, add-capability, or watch-only.

## History

Persist the Phase 3 disposition, mapped target ids and internal categories in the existing comment-backed daily state. Mapping/category/disposition changes are meaningful relevance changes and may permit resurfacing.

## Focused tests

Cover all five dispositions, mapping to LEARN Craft Modules, STORY #1675, AI architecture, visual-story and local voice/engineering targets, unknown-license WATCH ceiling, unmapped WATCH fallback, deterministic ordering, history round-trip, and no schedule/model path.

## Exit

Phase 3 is complete when the versioned relevance map, deterministic mapper/classifier, report/history integration and focused fixtures are green under exact-head Architecture Verification. Stop before Phase 4 scheduled workflow/UAT.