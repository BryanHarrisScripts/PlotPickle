# Developer Brief — #2416 OSS Rules Three-Observation Radar

## Goal

Make the daily OSS Radar show three useful OSS Rules observations whenever ossrules.md is available, with each observation linking to its source page inside OSSRules.md.

## Current gap

OSS Rules enrichment currently depends on an exact match between the day's already-selected GitHub repositories and the OSS Rules project catalog. When none of those repositories is indexed, the Radar reports zero OSS Rules observations even though the OSS Rules pattern library contains reusable instruction patterns relevant to PlotPickle.

## Design

Preserve the existing GitHub-first Radar and exact-project enrichment.

After exact-project research:
- keep any exact-project observations already found;
- fill remaining observation slots, up to three total, from a bounded PlotPickle-relevant pattern set;
- avoid duplicate pattern IDs;
- keep pinned upstream GitHub evidence internally when exact-project matches exist;
- expose an OSSRules.md pattern URL for every human-facing observation.

Initial fallback patterns:
1. Verification by change type — `/agent-rules/verification-matrix`
2. Router files — `/agent-rules/skill-routing`
3. Pointing at the source of truth — `/agent-rules/single-source`

## Boundaries

- OSS Rules remains read-only research.
- Do not import or obey third-party instructions.
- Do not copy full upstream rule bodies into Radar state.
- Preserve the existing 20-second total research budget.
- If OSS Rules is unavailable, fail soft and keep the normal GitHub Radar report usable.
- Do not change GitHub discovery, scoring, selection, or public digest ranking.

## Acceptance

- When OSS Rules and the three pattern endpoints are available, Radar emits three observations.
- Each observation includes an `https://ossrules.md/agent-rules/...` source.
- Exact-project observations remain preferred and pattern fallback only fills missing slots.
- The human-facing daily comment renders the three observations as numbered items.
- OSS Rules outages still fail soft.
- Focused OSS Radar tests and normal CI pass.
