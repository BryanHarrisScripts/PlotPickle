# Developer Brief — #2376 DSDD voice action + active-cycle reset

## Human rule

Microphone-originated DSDD narration is always actionable.

No-action is never a model conclusion. For typed narration only, a Human may explicitly declare an observation as no-action.

## Dogfood failure

Human UAT on 23 September 2026 showed a rejected new narration while DSDD still displayed the previous:
- LOCKED INTENT V2;
- Pi Draft ready state;
- GitHub Issue #2367;
- all three process steps as COMPLETE.

The new narration had been dictated through the microphone, yet the interpreter again attempted a no-action interpretation.

## Repair

### Voice provenance

The shared VoiceInputControl exposes one optional callback when dictated text is inserted. DSDD records whether the current draft contains microphone-originated dictation and submits the Human entry with:
- `inputMode: voice`, or
- `inputMode: typed`.

That provenance is stored on the Human conversation entry and copied to a locked intent.

### Voice is always actionable

The deterministic DSDD integrity contract rejects every no-action interpretation when `inputMode === "voice"`.

Typed narration retains a no-action path only when the Human explicitly typed a no-action statement.

The interpreter prompt is also explicit:
- microphone dictation is actionable;
- typed no-action requires explicit Human language.

The server remains the final authority.

### Human-only prompt context

Previous DSDD model replies are no longer fed back into a new interpretation prompt.

Only prior Human narration may appear as historical context. The new Human narration is labelled authoritative for the current cycle.

This prevents an old corrupted DSDD response from contaminating a new interpretation.

### Current active cycle

Submitting new Human narration immediately clears the client-side active locked intent while preserving history.

Hydration only restores a locked intent when its `humanEntryId` matches the latest Human entry.

The server also resolves a locked intent only when it belongs to the latest Human entry. Pi Draft and Publish Brief therefore cannot operate on an older intent after new narration has started.

### Recovery

If interpretation fails, the Human narration is restored. Voice provenance is restored with it, so retrying a dictated request cannot silently become typed/no-action.

## Acceptance proof

`tests/issue-2376-dsdd-action-cycle.test.mjs` proves:
- microphone no-action is always rejected;
- explicit typed no-action remains allowed;
- actionable typed narration cannot be downgraded to no-action;
- voice provenance flows from dictation to server session;
- new Human narration invalidates stale active locked intent;
- server Pi Draft / Publish use only the current Human cycle;
- prior DSDD model output is excluded from new interpretation context.

The regression is routed through existing DSDD Experience Contract and Agent Runtime owners.

## Non-goals

- no automatic coding from DSDD;
- no new permanent CI lane;
- no removal of historical DSDD provenance;
- no broad voice-input redesign;
- no change to DSDD mutation/merge authority.
