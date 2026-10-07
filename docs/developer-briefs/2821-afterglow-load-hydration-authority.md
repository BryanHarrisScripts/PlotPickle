# #2821 — Afterglow load/hydration authority and durable current-state restoration

## Summary

Live UAT after #2819 proves that the remaining defect is not an isolated Save-button problem.

The failure occurs at the boundary between:

1. the current PlotPickle runtime and control semantics;
2. the saved Afterglow Library snapshot;
3. profile-private encrypted persistence/hydration;
4. local-resource recovery.

The Human workflow is straightforward:

1. Start PlotPickle.
2. Sign in.
3. Open Library.
4. Choose **Open Example with Your Changes**.
5. Continue from the latest saved Afterglow state.

That action must mean:

> Load the latest durable Afterglow story data into the current PlotPickle runtime.

It must never mean:

> Restore an older interpretation of PlotPickle behavior from the story snapshot.

## The architectural distinction that explains how we got here

The Human strongly identified the likely historical cause of this defect: PlotPickle was changed so that a user's Afterglow changes could be saved locally and later reopened without losing the images, locks, saves, writing, or other work.

That goal is correct.

The mistake is allowing that persisted story snapshot to become too authoritative when it is reopened.

The saved Afterglow copy must be understood as:

> A snapshot of where the user left the story.

It must not be understood as:

> A snapshot of PlotPickle itself at the time the story was saved.

Therefore, reopening a saved Afterglow state may restore the user's story state — including images, selected versions, saved markers, locks, writing, Mind Map, World Map, Storyboard, Previs/production data, and other legitimate project data — but it must never restore historical implementations of Save, Lock/Unlock, narration authorization, UI controls, storage methods, provider routing, or other product behavior.

Once the persisted story state is loaded, every control and method operates according to the current PlotPickle build.

A concise invariant for implementation and regression coverage is:

> Saved Afterglow = where the Human left the story. Current PlotPickle = how that story works now.

Older snapshots may require deterministic data migration/normalization into the current schema. Migration may preserve or translate durable Human decisions, but it must never emulate old application behavior.

## Human intent captured in UAT

The Human clarified that **Open Example** and **Open Example with Your Changes** are story-loading choices only.

They must not change, downgrade, or overwrite:

- Save behavior;
- Lock / Unlock behavior;
- current control availability;
- current current-state interpretation;
- narration authorization semantics;
- runtime/provider routing;
- current implementation rules.

The loaded story supplies story data. The current PlotPickle build supplies product behavior.

## Evidence from live screenshots

The live session after #2819 showed two state classes in the same Storyboard Mini-Block.

### Recovered images

Shots 1–3:

- show multiple recovered candidates;
- are visibly locked;
- report `LOCKED · SAVE CONFIRMATION PENDING`;
- display `Original Storyboard Image prompt unavailable for this image.`;
- have an enabled Save button.

These are characteristic of recovered Storyboard resources.

### Current persisted images

Shots 19–21:

- show `SAVED LOCALLY`;
- show `LOCKED`;
- report `LOCKED · SAVED LOCALLY`;
- retain full current Storyboard prompt provenance.

These demonstrate that the current Save marker and current UI semantics work for artifacts that already exist as current durable project records.

### Previs narration symptom

The same live session also showed:

- `Narration / Graphic Novel bubble`;
- `Not authored yet.`;
- `Create Narration`;
- `SIGN IN TO AUTHORIZE NARRATION GENERATION.`

The Human was already operating in PlotPickle, so this must be investigated as a possible second symptom of load/hydration/session authority drift.

## Current known architecture

### Foundation project facade

`core/storage/foundation-project-browser.ts` aliases:

- `loadFoundationProject` → `loadActiveLibraryProject`;
- `saveFoundationProject` → `saveActiveLibraryProject`;
- `FOUNDATION_PROJECT_SAVED_EVENT` → `PROJECT_LIBRARY_CHANGED_EVENT`.

This means Storyboard, Previs, Timeline, and related surfaces are already intended to share the Library project as the canonical project store.

### Active-project identity

Library and the foundation-project facade use the same session active-project key:

`plotpickle.project-library.session-project:<profile>`

