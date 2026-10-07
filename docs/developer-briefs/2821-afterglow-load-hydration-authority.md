# #2821 — Save/session investigation and first-shot acceptance

## Phase ownership and status

- [ ] Phase 1 — Save/session routing inventory and reproduction (started: repository inspection).
- [ ] Phase 2 — Confirm root causes with behavioral evidence.
- [ ] Phase 3 — Repair confirmed shared or isolated causes.
- [ ] Phase 4 — Regression, build, and focused UAT verification.
- [ ] Phase 5 — Bryan generates, plays, and reopens the three-second Shot 1 clip, then confirms readiness to continue generating visuals.

Phase 5 is a Human acceptance gate. Automated or mocked tests do not replace Bryan's confirmation. Keep this parent open until that confirmation. Prepare a reviewable investigation/repair PR after concrete changes and relevant validation; do not label it ready before that evidence exists.

## Current execution plan — investigation, repair, and prevention

This section governs sequencing for the expanded October 7 scope; earlier observations remain evidence, not proof that the current live failure is solved. The issue and repository developer brief carry the expanded scope; repository updates are reviewed through the investigation PR.

### Phase 1 — Inventory and reproduce

Map every Save path and shared persistence/session adapter. Reproduce the reported Shot 1, Shot 19, unload/reload, delayed screen jump, named navigation, and missing Previs symptoms under an identified current build and project revision. Preserve existing user data.

Deliverables: route inventory, reproducible sequences, expected versus actual outcomes, and baseline evidence. Do not interpret access to the UI as proof of an authenticated mutation session.

### Phase 2 — Establish root causes

Instrument and trace actual button events, writes, acknowledgements, session status, local unlock state, authorization decisions, and hydration/recovery transitions. Find the first boundary where valid state is lost, replaced, rejected, or falsely represented.

Explicitly distinguish:
- genuine logout or expired session;
- authenticated profile with locked local encrypted storage;
- missing/expired CSRF proof;
- stale or misleading UI status;
- wrong active profile/project identity;
- provider authorization or route verification failure;
- loading/hydration races and failed persistence.

For every confirmed cause, document triggering conditions, owning code path, affected surfaces, shared versus isolated scope, why earlier fixes missed it, and a failing behavioral reproduction. Rule out alternative explanations with evidence. Multiple causes are allowed; do not force every symptom into one theory. No speculative storage rewrite, blanket re-sign-in workaround, or authentication bypass.

Exit: a causal explanation and failing regression for each defect being fixed. Instrumentation can ship independently; root-cause repairs follow confirmed evidence.

### Phase 3 — Repair the owning layers

Fix confirmed shared causes in shared adapters/session boundaries before duplicating fixes across surfaces. Fix isolated handlers where necessary. Implement truthful Save pending/success/failure feedback and the verified-profile indicator in PlotPickle Score. Preserve valid session authority across project navigation and unload; preserve durable story decisions across hydration and recovery.

For each repair record the precise before/after behavior and link its regression proof. Keep original story content, media identity, and user choices intact.

### Phase 4 — Prevent recurrence across surfaces

Execute representative save/reload and failure cases for every distinct persistence family, plus the named navigation matrix. Exercise delayed hydration/write completion, obsolete responses, unload with pending or failed writes, real session expiry/logout, locked storage, and stale CSRF where relevant to confirmed defects. Verify profile/project isolation and identity indicator accuracy.

Deliverables: coverage matrix, passing behavioral regressions, live runtime evidence, and explicit limitations. A source-pattern test or green CI alone cannot close a live persistence/session defect.

### Phase 5 — Bryan performs live acceptance

Bryan will execute the preserved end-to-end acceptance sequence using his running system: authenticate, restore Afterglow with Your Changes, save/lock Shot 1, confirm Shot 19 narration authorization, verify each configured ComfyUI/H3 route independently, generate and play an actual three-second Shot 1 Timeline clip, and retain it after navigation and unload/reopen.

The final output is the clip and intact project/session state. A submitted provider job, changed label, or passed preflight is insufficient.

### Issue and PR structure

