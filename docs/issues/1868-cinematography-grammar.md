# Issue 1868 — PlotPickle Cinematography Grammar

## Purpose

PlotPickle needs a provider-independent cinematography language beneath Sequence Director. The goal is not to ship a prompt library or copy third-party prose. The system should translate story intent into a small, explicit set of filmmaking primitives, then let existing provider adapters express those decisions in model-specific language.

## Product boundary

The grammar is descriptive, not authoritative. It may suggest framing, camera behavior, composition, lighting, edit intent, atmosphere, continuity and related observable choices. It cannot choose providers, models, runtimes, API keys, approve canon, or spend credits.

## Original vocabulary policy

The implementation uses original PlotPickle wording and normalized filmmaking concepts. External libraries and Cinematique are treated as research references only. Prompt prose, naming schemes, branding and proprietary databases are not copied into the repository.

## Pipeline

Story intent -> deterministic grammar selection -> Sequence Director brief -> provider adapter formatting -> render proposal -> Human review.

## Acceptance

- structured primitives with category, creative intents, observable effect, aliases, applicability, compatible combinations and conflicts;
- deterministic selection from freeform story intent;
- bounded selection count and conflict suppression;
- still/video applicability respected;
- Sequence Director can compile selected primitives without taking provider authority;
- tests cover selection, conflicts, applicability and compiled wording;
- existing Sequence Director timing, continuity and approval behavior remains intact.
