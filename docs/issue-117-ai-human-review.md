# Issue #117 — AI Review and Human Review workflows

## Objective

Extend the unified Feedback workspace with optional AI review and structured human review while preserving writer control. Review output is evidence and proposed change material only; it never rewrites canonical story records automatically.

## Reuse boundary

The workflows reuse existing PlotPickle systems:

- `project.review.threads` and the unified Feedback metadata layer;
- stable Feedback targets introduced by issue #116;
- the local AI gateway and locally stored provider connection;
- Specialist Lab prompt and provenance conventions;
- canonical revision history and approval boundaries;
- the existing GitHub collaboration proposal gateway when connected.

No second feedback database, AI-result database or human-review collection is introduced.

## AI Review

`lib/review-workflows.ts` supports these scopes:

- whole project;
- selected act;
- selected sequence;
- selected Blocks;
- all 24 Blocks;
- selected mini-blocks;
- all 96 mini-blocks;
- character arc;
- treatment;
- screenplay;
- selected scenes;
- storyboard continuity.

All selected story records are resolved by stable IDs. Block and mini-block reordering therefore does not break review targets.

The available lenses are story editor, instructor, director, producer, actor, dialogue specialist, continuity reviewer, visual continuity reviewer, audience reader, pacing analyst and structure analyst. Custom questions are appended to the selected lens rather than replacing its safety and output instructions.

Before submission, every request contains:

- a privacy notice identifying whether story context leaves the computer;
- the selected context size;
- a provider-cost warning without inventing a price;
- an explicit writer-control statement;
- provider, model, request date and deterministic prompt provenance.

A disconnected provider can still prepare and save a request locally. A live call remains optional.

## Structured AI result

AI output is parsed into:

- project summary;
- per-target findings;
- recurring patterns;
- review priorities;
- proposed changes;
- evidence;
- provider, model, completion date and prompt hash.

Saved findings become canonical Feedback records with `source: ai` and `status: under-review`. They do not modify Blocks, mini-blocks, scenes, screenplay elements, characters or storyboard frames.

The writer may accept, reject or defer a finding. Accepted feedback may be converted into a separate revision proposal, but the proposal remains inert until explicitly approved.

## Human Review

Human review requests retain:

- reviewer name, role, organisation and optional contact information;
- stable review target;
- custom questions;
- request and due dates;
- draft, requested, in-progress, submitted, resolved or cancelled status;
- threaded Feedback responses;
- proposed changes, approval and resolution;
- optional GitHub proposal URL and number.

Human review remains fully usable with no AI provider and no GitHub connection.

## Revision proposal boundary

`ReviewRevisionProposal` records the originating Feedback ID, stable target, rationale, proposed change, status and optional GitHub linkage. Creating or approving this proposal does not directly apply story changes. A later explicit revision operation must still update canon and record the writer’s decision.

## Export

The workflow exports a Markdown review summary containing targets, reviewer roles, sources, statuses, priorities, categories, linked revisions, proposed changes and resolutions.

## Non-negotiable rules

- Feedback cannot change canon automatically.
- Provider credentials never enter project files or prompts.
- Review scopes use stable IDs.
- AI and GitHub are optional.
- Human review works entirely locally.
- Accepted feedback creates a proposal, not an automatic edit.
- Provider/model/date/prompt provenance remains visible.