Therefore the defect is not explained by two separate active-project IDs.

### Afterglow “Open Example with Your Changes”

Current flow:

1. find latest profile-local Afterglow example;
2. load its Library snapshot;
3. switch it active;
4. mark the same project current for this session;
5. create/persist a load-session baseline;
6. scan `/api/local-ai/assets`;
7. inventory recoverable media;
8. reconcile selected resources;
9. save the reconstructed active Library project;
10. persist/flush profile-private state;
11. return to Dashboard/current story.

### Profile-private hydration

Current hydration:

1. establish current CSRF/profile authority;
2. fetch encrypted profile-private project collection;
3. optionally migrate/merge legacy session Library state;
4. consume explicit active-project handoff;
5. clear Library project session caches;
6. clear `sessionStorage`;
7. re-establish active profile identity;
8. hydrate the Library from profile-private snapshots;
9. resume explicit session-active project when valid.

This makes profile-private persistence an important authority boundary: a stale profile snapshot can later become the browser Library truth.

### Recovered Storyboard resources

Recovery uses stable local-media provenance:

- local asset URL;
- origin project ID encoded in filename;
- content hash;
- Block/Mini-Block/position;
- stable recovery artifact ID.

When restoring an image, recovery looks for a prior matching Storyboard artifact in saved Library projects. It copies current metadata only when it can find it.

Critically:

`storyboard-local-save:v1`

is preserved only if the prior artifact found in Library already contains the marker.

Therefore:

> If the durable Library/profile snapshot available to recovery is stale, recovery can correctly reconstruct the wrong old state.

That is consistent with the observed Shots 1–3.

## Root cause confirmed during implementation

The recovery code contained a concrete precedence defect.

When a local Storyboard resource already had a corresponding artifact in the currently loaded Afterglow working copy, recovery still searched historical Library snapshots and used that historical `priorArtifact` / `priorApproval` to refresh the existing current artifact.

Historical source ordering also preferred the local file's original project ID ahead of newer recovered working copies.

That meant an older origin snapshot could become authoritative over the current working copy. In practice it could:

- rebuild current decision keys from stale historical keys;
- remove `storyboard-local-save:v1` from the current artifact;
- overwrite stronger current prompt/narrative metadata with older recovery metadata;
- restore an old Lock even after the current working copy had been explicitly unlocked;
- allow an old deletion/approval record to win merely because it belonged to the original project.

This precisely violates the intended distinction:

> Saved Afterglow is where the Human left the story; current PlotPickle determines how that state behaves now.

The implementation therefore changes recovery precedence so that:

1. an artifact already present in the active working copy is authoritative;
2. recovery may add missing provenance to that current artifact but cannot downgrade its Save, Lock/Unlock, prompt, rejection, or other current metadata;
3. historical snapshots are consulted only when the active working copy has no corresponding artifact;
4. historical matching snapshots are ordered newest-first, with original-project identity only as a tie-breaker;
5. the newest matching snapshot determines both positive and negative lock/deletion evidence instead of searching farther back for an older affirmative state.

## Findings already ruled out

### Not a disabled-Save problem

#2819 removed `savedLocally` from the Save-button disable condition.

Live UAT confirms Save is enabled.

### Not a low-level store replacement problem

`foundations.visual.store` removes an existing artifact with the same ID and inserts the supplied updated artifact.

It does not silently preserve the old metadata.

### Not simply two active-project keys

Library and the foundation facade use the same current-session project key.

## Core invariant

### Runtime authority

Current PlotPickle code owns all product behavior.

No project snapshot may restore an old implementation contract.

### Story authority

The latest durable project state owns the Human's story choices.

This includes, when applicable:

- accepted/locked visual identity;
- explicit local-save markers;
- artifact provenance;
- writing;
- structure;
- Mind Map;
- World Map;
- project production/previs state.

### Media recovery authority

Local media recovery may:

- reattach missing local files;
- recreate a missing project artifact from proven local provenance;
- restore proven metadata from a durable project snapshot.

It must not:

- downgrade newer durable project metadata;
- replace a saved artifact with an unsaved reconstruction;
- replace a current lock state with an older state;
- replace current prompt/provenance with weaker recovery placeholders when stronger current data exists.

