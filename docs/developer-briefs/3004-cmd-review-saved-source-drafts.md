# #3004 Phase 3A — read back unaccepted Mind Map / World Map source drafts in Command

## Purpose and exact status
PR #3011 added authenticated screenplay passage proposal/confirm into the existing saved Library PPF. A new read-only `PlotPickle mind-map review <canonical-field-id>` (or `world-map review <canonical-field-id>`) reads the persisted proposal and its exact sourceRef from the same canonical field store. This is a bounded inspection enhancement; it is NOT the Story Architect production, the Outline-to-Write handoff, approval, or a movie render.

## Truth boundaries
- The currently unlocked profile and selected PPF must still match; complete retained imported source and canonical field registry are required. In-world access is restricted to World topic field IDs, and all requests use the existing `parseCmdSourceProposal` and `createCmdSourceProposalSession` paths.
- A direct import quote is reported VERIFIED only if the *currently retained passage* re-creates exactly the persisted unaccepted draft text. Changed, agent-written, absent or stale source citations display NOT VERIFIED, not false observed-canon authority.
- The read-back shows current PPF identity/revision, acceptedSource metadata, saved sourceRef and unaccepted draft content without writing, calling agents, changing canonical decisions, running media or charging providers. No `acceptStoryDevelopmentFieldProposal` or bypass of Human approval is introduced.
- A saved draft is not the original screenplay itself and is not an accepted screenplay fact. Review/edit/approval remains with the established Mind Map / World Map Human controls.
- No actual local Brotherly Love PPF, account-owned encrypted checkpoint or backend inference was available to this GitHub-only implementation. Fixture CI is not authenticated Windows UAT.

## Accepted tests and gating
`tests/issue-3004-cmd-source-proposals.test.mjs` extends synthetic exact-source confirm and immutable accepted-value checks with verified persisted review, altered source draft warning, missing proposal, wrong topic and profile negatives. The unchanged White Paper v3 W8/W9 sources retain the approved truth definitions; the test-catalog target digest is refreshed and convergence checks included.

A green merge can deliver this read-only tool only. #3004 remains OPEN, and #2999 live Story Architect failure cannot be resolved by adding a status screen. Required on-device sequence: update and restart, select Brotherly Love, run source/fields/propose/confirm/review once, verify same field in GUI and after restart, then use read-only `PlotPickle diagnose Block 01` and `PlotPickle production Block 01` on old protected tasks, with no automatic retries.

After safe authenticated diagnosis, explicitly authorize a new scoped Story Architect pass; only real assessment + seven-dimension semantic review + source-bound candidate can advance Outline → Write → Shot 01 → Previs → Timeline → actual Rough Cut playback.
