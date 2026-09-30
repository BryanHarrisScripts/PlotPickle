# #2602 — Canonical Learn taxonomy + Mind Map / World Map parity audit

Parent: #2601

## Decision captured

PlotPickle already has one shared twelve-topic navigation spine, but it does not yet have one shared twelve-topic project-field model.

The audit therefore treats the existing Learn taxonomy as the structural authority while recording what Mind Map and World Map actually do today. It does not move or delete story content.

## Current findings

- Blank project construction is empty by code: the empty project factory initializes empty Foundations, World, Build and Production state.
- Mind Map currently represents the twelve topics through free-form Discovery lanes and one generic Agent Proposal workflow.
- World Map has structured curriculum-backed fields for Foundations and World, derived projections for Character, Theme, Structure, Previs, Drafting and Responsible AI, and placeholders for Dialogue, Revision, Industry and Collaboration.
- World Map still owns authoring/generation behavior that the parent brief assigns to Mind Map: Ask World Agent, character visual generation and poster generation.
- Existing Foundations and World fact IDs already establish a useful compatibility pattern: `<topic>:<lessonId>:<fieldId>`.
- The observed Afterglow material appearing in the apparent blank state is tracked as a migration candidate, not treated as proof that the blank factory itself is seeded.

## Machine-readable source of truth

`config/story-learning-surface-parity.json`

This file records:
- the exact 12-topic order;
- Learn file and lesson inventory;
- current Mind Map lanes and agent-action mode;
- current World Map panels, value sources and authoring controls;
- target surface responsibility;
- explicit gaps;
- Afterglow migration-candidate storage paths;
- Phase 2 safety preconditions.

## Stable identity policy

Curriculum-backed project fields use:

`<topic>:<lessonId>:<fieldId>`

Project artifacts not naturally represented as curriculum fields use:

`<topic>:artifact:<artifactId>`

A field/artifact gets one canonical identity. Mind Map and World Map may render it differently but may not own separate project values.

Instructional-only Learn material is explicitly allowed and must not be converted into invented project canon merely to achieve visual parity.

## Phase 2 gate

Do not purge runtime-visible Afterglow material until its exact storage path and packaged-example destination are proven.

The audit identifies the relevant storage domains now, including Foundations answers/brief, World answers/brief, Character Truth, structure, writing, Discovery cards, visual artifacts, World Map character visuals and production state.

The next phase may migrate values only after proving each destination while preserving reusable blank schemas and creation capability.