Keep #2821 as the parent for the overall investigation and user outcome. Use phases now instead of creating speculative child issues for every panel.

After Phase 2, create linked child issues only for confirmed independent causes or work that merits a separately reviewable PR. Each child must identify evidence, owning layer, affected surfaces, dependency order, acceptance criteria, and regression proof. A shared defect affecting several panels belongs in one shared-layer child, not one duplicate issue per panel. Add a dedicated provider child only if video delivery remains independently broken after upstream repairs.

Maintain a parent checklist of discovered causes and linked deliveries. Merge incremental PRs only after their relevant checks pass; keep the parent open until the full live acceptance sequence succeeds or a clearly documented unresolved limitation remains. Do not close the parent merely because a child PR merged.

### Review outcome

The brief captures all discussion through this request: app-wide Save audit; Shot 1 silent Save; Shot 19 false/presumed sign-out; unload/reload and 9:11 a.m. snapshot; delayed load jump; Dashboard/World Map/Outline/Settings navigation; missing Previs; current runtime versus saved story authority; truthful PlotPickle Score identity; secure provider persistence and route verification; independent ComfyUI/H3 testing; and playable three-second Shot 1 retained after reopen.

The user now authorizes starting Phases 1–4: investigation, root-cause repair, and regression verification. Phase 5 live generation/playback/retention is owned by Bryan. Do not generate paid provider clips on his behalf under this plan.


---

## Problem

Live UAT after #2819 shows that Storyboard Save is still not durable for some recovered Afterglow Storyboard Images, and Previs narration can still report that the Human must sign in even though the Human is already operating inside PlotPickle.

The failure now appears to be broader than the Save button itself.

The Human's startup workflow is:

1. Start PlotPickle.
2. Sign in.
3. Open Library.
4. Choose **Open Example with Your Changes** for Afterglow.
5. Continue working on that previously saved Afterglow story.

The intended meaning of that action is simple:

> Load the previously changed Afterglow story into the current PlotPickle runtime.

Loading Afterglow must never restore an older version of PlotPickle's controls, product semantics, authorization behavior, or runtime rules.

## Human contract

There are two separate authorities:

### Current PlotPickle build

The current build owns:

- Save behavior;
- Lock / Unlock behavior;
- current interpretation of saved/locked state;
- narration authorization behavior;
- current UI controls;
- current runtime rules;
- current storage and hydration rules;
- current provider-routing behavior.

These must always come from the current executable/build on `main`.

### Loaded Afterglow story

The loaded story may restore durable story data, including:

- screenplay/story evidence;
- structure;
- writing;
- Mind Map state;
- World Map state;
- Storyboard artifacts and versions;
- selected/accepted/locked visual truth;
- explicit saved markers;
- local-resource provenance;
- production/previs state that is legitimately project data.

The story must not carry an obsolete implementation of current PlotPickle behavior.

## Observed evidence

After #2819 merged, live Storyboard UAT showed two different classes of artifacts in the same Mini-Block:

- Shots 1–3: recovered images with `Original Storyboard Image prompt unavailable for this image.`; they are locked but show `LOCKED · SAVE CONFIRMATION PENDING`.
- Shots 19–21: later/current persisted artifacts; they correctly show both `SAVED LOCALLY` and `LOCKED · SAVED LOCALLY`.

This demonstrates that:

- the current Save control is present and enabled;
- current artifacts can carry the durable save marker;
- recovered artifacts loaded through the Afterglow path can still lose or fail to regain the current saved-state truth.

A Previs shot in the same live session also shows:

- `Narration / Graphic Novel bubble`
- `Not authored yet.`
- `Create Narration`
- `SIGN IN TO AUTHORIZE NARRATION GENERATION.`

That is additional evidence that the load/hydration boundary may also be disturbing current session/runtime authority instead of only restoring project data.

## Current architecture involved

The current Library path for **Open Example with Your Changes**:

1. identifies the latest saved profile-local Afterglow project;
2. loads that complete Library snapshot;
3. switches it to the active Library project;
4. creates a load-session baseline;
5. scans local assets;
6. runs local-resource recovery;
7. saves the reconstructed project;
8. persists/flushes profile-private state;
9. returns to the active project.

