# Developer Brief — #2369 DSDD semantic and Pi grounding integrity

## Purpose

Fail closed when DSDD interpretation or Pi Draft quality is obviously unusable, using the real dogfood failures published as #2366 and #2367.

## Product rule

The Human statement remains the semantic source.

Interpretation may summarize that statement, but cannot silently replace it with unrelated/repetitive text. Pi Draft may inspect the repository read-only, but cannot present guessed files/symbols as evidence-backed implementation guidance.

## Repair boundaries

### Interpretation persistence

Before a DSDD interpretation is persisted:

- require meaningful non-empty semantic content;
- reject pathological repeated sentences/phrases;
- reject a no-problem/no-action conclusion unless the Human narration supports it;
- require at least one meaningful subject term to survive between Human narration and interpretation for ordinary development requests.

### Intent lock

The server repeats interpretation validation before creating an intent version, requirements, handoff packet or Pi lock entry.

Requirement extraction deduplicates repeated bullets/sentences and keeps each requirement bounded.

### Pi Draft

Pi instructions require every code-spanned repository path to come from bounded read/grep/find/ls inspection.

The server validates Pi output before it becomes a ready developer brief:

- reject speculative phrases that present guesses as implementation guidance;
- reject code-spanned repository paths that do not exist in the current repository.

### Publish Brief

Publish Brief independently repeats semantic and Pi grounding validation before calling the GitHub Issue publisher.

A stale invalid session therefore cannot bypass the repair.

## Dogfood fixtures

Layer 2 owns semantic-integrity fixtures derived from #2366/#2367.

Layer 4 owns Pi-grounding fixtures including the invented `src/config/menus.ts` and `src/tests/config/menus.test.ts` paths.

No new permanent verification gate is added.

## Preserve

- 01 Interpret → 02 Pi Draft → 03 Publish Brief;
- local Quality interpretation;
- Pi 0.87 persistent/read-only session;
- no DSDD source mutation;
- explicit Human Publish Brief action;
- exact-head green-only merge authority.

## Out of scope

- implementing the Learn request from #2366;
- implementing the Dashboard/Mind Map request from #2367;
- changing Timeline/MP4 behavior;
- replacing Human review with semantic scoring.
