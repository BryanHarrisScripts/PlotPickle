# Development brief — #2890: Resumable Afterglow consolidation review

**Authority:** Human conversation October 9, 2026; #2890, parent #2863. **Phase:** one bounded correction, then return to Graphic Novel/Previs/Timeline.

## Problem
The Human made a complete set of creative decisions but observed no confirmation of a saved consolidated Afterglow, and Library held five older versions, not a verified new master. Earlier fixes improved Library and Save diagnostics, but none preserved the human decisions independently while navigating away. Creative selection must not be disposable if commit fails.

## Required interaction
1. **Refresh Saved Versions** — inspect current signed-in saved-source inventory, preserve existing selections and the one profile-owned review draft, identify source mismatch.
2. **Review Consolidation** — independently compare all eligible saved working/archived/recovery versions. Explicitly starting a new review is not a hidden restore or extra backup.
3. **Continue Last Review** — reopen the single encrypted review draft, including competing answer choice indexes, human confirmations, deliberate exclusions, image keep/exclude choices and progress, after matching source inventory fingerprint.
4. **Save Consolidated Afterglow** — a separate final commit, not the automatic draft save. Verify choices, question identity, structural and media constraints, exact source bytes, encrypted readback and a current Library opening. Show receipt visibly or precise blocked status.

## State machine
`ABSENT -> REVIEWING -> SAVING_DRAFT -> DRAFT_SAVED -> READY_FOR_MASTER -> COMMITTING -> VERIFIED_MASTER`.

`DRAFT_SAVE_BLOCKED` preserves the current in-memory choices and previous acknowledged draft. `SOURCE_DRIFT` preserves the encrypted draft but refuses blind reapplication until explicit re-review. `MASTER_BLOCKED` retains the draft. Never label an unacknowledged write as durable. No automatic replacement of a published packaged example.

## Truth / mathematical invariants
Let `D` be user decisions and `S` the exact full source inventory; `H(S)` is a stable SHA-256 digest. The server owns one encrypted `Draft = { H(S), D, savedAt }` per authorized profile; the latest acknowledged single draft wins.

- `DraftSaved(D,S) => Authenticated && Readback(D,H(S)) == (D,H(S))`.
- `Resume(D,S') => H(S') = H(S)`; otherwise clearly show stale source inventory and preserve the saved draft.
- `Refresh(S')` must never imply `Delete(D)`, `Restore`, `Commit` or `D = { }`.
- `MasterSuccess => ChoicesComplete && IndependentValidation && SourceBytesVerified && MediaVerified && EncryptedReadback && LibraryMasterIdMatch`.
- Rejected/aborted Master cannot destroy source stories, historical recovery, or previously acknowledged review decisions.
- Profile A draft must never be readable/writeable by B; no client-supplied profile/path.

## Implementation contract
Use the existing authenticated `/api/auth/profile-private` with CSRF for writes and no-store GET for the single encrypted review choice document. Bounded validated schema, strictly whitelisted choice types; browser sequential writes, cryptographic digest verification and explicit saving/saved/error state. Never persist entire source snapshots in the review draft. The active review stays displayed despite unrelated Library changed events. Final save awaits draft acknowledgment. Clearing a draft is explicit only after successful master and exact Library readback.

## Acceptance and negative tests
Prove all choice kinds, rapid consecutive writes, refreshing source list, leaving Settings, restarting/reopening, locked/unlocked profile isolation, source changes, missing/corrupt media, rejected save, valid commit + exact reopen and no silent success. Run focused tests, architecture / Story / Experience / Windows when selected by impact. Fix only red gates, merge when green.

## Deferred work
No new Data Recovery UI or visible multiple backups, no publication workflow. Immediately return to Storyboard narration/character bubbles, Graphic Novel playback and 3-second Timeline motion workflow when this correction is proven.