Separately, profile-private hydration:

- reads the encrypted profile project collection;
- clears the browser Library session/cache;
- rebuilds Library state from the hydrated profile copy;
- restores the active project/session handoff where available.

This creates a critical boundary where an older project snapshot or reconstructed artifact can win over newer story-state truth if persistence/recovery order is wrong.

## Important findings already established

- `foundations.visual.store` correctly replaces an artifact with the same ID; the low-level command itself is not silently ignoring updated metadata.
- Library and core project storage use the same canonical active-project session key; this is not simply two different active project IDs.
- Recovered Storyboard resources use stable recovery IDs and reconstruct metadata from prior Library snapshots and local media provenance.
- Recovery only restores `storyboard-local-save:v1` when the prior recovered artifact found in Library already contains that marker.
- If the Library/profile snapshot used as recovery authority is stale, recovery can faithfully reconstruct the old unsaved interpretation.
- The Storyboard UI currently distinguishes saved state solely from the artifact's current `storyboard-local-save:v1` marker.
- #2819 made Save idempotent and left Save available, but did not resolve this load/hydration authority problem.

## Required investigation

Trace the complete state transition with real data:

`current Afterglow → Save recovered frame → Lock/Unlock as needed → persist Library → persist profile-private state → unload → load "Open Example with Your Changes" → hydrate → recover local resources → Storyboard render`

At every boundary record/verify:

- project ID;
- project revision;
- artifact ID;
- asset URL;
- content hash where available;
- frame position;
- review state;
- accepted ID membership;
- `storyboard-local-save:v1`;
- recovery origin project;
- recovery content hash;
- active Library project ID;
- profile-private active project ID.

Determine exactly which boundary first loses the current saved marker or replaces the current artifact metadata with older state.

## Required product invariant

Afterglow loading must follow this rule:

> Current PlotPickle behavior always wins; durable Afterglow story state is loaded as data under the current behavior contract.

**Open Example** means:
- create/open the canonical packaged Afterglow story as a current working project.

**Open Example with Your Changes** means:
- open the latest durable Afterglow project snapshot containing the Human's saved changes;
- attach/reconcile legitimate local resources;
- preserve the newest durable project truth;
- do not revert any current control or runtime behavior.

Neither action may:
- restore an old Save rule;
- restore an old Lock/Unlock rule;
- replace a newer saved marker with an older unsaved reconstruction;
- reset authenticated Human authority merely because a story was loaded;
- substitute packaged defaults for newer durable Human changes;
- allow local-resource recovery to overwrite newer Library truth.

## Required implementation direction

Do not patch the Storyboard label again in isolation.

Establish one deterministic load/hydration merge policy:

1. The current saved Library/project snapshot is authoritative for current project metadata.
2. Local-resource recovery may attach missing local media and provenance.
3. Recovery must not downgrade current durable metadata.
4. For the same artifact/media identity, the newest/current durable story metadata must win over stale source snapshots.
5. A current `storyboard-local-save:v1` marker must never be removed by recovery.
6. Current Lock/Unlock truth must never be downgraded by recovery unless there is explicit newer Human state proving otherwise.
7. The result of recovery must be persisted to both the Library snapshot and profile-private persistence before unload/close completes.
8. On rehydrate, the exact newest saved project must be restored.
9. Story loading must not invalidate an otherwise-current authenticated browser/session authority.

If needed, introduce an explicit deterministic reconciliation function for project-vs-recovery artifact metadata rather than rebuilding artifacts ad hoc.

## Save-specific acceptance sequence

For a recovered Afterglow Storyboard Image:

1. Load **Open Example with Your Changes**.
2. Select a recovered locked Shot currently showing `Save confirmation pending`.
3. Press Save.
4. UI becomes `Locked · Saved locally`.
5. Navigate away and back: remains saved.
6. Unlock: remains `Saved locally`.
7. Save again: successful/idempotent.
8. Re-lock: `Locked · Saved locally`.
9. Unload/close Afterglow.
10. Reload **Open Example with Your Changes**.
11. The same exact artifact remains `Locked · Saved locally`.
12. No duplicate artifact/file is created.
13. Local-resource restore does not downgrade it.

