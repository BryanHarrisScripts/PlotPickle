# Developer Brief — #1977 Phase 2

## Goal

Add deterministic daily report rendering, persistent cross-day review history, and one rolling monthly OSS Radar issue. Preserve Phase 0 Human authority and Phase 1 discovery/scoring.

## Scope

Phase 2 may:
- select qualifying Phase 1 candidates;
- render up to five findings without padding;
- create or reuse one issue titled `[OSS RADAR] <Month> <Year>`;
- create one dated report comment per UTC day;
- update that same dated comment on rerun;
- reconstruct prior review history from Radar daily comments;
- write only Radar issue/comment state.

Phase 2 must not:
- add a scheduled workflow;
- add model-assisted analysis;
- install dependencies or import repository code/curriculum;
- mutate PlotPickle product/canon;
- create implementation issues;
- make Human adoption decisions.

## History

Store machine-readable state inside each daily report comment. Do not add a mutable repository history file.

Each reviewed repository records:
- stable repository id and full name;
- first-seen and last-reviewed dates;
- last pushed/updated marker;
- prior disposition;
- lane-derived internal categories;
- compact score evidence;
- PlotPickle decision, defaulting to `unreviewed` unless an existing Human decision is present.

Reconstruct history from prior Radar daily comments within 730 days. Ignore the current date's existing comment when building the suppression baseline so same-day reruns remain idempotent.

Suppress a recently reviewed unchanged repository. Permit resurfacing when:
- lane-derived categories materially change;
- score changes by at least 5 points;
- repository activity marker changes and the prior review is at least 30 days old.

## Phase 2 disposition boundary

Phase 3 owns robust SAVE / IMPROVE / ADD / LEARN / WATCH mapping. Phase 2 therefore renders every selected finding conservatively as `WATCH` and says this is the Phase 2 default pending evolutionary mapping.

Lane-to-category mapping is deterministic:
- writer-craft → WRITER CRAFT
- visual-story → VISUAL STORY
- story-game-engine → STORY / GAME ENGINE
- learn-education → LEARN / EDUCATION
- ai-architecture → AI ARCHITECTURE
- platform-engineering → ARCHITECTURE

## Finding selection

From ranked Phase 1 retained candidates:
1. apply history suppression;
2. keep normal candidates at the configured surface threshold;
3. allow unknown-license WATCH-only candidates at the configured watch-evidence threshold;
4. preserve ranking;
5. return at most the configured target, normally five;
6. never pad weak findings.

## Daily report

Include date, count, no-padding note when needed, WATCH-default note, and for each finding:
- repository/link and description;
- why PlotPickle should care, grounded only in matched lanes and deterministic score evidence;
- `What can PlotPickle learn from this?` as a bounded review target rather than invented knowledge;
- lane-specific benefit signals;
- current Radar lane fit;
- integration effort as unassessed in Phase 2;
- license/activity signal;
- compact score evidence.

Do not fetch README or source bodies.

## Monthly issue lifecycle

Use Node built-in HTTP fetch with injectable fixtures. Allowed operations are limited to issue search, issue creation, comment listing, daily comment creation, and daily comment update.

If the exact monthly issue is absent, create it once. If duplicate exact-title monthly issues exist, fail explicitly.

Each daily comment contains a deterministic date marker. A same-date rerun updates the matching comment rather than creating a second one.

## Tests

Cover:
- five findings;
- fewer-than-five and zero findings;
- monthly title generation and reuse;
- month rollover;
- same-day update idempotency;
- prior-day suppression;
- category/score/activity-based reappearance;
- current-day exclusion from history baseline;
- state-marker round trip and malformed-comment tolerance;
- explicit API failure;
- issue/comment endpoints only.

No test requires live network access.

## Expected files

- this brief;
- `lib/verification/oss-radar/report-history.mjs`;
- `lib/verification/oss-radar/issue-lifecycle.mjs`;
- `lib/verification/oss-radar/run-radar.mjs`;
- Phase 2 fixture data;
- focused Phase 2 tests;
- `config/development-convergence/1977.json` advanced to Phase 2.

Do not alter GitHub Actions in this phase.

## Exit

Phase 2 is complete when report selection/rendering, comment-backed history, monthly issue creation/reuse, and same-day idempotency are fixture-proven and exact-head Architecture Verification is green. Stop before Phase 3.