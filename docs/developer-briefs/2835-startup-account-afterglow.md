# Clean startup and account-owned Afterglow opening

Issue: https://github.com/BryanHarrisScripts/PlotPickle/issues/2835

## Human intent and assessment

Begin at the PowerShell launcher, sign in, reach Dashboard, then open Afterglow. Prove that path before extending narration or motion. The numbered normal/WebMCP/Conversational UAT menu should leave the ordinary startup flow. Explicit developer switches remain available.

Afterglow has one repository-owned example and one opening flow: choose the provided example, this profile's saved changes, or a profile recovery point. Normal account work never updates the supplied package. Changes to the package's starting content require an issue, reviewed source change and CI.

The Human asked whether GitHub could hold personal saved data for testing, then clarified that this was only a question and saving must remain local. This change does not add GitHub storage, upload account data, or modify project-sync destinations.

Assessment is GO. On main fbd13db, an isolated probe using the real HTTP auth gateway and UI authentication adapter reproduced stale browser records overwriting newer encrypted Afterglow state, foreign-labelled browser records entering the signed-in account, and an empty placeholder becoming a durable example. Existing focused tests were green despite those outcomes.

## Owners and implementation

Reuse the existing profile gateway, encrypted private store, session Library and canonical packaged example loader. Ordinary sign-in reads authenticated encrypted inventory; it performs no legacy import. Existing localStorage remains untouched. Legacy session records are preserved under quarantine rather than merged over encrypted state. Passwords, tokens and keys remain outside test evidence.

The private-state read no longer selects a story or restores a previous session's active pointer. Account inventory and explicit project selection are separate. Opening an example preserves the prior story's source metadata, so the empty startup placeholder remains excluded from durable saves.

One Open Example action opens a starting-point chooser. Restore choices derive only from the currently hydrated profile's Library and recovery points. Latest saved changes retain their working ID. An older recovery point opens as a new working copy, with a pre-restore checkpoint of the newer original. The repository package is never modified.

## Acceptance and evidence

1. Normal PowerShell startup has no selection menu or delay; explicit testing flags still route deterministically. Launcher contract tests cover this; actual Windows execution remains pending.
2. Sign-in and hydration make no private-state mutations from legacy local/session browser records. The real HTTP regression injects foreign-labelled and future-dated session snapshots and verifies preservation of encrypted authority and browser evidence.
3. One default example open persists exactly one story. The regression verifies prior user-story metadata remains intact and the packaged reference is unchanged.
4. Logout, auth runtime restart and reauthentication restore account inventory without automatically opening a story. A second real account receives no first-account projects or restore choices.
5. The chooser offers packaged defaults, saved changes and matching recovery points. Restoring an old point preserves newer account work as a separate project.
6. Focused regression, UAT contracts, production build and development convergence must pass. Exact-head Architecture Verification and the impacted Windows Product Gate remain independent CI gates.

## Actual-account testing boundary

Bryan authorized testing his account. Its encrypted state exists on his Windows machine and is not accessible from this Linux session. A newly generated password or replacement profile does not unlock the original vault and would not test his account. The supported profile-backup route can restore an authenticated backup into an empty isolated node; it still requires legitimate authentication. No backup or account credential has been supplied or exported here. Actual-account sign-in and rendered Windows launcher-to-Dashboard-to-Afterglow acceptance are PENDING, not replaced by synthetic account results.

No automatic rollback of previously imported stale data is attempted. Inspect genuine account backups/recovery points before deciding how to recover any pre-existing damage. Browser legacy data is preserved for explicit recovery; this change does not add a new recovery importer.

## Non-goals

No provider, narration, motion or full-account backup format rewrite. No account reset, credential bypass, production profile mutation, package promotion, or change from local saving. No claim that an HTTP/storage test is a rendered UI test.

CI follow-up: Layers 1, 3 and 5 exposed historical assertions for the superseded two-button opening flow and loader signature. Those tests now assert the single chooser, profile-owned restore selections and missing-choice rejection while retaining resource reconciliation and explicit handoff coverage. The Outline task restart fixture explicitly reopens its approved story after asserting that a new login has no selected project; task authority and budget checks remain unchanged.