## Narration/session acceptance sequence

Within the same authenticated PlotPickle session:

1. Sign in.
2. Load **Open Example with Your Changes**.
3. Open Previs.
4. Select a valid locked saved Storyboard Image.
5. Choose Create Narration.
6. Profile status must still reflect the current authenticated Human session.
7. A valid current CSRF proof is used.
8. The action must not report `Sign in to authorize narration generation` unless the Human session is genuinely no longer authenticated.
9. If the mutation proof is stale/missing, show the specific session-proof message rather than falsely reporting that the Human is signed out.

## Required regression coverage

Add an end-to-end or state-machine regression that exercises the actual load/hydration sequence rather than matching source strings.

At minimum prove:

- saved recovered Storyboard marker survives unload/reload;
- Lock/Unlock state survives unload/reload;
- idempotent Save still works after reload;
- current metadata wins over stale recovery metadata for the same local asset;
- packaged Afterglow defaults do not overwrite **Your Changes**;
- local-resource recovery can add missing assets without downgrading existing durable artifact truth;
- profile-private persistence contains the latest reconstructed project before unload completes;
- rehydration restores the newest project revision/metadata;
- current Human auth/session authority remains usable after story load;
- narration distinguishes unauthenticated state from stale/missing mutation proof.

## Visibility / diagnostics

Save/load failures must be visible at the affected control surface.

Do not put critical Save failure feedback only inside an unrelated prompt panel.

For this issue, add enough deterministic diagnostic evidence that UAT can identify:
- whether Save changed the artifact;
- whether Library persisted it;
- whether profile-private persisted it;
- whether recovery changed it;
- whether hydration changed it.

Diagnostics may be developer/UAT-only, but the normal Human-facing control must report a clear success/failure state.

## Non-goals

- Do not redesign the Library UI.
- Do not change Afterglow story content.
- Do not regenerate recovered Storyboard images.
- Do not create duplicate local media.
- Do not weaken authentication or CSRF requirements.
- Do not make packaged examples mutable in place.
- Do not change image/provider selection merely to solve persistence.

## Acceptance criteria

Afterglow can be closed/unloaded and later opened with **Open Example with Your Changes**, and all newer durable Human story changes remain intact under the current PlotPickle build's behavior.

A recovered Storyboard image explicitly saved under the current build remains saved after unload/reload/recovery.

Current controls and authorization behavior come exclusively from the current PlotPickle build and cannot be reverted by loading story data.

Related: #2774, #2806, #2817, #2819, PR #2818, PR #2820.

---


## October 7 follow-up — session continuity and first three-second video

### Ultimate user outcome

Produce a playable three-second video for Shot 1 of the selected 25-shot Mini-Block of **Afterglow: Reflections of Sentience**, using the saved and locked Storyboard candidate plus the current screenplay, character, camera, continuity, and shot evidence.

ComfyUI and H3 must both be supported paths. Exercise each configured route independently; one route's verification must not authorize the other. This does not require combining both providers for one clip or generating all 25 shots. Use image-to-video when supported and an evidence-grounded text-to-video packet otherwise. Preserve the intended three-second Timeline duration; if a provider requires longer output, explicitly trim the delivered Timeline clip and record the source duration. Do not claim a clip exists from a successful preflight or submitted job alone.

### New live report and hypotheses

- Shot 1 of 25: the chosen candidate's Save button shows a hand cursor but no apparent click response, success, or error. Lock produces `Locked · Save confirmation pending`.
- Shot 19 of 25: already saved locally and locked, but Create Narration returns `Sign in to authorize narration generation`. This independently demonstrates that unsaved Shot 1 cannot explain every narration failure.
- Library Unload, Examples, Open Example with Your Changes, and Open Story can show a wait followed by a screen jump. The offered copy displayed October 7, 2026, 9:11 a.m. Toronto time. A displayed timestamp is not proof that the same revision remains authoritative after hydration.
- The user suspects navigation through Dashboard, World Map, Outline, Settings / General Setup / Back to Setup / Cloud / Cloud Video may clear authentication or replace current project state.
- The user did not see Previs while navigating; reproduce the path and determine whether this is navigation visibility, gating, or a different cause.

