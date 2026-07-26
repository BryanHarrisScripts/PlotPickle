# Issue #116 — Unified structured Feedback

## Objective

Consolidate PlotPickle’s existing review fragments into one discoverable Feedback system without creating a second comment database or allowing feedback to change canon automatically.

## Canonical reuse boundary

The foundation reads from existing project-owned records:

- `project.review.threads` for anchored human review and collaborator notes;
- approved Specialist Lab passes stored inside `project.revisions`;
- AI provenance and approval boundaries retained by Specialist Lab passes;
- Build’s canonical structural diagnostics;
- stable Block, scene, mini-block, character, screenplay-element and storyboard-frame IDs.

`lib/unified-feedback.ts` creates a unified read model only. It does not add browser storage, a feedback database or a second persisted record collection.

## Feedback submenu

The unified model establishes these permanent sections:

1. Overview
2. AI Review
3. Human Review
4. Writers’ Room
5. Shooting Script
6. Table Read

Writers’ Room, Shooting Script and Table Read may begin with foundation records, but their placement and source identifiers are now fixed.

## Record model

Every `UnifiedFeedbackRecord` includes:

- a stable target reference and destination workspace;
- author and author role;
- source;
- body;
- status;
- priority;
- category;
- proposed change;
- full thread messages;
- resolution;
- created, updated and resolved dates;
- linked revision ID;
- origin ID and a flag identifying synthetic read-only records.

The required statuses are:

- Open
- Under review
- Accepted
- Partially accepted
- Rejected
- Resolved
- Deferred

Legacy `in-review` records are mapped to `under-review` in the unified view. Existing project schema `1.7.0` is not changed by this foundation.

## Supported targets

The target model establishes stable references for:

- project;
- act;
- sequence;
- Block;
- mini-block;
- character;
- relationship;
- world;
- treatment;
- screenplay;
- scene;
- dialogue passage;
- action passage;
- storyboard frame;
- visual identity;
- production item.

Target resolution uses IDs rather than current Block or mini-block positions. Reordering therefore does not break feedback links.

## Source adapters

### Anchored review threads

Existing `project.review.threads` are adapted into human, AI, diagnostic, collaboration, Writers’ Room, Shooting Script or Table Read records. Existing comments remain the thread history.

The adapter also recognizes optional comment conventions already safe inside legacy threads:

- `Proposed change: ...`
- `Resolution: ...`

### Specialist Lab and revision history

Approved Specialist Lab passes become accepted Feedback records. Their before/after evidence is retained, and each record points to the canonical revision snapshot that contains the pass.

### Structural diagnostics

The 96-mini-block wall’s warnings become read-only diagnostic Feedback records. They remain proposals or warnings only and never rewrite project content.

## Filtering and reporting foundation

The model supports:

- full-text search across title, body, proposed change, resolution, target and author;
- status, source, priority, category and target-kind filters;
- one stable target filter for context-sensitive side panels;
- active versus resolved history;
- section totals;
- per-target badge counts for Blocks, mini-blocks, scenes, characters, screenplay passages and storyboard frames.

## Migration strategy

This first slice deliberately avoids changing the persisted project schema. The next slice will add migration-tested write operations only after the adapters prove that existing projects, saved passes and diagnostics are represented correctly.

Any persisted extension must:

- preserve legacy review-thread IDs and comments;
- normalize old `in-review` records;
- retain stable target IDs;
- survive import, export and `.ppf` packaging;
- keep feedback proposal-only until the writer explicitly applies a change;
- preserve searchable resolved history.

## Next implementation slice

1. Replace the current Feedback summary screen with the six-section unified workspace.
2. Add filters, searchable history, record detail and stable context links.
3. Add migration-tested creation and status operations for the seven required statuses.
4. Add feedback badges to Build, Write and Storyboard.
5. Add context-preserving side-panel entry from Blocks, mini-blocks, scenes, screenplay passages and frames.
