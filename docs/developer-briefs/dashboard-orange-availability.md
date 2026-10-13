# #2950 Dashboard orange exploration availability

## Confirmed Human direction

During the PlotPickle-only synthetic story run, the Human requested that unavailable Dashboard destinations be listed as available and marked orange. A targeted clarification confirmed **every currently unavailable Dashboard destination**, not only Write, Screening and Sound. The Human wants to utilize these surfaces to find and record gaps against behavioral truths.

## Assessment and ownership

The canonical Dashboard registry deliberately defers thirteen existing destinations. The Matrix host already has Screening/Sound handlers, while the other retained implementations need an in-shell entry adapter. Reuse the registry, Matrix review host and existing product components; do not restore a document-navigation fallback or create another project store. Existing Previs, Timeline and Rough Cut review status stays yellow; existing locked destinations stay green. Orange means available for exploration, not approved or production complete.

## Acceptance

1. All thirteen formerly unavailable destinations are enterable and carry orange exploration status: Screening, Reports, Write, Edit, Refine, Foley, Narration, Music, Deck, Package, Feedback, Wyrmwood and The Unwritten.
2. Identity, labels, shortcuts and groups remain stable. Existing green locked and yellow review destinations retain their status. Unknown destinations remain unavailable; Log Off and Shut Down retain terminal semantics.
3. Primary entry and return remain inside Matrix. Reuse existing canonical workspaces and existing project/auth/provider/approval checks; opening a surface must not approve story/media, unlock curriculum, switch providers or claim production readiness.
4. Deferred legacy workspace differences are observable gaps, not silently repaired project-state bridges. No private story, credentials or generated media are committed.
5. Focused tests are admitted against unchanged approved white-paper v3.0 W8/W9, with scope/limits. Observe actual orange markers and successful entry/return, run focused UAT, production build, BEN and convergence. Independent exact-head CI remains authoritative for merge.

## Impact map

Owner: app composition and Matrix Dashboard; no core authority contract changes. Files: dashboard registry/panel/review host, one private Dashboard exploration component, existing Dashboard status CSS, nearest focused tests and admission catalogue. Upstream: Dashboard pointer, keyboard and startup navigation. Downstream: existing Write/Edit/Refine/Pitch/Feedback/Wyrmwood/STORY and Screening/Sound implementations. Authenticated Library/PPF state remains the owner. Provider and runtime routing stays untouched.

## Verification limits

Current-main integration: preserve the merged #2963 Write owner and its unsaved-edit guards; the lazy exploration adapter does not duplicate Write. Eight legacy destinations mount beneath a width-bounded private composition wrapper, while Screening/Sound retain existing handlers. Return uses the Matrix host's existing lifecycle. The Human explicitly requested moving this Codex work to main on October 13; merge only after exact-head required gates pass. MiniMax/OpenAI provider configuration is a separate user-directed workflow and does not enter this source change.

Registry tests prove declared availability/navigation classifications; static handoff checks prove reuse wiring, not every workspace's correctness. Browser observation checks actual selected surfaces and orange computed appearance. No local or CI test result is a claim that the complete synthetic movie worked. The story run resumes after this prerequisite and retains missing/failed outcomes.