These are reproduction evidence and investigation hypotheses. A wait or jump alone does not prove logout, stale hydration, or older executable behavior. The previously confirmed recovery-precedence defect is not proof that all remaining symptoms share that cause.

### PlotPickle Score identity indicator

Place the identity indicator in **PlotPickle Score** on the Dashboard, alongside the existing story context. Do not put it in the Dashboard Matrix heading or replace the story title.

- Verified authenticated profile: `Logged in: Bryan`, using the actual current profile display name, never a hard-coded name.
- Initial verification or revalidation: `Checking session…`.
- Verified unauthenticated: `Not logged in`.
- Failed verification: `Unable to verify session`, with a useful retry action.
- If the profile is authenticated but local profile storage is locked, describe that separately; unlocking storage and signing in must not be conflated.
- Refresh from the same authoritative server session status used to authorize narration and video mutations, including after navigation, story load/unload, and session changes.
- A project snapshot must never restore the identity label or session credentials. A failed check must not continue showing a stale `Logged in` label as current truth.
- Show no credentials, cookies, or CSRF tokens in the UI or diagnostic logs.

This indicator is observability, not a substitute for repairing session continuity.

### Expanded transition trace

Reproduce:

`sign in → Dashboard Score → Library Unload → Examples → Open Example with Your Changes → Open Story → Dashboard → Storyboard Shot 1 Save/Lock → Shot 19 Create Narration → Previs → Timeline Shot 1 Generate Motion → Play`

Branch from the same known-good state through World Map, Outline, Settings / General Setup / Back to Setup / Cloud / Cloud Video, returning to Dashboard after each. Record the first transition that changes auth, active project, saved marker, lock state, provider selection, or verification.

At every boundary record a correlation ID, current build identifier, project ID/revision, artifact/media identity, persistence completion, hydration/recovery start and end, authenticated profile identity, local unlock status, and authorization result code. Record proof presence/validity only, never secret values. Distinguish pending hydration from completed load. Check for late asynchronous writes, obsolete responses, cache replacement, broad storage clearing, and route effects that may overwrite a newer project or clear session authority.

Trace Save from the actual button event through command execution, active-project update, durable write, and render. No-op early returns must report a reason. Provide immediate saving feedback followed by saved/already-saved or an actionable failure adjacent to the selected Shot. Verify mouse and keyboard activation, including recovered and locked candidates. Preserve Save/Lock independence.

For narration compare authoritative GET /api/auth/profile with the mutation's authorization result. Re-sign-in is appropriate only for genuine expiry/loss of authentication; do not make repeated login the repair for story loading or navigation. Distinguish session rejection, CSRF rejection, local storage lock, provider failure, and loading failure.

### Video delivery and persistence

After repairing upstream state:
1. Save and lock the intended Shot 1 candidate; retain its identity and evidence.
2. Verify the selected ComfyUI video workflow and H3 route separately with current credentials/configuration.
3. Persist and restore provider authority and route-specific verification (including `videoVerifiedAt` where used); invalidate stale verification when the relevant configuration changes.
4. Build a Shot 1 motion packet from current story evidence and the approved visual when supported.
5. Submit generation, display progress, obtain the actual output, validate playable video, and register it against the same Shot/project.
6. Play the delivered three-second clip in Timeline. Keep source frame, narration, and motion distinct and correctly associated.
7. Navigate away/back and unload/reopen Your Changes; retain the same saved/locked frame and playable clip.

Narration authorization must be repaired and tested, but narration need not become an artificial prerequisite for a video route that does not require it.

### Additional phases and completion proof

Continue the existing investigation phases, then add:
- Session continuity and PlotPickle Score indicator across every named navigation path.
- Route-specific ComfyUI/H3 verification, persisted authority, and Shot 1 motion delivery.
- Integrated behavioral regression and live UAT covering the complete user sequence.