## Deterministic reconciliation rule

For a local Storyboard resource representing the same media identity:

1. Current active Library artifact is first authority.
2. Latest durable saved project metadata for that exact resource is second authority.
3. Recovery-generated metadata is fallback only.
4. Packaged defaults are never allowed to overwrite **Your Changes**.
5. The union of non-conflicting provenance keys may be preserved.
6. Current durable Human decisions must not be removed by an older source.

At minimum, monotonic Human-state keys include:

- `storyboard-local-save:v1`;
- explicit current acceptance/lock state;
- explicit deletion/rejection state where newer;
- current non-placeholder prompt/provenance where present.

A dedicated reconciliation function should be preferred over scattered conditionals if that makes the precedence auditable.

## Required Save behavior

For any valid local Storyboard artifact, including recovered artifacts:

- Save is always a valid idempotent action;
- the first Save adds/persists the local-save marker;
- subsequent Saves on the exact same artifact return successful Already Saved/Saved state;
- no duplicate artifact is created;
- no duplicate local file is created;
- Save never implicitly changes Lock/Unlock state.

After a successful Save, the active Library snapshot must immediately contain the marker.

If the Human profile is authenticated and profile-private persistence is available, the latest project state must also become durable there before a close/unload operation is declared complete.

## Required load behavior

### Open Example

This means:

- start from the canonical packaged Afterglow content;
- create/open it under the current PlotPickle runtime;
- do not inherit prior **Your Changes** unless explicitly selected.

### Open Example with Your Changes

This means:

- select the latest durable profile-local Afterglow project;
- preserve its newest Human story state;
- optionally reconcile local assets;
- never downgrade that state during recovery;
- run all UI and control logic from current code.

The operation is not a “restore old app session” feature.

## Unload / close behavior

Before Afterglow is considered safely unloaded:

1. current Library snapshot must be current;
2. pending profile-private project writes must be queued;
3. writes must flush successfully;
4. only then may active-story session state be cleared;
5. the next hydration/load must be able to recover the exact current revision and relevant artifact truth.

A failed encrypted-profile write must be surfaced as a blocking persistence failure rather than silently allowing unload to proceed as though durable state were safe.

## Required narration/session investigation

The narration screenshot must be included in this issue because it occurred after loading Afterglow in the same authenticated PlotPickle session.

Trace:

- GET `/api/auth/profile`;
- returned `authenticated`;
- returned `csrfToken`;
- POST `/api/previs/narration`;
- authorization result/code.

The correct messages are:

- genuinely unauthenticated → Sign in;
- authenticated but missing/expired mutation proof → explicit session-proof/refresh message;
- authorized but provider/model failure → provider/model-specific error.

Loading a story must not itself invalidate a valid Human session.

Do not weaken authentication or CSRF protections to fix this.

## Visibility requirement

Critical persistence failures must be visible where the Human acted.

For Storyboard Save:

- successful first save → visibly Saved;
- successful repeated save → visibly Already saved/Saved;
- failed save → visible failure beside/within the Shot review area.

Do not hide Save failures only in the image-generation prompt panel.

For load/recovery UAT, expose enough developer evidence to identify which stage changed the artifact.

## Required diagnostic trace for UAT

For the selected test artifact, capture at each boundary:

- project ID;
- project revision;
- artifact ID;
- asset URL;
- frame position;
- content hash when available;
- source decision keys;
- local-save marker presence;
- review state;
- accepted ID membership;
- recovery origin project;
- active Library project ID;
- profile-private active project ID.

Checkpoints:

1. before Save;
2. immediately after Save;
3. after Lock/Unlock;
4. after active Library save;
5. after profile-private save/flush;
6. after unload;
7. after profile hydration;
8. after **Open Example with Your Changes**;
9. after local-resource recovery;
10. final Storyboard render.

The first checkpoint where truth changes unexpectedly is the actual defect boundary.

## Implementation phases

### Phase 1 — Reproduce and instrument authority transitions

