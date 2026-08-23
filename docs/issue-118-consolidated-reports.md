# Issue #118 — Consolidated Reports workspace

## Objective

Create one persistent Reports workspace with Project, Story, Characters, Scenes, Dialogue, Production, Feedback and Connections views. Every value must come from canonical project records or an explicitly supplied local connection snapshot; Reports must not create a second analytics database.

## Reuse boundary

`lib/consolidated-reports.ts` composes existing report logic rather than replacing it:

- `createCharacterDialogueReport` supplies character dialogue, word, scene, side and speaking-duration data;
- `createProducerReport` supplies scale, cast, locations, breakdown, schedule and blocker totals;
- `createDirectorReport` supplies canonical scene intention, cast, locations, pages, runtime, coverage and status;
- `createScreenplayPopulationReport` supplies schema-wide project completion;
- `createMiniBlockWallModel` supplies 96-card completion, storyboard coverage and structural diagnostics;
- `createStoredFeedbackModel` supplies unified active and resolved Feedback.

The consolidated model adds cross-report joins only where the existing builders do not already provide the requested view, such as shared character scenes, scene feedback counts, repeated dialogue phrases and optional connection-state overlays.

## Persistent sections

1. Project
2. Story
3. Characters
4. Scenes
5. Dialogue
6. Production
7. Feedback
8. Connections

These identifiers are fixed in `CONSOLIDATED_REPORT_SECTIONS` so selecting a report can remain inside the Reports workspace.

## Project report

The Project view exposes:

- current draft and screenplay source;
- format, genre and tone;
- estimated runtime and target runtime;
- pages and screenplay elements;
- canonical scenes, characters and locations;
- 24-Block and mini-block completion;
- storyboard-frame coverage;
- unresolved and resolved Feedback;
- schema version and last canonical update.

## Story report

The Story view derives:

- act and sequence balance;
- target minutes and estimated scene duration;
- 24/96 completion;
- missing, overloaded, escalation and repeated-beat diagnostics;
- setup/payoff counts and unresolved relationships;
- character-arc checkpoint progress;
- story-thread coverage and unresolved milestones;
- pacing profile and average shot duration.

## Character report

Each character row includes:

- scenes and screenplay dialogue activity;
- lines, entries, words and speaking duration;
- first and last appearance;
- most frequent shared-scene partners;
- arc progress;
- identity-image and linked-frame continuity;
- wardrobe, makeup and stunt requirements;
- estimated scheduled shooting days;
- a stable target back to the character in context.

## Scene report

Each canonical scene includes:

- heading, interior/exterior and day/night interpretation;
- linked location and cast;
- page and runtime estimates;
- canonical Block;
- storyboard-frame and shot coverage;
- Feedback count;
- breakdown readiness and requirement count;
- stable scene and Block target IDs.

## Dialogue report

The Dialogue view includes:

- existing character lines, words, scene headings, sides and spoken duration;
- longest dialogue elements;
- dialogue-heavy and silent scenes;
- recurring three-word phrases;
- voice-profile coverage.

Dialogue calculations use the current canonical screenplay draft and the existing normalization/counting helpers.

## Production report

The Production view exposes the existing producer and director summaries plus canonical:

- shots;
- sonic cues;
- scene breakdowns;
- schedule days;
- distribution and marketing milestones.

## Feedback report

The Feedback view groups canonical Feedback by:

- status;
- source;
- reviewer;
- priority;
- category;
- Block, mini-block and scene distribution;
- Writers’ Room notes;
- table-read and performance notes.

Resolved and rejected history remains visible.

## Connections report

Connections receives an optional `ReportsRuntimeConnections` overlay for live local status. It reports:

- GitHub;
- AI provider;
- plugins;
- Google;
- local storage;
- backups;
- repository, branch, project path and canonical sync metadata;
- last check or sync time;
- authentication or runtime errors.

When no overlay is supplied, every optional integration defaults safely to disconnected or unknown while all project, story, character, scene, dialogue, production and Feedback reports remain available. Detailed setup links target Settings.

## Interaction boundary

The model supplies stable workspace and target references instead of performing redirects. The live Reports workspace owns navigation, preserves the selected report, opens exact editing context when requested and provides a clear return path.

## Live workspace

`app/reports-workspace.tsx` mounts the eight persistent views from the consolidated model. It includes responsive metric cards, completeness bars, diagnostic lists, report tables, empty states and disconnected connection states.

Report actions are coordinated by `app/page.tsx`. Opening an external target retains the chosen report, selects the matching Block, scene or character where available, and displays a visible return control. Build accepts an exact act, sequence or Block target, while Write accepts the selected Block and scene.

## Non-negotiable rules

- No cached report database.
- No mutation of canonical project records.
- No silent redirect from one report to another workspace.
- Existing report builders remain the source of truth where available.
- Optional integrations may all be disconnected.
- Report targets use stable IDs rather than current positions.
