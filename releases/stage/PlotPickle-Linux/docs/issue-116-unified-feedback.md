# Issue #116 — Unified structured Feedback

## Objective

Consolidate PlotPickle’s review fragments into one discoverable Feedback system without creating a second comment database or allowing feedback to change canon automatically.

## Canonical reuse boundary

The implementation reuses:

- `project.review.threads` for anchored human review and collaborator notes;
- approved Specialist Lab passes stored inside `project.revisions`;
- existing AI provenance and approval boundaries;
- Build’s canonical structural diagnostics;
- stable Block, scene, mini-block, character, screenplay-element, storyboard-frame and production-item IDs.

`lib/unified-feedback.ts` provides the unified read model. `lib/unified-feedback-store.ts` persists richer metadata inside the existing canonical review thread as a hidden machine-readable comment. PlotPickle does not create a second feedback collection, browser database or external service dependency.

## Feedback workspace

The primary workflow now includes Build and Feedback in their approved order. Feedback contains six permanent sections:

1. Overview
2. AI Review
3. Human Review
4. Writers’ Room
5. Shooting Script
6. Table Read

The live workspace provides:

- status, source, priority and category filters;
- full-text search across title, body, proposal, resolution, target and author;
- active and resolved history;
- section totals and status summaries;
- canonical target selection across every supported record kind;
- anchored feedback creation;
- threaded comments;
- editable status, priority, category and author role;
- proposed-change and resolution fields;
- linked revision selection;
- read-only diagnostic and approved-revision evidence;
- context-preserving links back to Plan, Build, Write, Storyboard, Refine, Dashboard and Reports.

## Record model

Every unified record includes:

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

Statuses:

- Open
- Under review
- Accepted
- Partially accepted
- Rejected
- Resolved
- Deferred

Legacy `in-review` records appear as `under-review`. Stored records continue using schema `1.7.0`; the richer status and target metadata round-trips through the existing review-thread container.

## Supported targets

Feedback can attach to:

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

Target resolution uses stable IDs instead of current positions. Reordering Blocks or mini-blocks therefore does not break links.

## Source adapters

### Anchored review threads

Existing `project.review.threads` become human, AI, diagnostic, collaboration, Writers’ Room, Shooting Script or Table Read records. Existing comments remain visible thread history.

### Specialist Lab and revision history

Approved Specialist Lab passes become accepted read-only Feedback records. Their before/after evidence and linked revision remain available.

### Structural diagnostics

The 96-mini-block wall’s warnings become read-only diagnostic records. They remain proposals or warnings and never rewrite project content.

## Context badges

Feedback badges are visible in:

- Build Block cards and the Block inspector;
- the 96-mini-block inspector;
- Write for the current Block;
- Storyboard for the current Block.

Opening Feedback from these locations carries the stable target ID into the workspace. Returning through the target link restores the corresponding Block, mini-block, character or workspace context.

## Canon safety

- Feedback never applies a proposed change automatically.
- Accepting or resolving a record changes review metadata only.
- Synthetic diagnostics and revision evidence are read-only.
- Canonical project edits remain separate explicit actions.
- Imported legacy projects retain thread IDs, comments and history.
- All primary operations work offline without AI, GitHub or Google.
