# Developer Brief — #2371 DSDD semantic integrity and Pi grounding

## Problem

Real Human dogfood on 22 September 2026 produced Issues #2366 and #2367.

Both preserved the original Human narration, but DSDD accepted a degenerate interpretation and allowed it to become locked intent. #2366 repeated filler until the persistence bound. #2367 locked an unrelated no-action phrase. Pi then produced technical guidance from corrupted intent and cited speculative repository paths.

This breaks the central DSDD promise: deterministic machinery must not confidently implement a specification that no longer reflects what the Human said.

## Repair

The repair is deliberately bounded and deterministic.

### Interpretation integrity

A pure DSDD integrity contract now rejects:
- missing Human/interpretation content;
- the existing persistence truncation marker;
- pathological repeated sentences or repeated five-word windows;
- a no-action conclusion when the Human did not describe a no-action observation;
- interpretations with grossly insufficient material-term overlap to the latest Human narration.

Explicit Human statements such as "this is not a problem" remain valid and can terminate without Pi Draft.

The same assertion is enforced when interpretation is persisted, again when intent is locked, and again before Publish Brief. This prevents stale or legacy corrupted session data from bypassing the fix.

The guard is intentionally not a semantic-equivalence engine. It catches gross substitution/corruption and fails closed so the Human can correct or re-interpret.

### Pi repository grounding

Pi remains read-only.

The Pi Draft prompt now requires concrete repository files/tests to be named as repo-relative paths in backticks only after bounded repository inspection. Unknown locations must be stated as "Unknown / requires inspection."

After Pi returns, a deterministic grounding check extracts concrete path claims and verifies they exist inside the current PlotPickle checkout. A missing/outside-repository path rejects the draft before it can become ready.

This directly blocks the #2367 invented `src/config/menus.ts` and `src/tests/config/menus.test.ts` failure shape.

### Recovery UX

If Interpret fails, the Human's submitted narration is restored to the DSDD textarea so it can be corrected or retried immediately.

## Verification

`tests/issue-2371-dsdd-integrity.test.mjs` uses the real #2366/#2367 Human/interpretation shapes and proves:
- repeated Learn corruption is rejected;
- unrelated Dashboard no-action corruption is rejected;
- valid explicit no-action remains accepted;
- a concise Discover/Mind Map interpretation is accepted;
- invented Pi repository paths are rejected;
- append/lock/publish all retain the integrity assertion.

The regression is routed through the existing Experience Contract and Agent Runtime DSDD verification owners. No new permanent gate is added.

## Non-goals

- no second model/judge call;
- no semantic embedding service;
- no automatic rewriting of corrupted intent;
- no DSDD source mutation authority;
- no automatic coding/PR/merge from Conversational UAT;
- no broad Pi runtime redesign.

## Human UAT status carried forward

The same Human session confirmed real image generation.

Timeline/MP4 export remains UNPROVEN because the Human found the test path difficult to complete confidently. That UX problem should be handled separately and must not be converted to PASS or FAIL by this repair.