Acceptance requires:
- Real Save activation and visible completion for Shot 1, without duplicating media.
- Save/Lock truth survives navigation, unload, hydration, and recovery.
- Shot 19 narration recognizes a valid authenticated session.
- Score identity agrees with server authorization and accurately changes for real logout/expiry or verification failure.
- Named navigation paths preserve valid authentication and current project decisions.
- Previs is reachable under its intended gating, with any actual blocker explained.
- A real playable three-second Shot 1 clip is generated, attached, and restored.
- Both configured ComfyUI and H3 paths have independently recorded live results. An unavailable provider remains an explicit unresolved limitation; mocks or green source checks do not prove live generation.
- No all-25 generation or paid duplicate generation is implied by this brief. Focus provider UAT on the minimum Shot 1 proof.
- Build → behavioral tests → fix → PR → verify checks → merge when green. Record live provider/runtime evidence separately from CI results.

The issue was found closed during this follow-up. Reopen for the remaining live failure and expanded outcome; preserve the historical recovery fix rather than describing it as proof of complete resolution.


## App-wide Save audit requested October 7

The user broadened the investigation: inspect every Save action to determine whether an underlying shared persistence defect exists or surfaces route saves differently. Do not assume Storyboard is isolated or that all saves must use the same backend.

### Required inventory and trace

Inventory all user-facing Save/Save Changes/Save Provider Authority actions and relevant autosave, Save + Lock, and unload/close flush paths. Cover Mind Map, World Map, Outline, Storyboard, narration/Previs, Timeline/media, Library/project snapshots, Settings/profile/cloud provider configuration, and OpenPencil design save integration where implemented.

For each implemented action record:
- surface and exact control label;
- click/keyboard handler and any guards or early returns;
- payload and owning identity (project, profile, artifact, provider, or design);
- command/API and persistence adapter;
- destination and expected durability (session, browser, local file, encrypted profile, remote);
- authorization, local unlock, and CSRF requirements;
- pending/success/failure UI;
- whether completion is awaited and errors propagated;
- reload/hydration/recovery source and conflict/revision rules;
- behavior during navigation, unload, and restart.

Include implicit save paths where they can overwrite explicitly saved state. Distinguish deliberate differences in ownership from accidental divergence.

### Shared Save contract

Every Save control must respond visibly, write the intended data to its declared durable destination, and report success only after the required persistence acknowledgement. Saving only component state or queuing a write is not durable completion. Repeated saves should be safe where applicable. No silent no-op guards, swallowed failures, stale identity writes, or misleading Saved labels.

Preserve pending/failed edits when persistence fails and provide a retry or actionable reason. Verify the saved value through the actual reload path. Logout/unload must respect pending writes and must not conflate project unload with account logout.

### Audit execution and deliverables

1. Produce an evidence-backed routing inventory with code locations.
2. Group paths by actual shared adapters/authority boundaries.
3. Reproduce one meaningful state transition per persistence family, including recovered Storyboard media and encrypted profile-backed project saves.
4. Investigate races, broad storage clearing, unawaited writes, stale snapshots, cross-project/profile writes, and inconsistent authorization only where evidence supports them.
5. Repair shared causes in the owning layer; repair surface-specific handlers separately when necessary. Avoid an unproven app-wide storage rewrite.
6. Add behavioral coverage for meaningful save-and-reload transitions and failure feedback, rather than source-string checks.
7. Record checked surfaces, actual defects, intentional route differences, fixes, and unresolved runtime limitations.

This audit is a prerequisite to declaring the persistence problem resolved. Retain the existing final goal: a saved/locked Shot 1 produces a playable three-second Timeline video through the configured ComfyUI/H3 routes, and survives reload. An audit report alone does not satisfy that outcome.


## Phase 1 initial code observations

Repository inspection confirms foundation-project-browser.ts aliases its save/load operations to project-library-browser.ts, establishing at least one shared Save route. profile-private-browser.ts uses a queued encrypted write path and clears all sessionStorage during hydration; its callers and effects require investigation. GET /api/auth/profile catches all inner authorization/readiness failures and can report authenticated=false without exposing the actual cause. These are investigation targets, not confirmed causes of Bryan's live failures. Local git transport in this execution environment currently lacks authentication; API repository inspection remains available. No local build or runtime reproduction has been performed yet.