- Add focused UAT/state tracing for one recovered Afterglow Storyboard frame.
- Prove exactly where `storyboard-local-save:v1` is first lost.
- Prove whether accepted/lock truth changes at the same boundary.
- Capture profile-private revision/state before and after unload/reload.
- Capture narration auth status after story load.

No speculative persistence rewrite before this trace identifies the boundary.

### Phase 2 — Make recovery monotonic

Implement deterministic Storyboard recovery reconciliation.

For the same local resource:

- current Library metadata must win;
- newer durable saved metadata must win over fallback recovery metadata;
- Save marker cannot be removed by recovery;
- explicit newer Lock/Unlock/deletion truth cannot be downgraded;
- placeholder prompt cannot replace a stronger known prompt.

Add direct unit/state-machine coverage.

### Phase 3 — Make unload/reload durability explicit

Verify/fix the order:

`save active Library → persist profile-private collection/index → flush → unload`

Then verify rehydration reconstructs the exact newest project.

Add an unload/reload behavioral regression.

### Phase 4 — Narration authority after load

Exercise the current authenticated Human session across:

`sign in → load Afterglow → open Previs → Create Narration`

Fix only the actual auth/session handoff defect found.

Keep CSRF and authenticated-mutation requirements intact.

### Phase 5 — Integrated UAT

Run the Human sequence:

1. Sign in.
2. Open **Afterglow with Your Changes**.
3. Save recovered Shot 1.
4. Confirm `Locked · Saved locally`.
5. Unlock.
6. Save again.
7. Lock.
8. Navigate away/back.
9. Unload Afterglow.
10. Re-open **with Your Changes**.
11. Confirm same artifact is still `Locked · Saved locally`.
12. Confirm no duplicate artifact/local media.
13. Open Previs.
14. Confirm locked saved frame is accepted downstream.
15. Create Narration.
16. Confirm authenticated session is correctly recognized.

## Required regression coverage

Coverage must execute state transitions, not only source regex checks.

Minimum proof:

- recovered artifact first Save persists marker;
- repeated Save is idempotent;
- recovery cannot remove existing save marker;
- recovery cannot downgrade current accepted state;
- recovery preserves stronger prompt/provenance;
- unload persists latest project before clearing active session;
- reload/hydration restores the same latest artifact metadata;
- **Open Example** and **Open Example with Your Changes** have distinct intended story-source semantics;
- packaged defaults cannot overwrite Your Changes;
- authenticated session remains usable after project load;
- narration distinguishes auth loss from CSRF proof failure.

## Files likely involved

Primary investigation:

- `modules/library/ui/library-workspace.tsx`
- `modules/library/local-resource-recovery.ts`
- `core/storage/project-library-browser.ts`
- `core/storage/profile-private-browser.ts`
- `app/_components/storyboard/storyboard-readiness-workspace.tsx`
- `app/_components/previs/previs-readiness-workspace.tsx`
- `app/api/previs/narration/route.ts`

Potential test areas:

- #2774 Afterglow durable restore tests;
- #2806 Storyboard Lock/Unlock tests;
- #2817 UAT persistence/auth/routing tests;
- #2819 idempotent Save tests;
- new #2821 state-machine/load-hydration coverage.

## Non-goals

- no Library visual redesign;
- no Afterglow story rewrite;
- no regeneration of existing recovered images;
- no duplicate media creation;
- no weakening of authentication;
- no weakening of CSRF;
- no change to cloud-provider selection solely to work around persistence;
- no return to source-text-only tests as proof of this behavior.

## Acceptance criteria

The issue is complete only when:

- a recovered Afterglow Storyboard image can be explicitly saved;
- it remains saved through Lock/Unlock;
- it remains saved through navigation;
- it remains saved through unload/close;
- it remains saved after **Open Example with Your Changes**;
- recovery does not downgrade it;
- no duplicate artifact or local media is created;
- current PlotPickle control behavior is unchanged by project loading;
- current authenticated Human authority remains valid across story loading;
- Previs narration reports authentication state accurately;
- behavioral regression coverage proves the entire round trip.

## Delivery sequence

Developer brief → reproduce/instrument → build → focused tests → fix → regression tests → PR → exact-head verification → fix until green → merge when green.

Related: #2774, #2806, #2817, #2819, PR #2818, PR #2820.
