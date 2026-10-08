# PP-SAVE-001 — Storyboard Save, Lock and Recovery Truth

**Status:** APPROVED — Human accepted PP-SAVE-001 after confirming Save-before-Lock ordering, 2026-10-08
**Contract version:** 1.0.0
**Stable truth ID:** PP-SAVE-001
**Date proposed:** 2026-10-08
**Owning domain:** Storyboard visual versions and approval, with Library/profile storage and Previs handoff boundaries
**GitHub issue:** #2845
**Related work:** #2819, #2821, #2830, #2832, #2847 (independent baseline); [white paper](../white-papers/AI_Programming_Evolution_White_Paper.md); [machine-readable Casebook definition](./PP-SAVE-001.casebook.json)
**Source of requirement:** Human conversations reporting Save confirmation pending, unreliable Lock/reload, and downstream Previs rejecting saved images. Specific proposed interpretations are labelled below rather than retroactively attributed to the Human.

## 1. Approved Human promise

> When I save a Storyboard image, PlotPickle must preserve that exact image. When I lock it, my approval must also be preserved. I must be able to close PlotPickle, restart it, reopen the same story, and find the same image and approval exactly as I left them. Nothing else should change. PlotPickle must never tell me something is saved unless it can substantiate that claim.

**Confirmed Human Rule 3 (2026-10-08):** Saving must finish successfully before the selected image can be Locked. Lock is unavailable while that same selected version is Unsaved, Pending, Unknown, or Rejected. Once its durable Save is confirmed, Lock becomes available; it then requires its own confirmed approval commit. This ordering is a Human decision, not an engineering inference.

The Human accepted the complete first-pilot promise on 2026-10-08 after correcting Save-before-Lock. This approval governs the supported scope below; the engineering system chooses code, storage protocols, formal notation and verification mechanisms. Future substantive changes require explicit Human approval.

### Approved initial recovery scope

1. Same authenticated Human profile on the same Windows device, through a normal PlotPickle stop/start and Library **Open Example with Your Changes** (or the corresponding saved-story reopen operation).
2. The required media and supported persistent storage remain present and accessible; account/profile recovery conditions hold.
3. Applies to local-generated and packaged Afterglow media once participating in the same Storyboard Save/Lock workflow.
4. No cross-device synchronization or recovery after storage/device loss is guaranteed by PP-SAVE-001 v1; those require separately accepted truths.
5. When a Save or Lock is **pending or unknown**, PlotPickle must preserve current work, visibly report uncertainty, prevent unsafe in-app Unload/Logout/profile switch that would discard the unreconciled operation, and provide a retry/reconciliation path. Rejecting the operation must preserve unsaved work. An external forced process termination cannot be prevented; the supported recovery procedure must distinguish confirmed committed state from unconfirmed state after restart.
6. The engineering system must define and verify a finite pending-to-unknown presentation timeout and reconciliation mechanism compatible with actual storage/auth constraints. The Human approved the outcome (no indefinite misleading Saved state or lost edits), not an arbitrary numeric timeout.

These decisions are approved for the initial same-device, same-profile pilot; changes to the user-visible outcome need another Human decision.

## 2. Objects, authority and observable meanings

- **Identity:** `profileId`, `projectId`, `miniBlockId`, `shotId`, `artifactId`, `artifactVersion`, media digest/identity, and revision/operation ID.
- **Save** is durable persistence of the *selected exact artifact version* with recoverable media and authoritative metadata within the accepted scope. A browser marker, queued request, cached state, or successful API invocation alone is not a durable outcome.
- **Lock** is an explicit Human approval of an exact artifact version and its approval metadata, **permitted only after that exact selected version is durably Saved**. It is not an alternate Save operation and never implicitly saves an unsaved artifact. Saved is a prerequisite for Locked, but Saved alone does not imply Locked. A durable Lock acknowledgement is needed before presenting Lock as persisted approval. The displayed Lock action must be disabled/unavailable with an understandable reason until the prerequisite is proven.
- **Current editor content** and **last successfully saved version** are different when further edits occur while a write is pending.
- **Downstream Previs** may treat an artifact as an available approved Storyboard image only when the same artifact identity has the required saved-media and approved-state evidence.
- **Existing authoritative owners** retain responsibility: current runtime controls behaviour; canonical project and media store own the saved project/artifact; authenticated encrypted profile vault owns account-scoped durability; no new global registry or storage engine is created.
- **Recovery evidence** requires an independent read and visible UI comparison after ending the original process; implementation self-reports are not sufficient.

## 3. Contract state machine

Save-operation states: `READY` -> `PENDING` -> `COMMITTED` / `REJECTED` / `UNKNOWN`. `UNKNOWN` can reconcile to `COMMITTED` or `REJECTED` using original operation identity, without assuming failure on timeout. A retry cannot silently create a second write for the same logical operation.

Approval states: `UNLOCKED` / `LOCK_PENDING` / `LOCKED` / `UNLOCK_PENDING` / `APPROVAL_UNKNOWN`. Entry into `LOCK_PENDING` is allowed only from a **confirmed `COMMITTED` Save for the exact selected artifact/version/digest**; the canonical Save prerequisite is rechecked when applying the Lock, so a changed selection, stale acknowledgement or racing edit cannot bypass the guard. Confirmed Lock and Unlock changes are durable and scoped to the selected artifact version. Save and approval remain separate operations: Unlock cannot erase durable media, and Save does not imply Lock. The global valid-state invariant is `LOCKED => SAVED` for the same artifact/version.

UI may distinguish `Saved version N; newer edits pending` from `Current version saved`. A legacy `savedLocally` marker is intent/history and cannot alone prove the backing store acknowledged the current version.

## 4. Required mathematically constrained obligations

Variables: `p` profile, `q` project, `s` shot, `a` artifact, `v` artifact version, `h` immutable content digest, `op` operation ID; `State` is the relevant canonical state.

**T1 — truthful success (safety):**
`DisplaySaved(p,q,s,a,v,h) => ConfirmedDurableCommit(p,q,s,a,v,h)`.
A successful status must identify the exact version that was durably committed; late acknowledgement of an older version cannot mark a newer edit saved.

**T2 — confirmed Save prerequisite and durable approval (safety; Human-confirmed ordering):**
`AllowedLock(p,q,s,a,v,h) => ConfirmedDurableCommit(p,q,s,a,v,h)`.
`DisplayLocked(p,q,s,a,v,h) => ConfirmedDurableCommit(p,q,s,a,v,h) AND ConfirmedDurableApproval(p,q,s,a,v)`.
Lock must be unavailable for an unsaved, pending, rejected or unknown Save of that exact selected image. The guard must be revalidated on transition, not inferred from a stale UI flag. A pending/unknown approval cannot appear as a confirmed persisted approval. Saved does not imply Locked.

**T3 — independence/non-interference (invariant):**
For any permitted Save/Lock/Unlock action on `(p,q,s,a)`, durable media and approval for every unrelated identity are unchanged, unless independently authorized by that identity's own action.
`Unlock(a) => SavedIdentityAfter(a) = SavedIdentityBefore(a)` where no separate authorized edit occurred.

**T4 — idempotence (invariant):**
Repeating Save with the same `(op, identity, version, digest)` has the same durable effect, with no extra artifact/resource. Reusing `op` with different content is rejected. The duplicate-recognition record must remain consistent with the durable write through interruption.

**T5 — authorized revision (invariant):**
A Save based on an obsolete accepted revision cannot silently overwrite a newer accepted version. Conflicts are reported and the person's unsaved work is preserved.

**T6 — recovery (progress plus independent observation):**
Following confirmed Save and Lock within the supported recovery assumptions, normal stop/start and reopening `(p,q,s)` returns the same `(a,v,h)` plus approved Lock state. A returned "Saved" indicator matches that independently recovered state.

**T7 — downstream identity (safety):**
`PrevisApproved(a,v) => SavedMedia(a,v) AND DurableApprovedLock(a,v)`. Previs cannot substitute another image or accept approval belonging to a different candidate.

**T8 — meaningful progress / truthful uncertainty:**
Under defined available-storage/auth conditions, a submitted Save eventually reaches an observable confirmed or rejected outcome, within a finite product response policy. Interruption/uncertainty produces `UNKNOWN` with reconciliation, not a false `COMMITTED`, a permanent misleading spinner or lost edits. Unsafe in-app Unload/Logout/profile switch is blocked until pending work is resolved or a separately accepted recoverable exit policy exists; work remains available. The engineering system selects and tests the concrete timeout without silently weakening this user-visible promise.

Technical formalization can use a finite-state transition model or property tests on top of existing tools. Approval establishes the requirements, not proof that any currently deployed implementation satisfies them.

## 5. Approved acceptance scenarios

| Case | User-visible promise | Independent check |
| --- | --- | --- |
| A. First Save | Correct selected image reports Saved only on durable acknowledgement | Read committed media and metadata; compare identity and digest |
| A2. Lock before first confirmed Save | Lock is unavailable for unsaved, pending, failed or unknown Saves, with a clear reason; no approval is committed | Attempt Lock through actual interface and domain boundary at each invalid state; ensure approval unchanged |
| B. Save twice | Still Saved, no second artifact and no unrelated write | Count artifact IDs, backing writes and touched projects |
| C. Save → Lock → Unlock → Save → Lock | Same saved image; final saved + approved Lock | Verify transitions, media bytes/identity and final approval |
| D. Exit, restart, restore Afterglow | Same exact selected image and Lock reappear | Stop process; re-authenticate/unlock; reopen and independently compare |
| E. Save interrupted / ack lost | Show pending or unknown, protect edit and reconcile original operation | Inject lost response after commit; read back and retry with same ID |
| F. Invalid/unauthorized Save | No Saved claim; no cross-profile mutation | Inject auth failure and attempt alternate-profile read/write |
| G. New edit during previous Save | Earlier Save cannot claim new edit was saved | Delay old acknowledgement, compare current and committed versions |
| H. Wrong candidate / stale revision | Never silently substitute or overwrite accepted work | Introduce conflicting revision / candidate and observe rejection |
| I. Previs handoff | Only the exact saved and locked artifact is consumed | Compare recovered Storyboard identity and Previs consumer input |
| J. Unload/Logout with pending work | Preserve unsaved work, disclose pending/unknown state and block unsafe in-app leave or profile switch | Inject delayed/failed write; attempt Unload/Logout/profile switch; observe blocked transition, accessible work and reconciliation |

## 6. Baseline and verification separation

**Baseline known from repository history, not newly reproduced here:** #2821 remains open pending live Windows and provider/user acceptance; #2832 eliminated previously demonstrated duplicated Library writes; prior fixes include Save/Lock durability and rendered fixture proof. These reports cannot establish the current user's normal-launcher recovery without observation.

1. **Contract/model:** check consistency and permitted/prohibited transitions, including stale responses, retries and races.
2. **Real-boundary engineering proof:** rendered Storyboard clicks, authenticated HTTP boundary, encrypted storage and actual recovered media/version; use existing #2821/#2832 test owners where practical, with fault injection and an independently controlled expected artifact.
3. **Process-boundary proof:** terminate the owning app/process and reopen the same saved project; read recovered media and approval independently of the original Save handler.
4. **Human Windows acceptance:** same actual workflow with Afterglow and visible Storyboard/Previs evidence; do not replace this with synthetic success.
5. Record `contractVersion`, git SHA, environment, profile scope (non-sensitive), shot/artifact identities or safe digests, observations and limits.
6. Report **PASS** only for the evidenced scope; **FAIL** if contradicted; **BLOCKED** if necessary conditions prevent checking; **UNPROVEN** when required evidence was not collected. Existing Casebook uses a corresponding `uncertain` result: map it accurately, do not relabel missing evidence as PASS.

## 7. What adoption must NOT do

- Do not write or refactor application code until a truthful independent baseline against existing implementation has been recorded. The Human accepted the meaning on 2026-10-08.
- Do not create an alternative DSDD/Casebook harness, a second project-state authority, another optimistic Save indicator, or a compatibility bridge by default.
- Do not weaken prior Save/Lock protections or reclassify existing defects as approved behaviour.
- Do not alter provider routing, generate paid image/video, migrate story data, or treat docs-only checks as verified user functionality.
- Do not merge a change that silently changes any approved PP-SAVE-001 rule. Human approval is required for changes in meaning.

## 8. Pilot measurement and completion

Capture a baseline and comparison for: user workflow completed, false Saved/Locked claims, image/approval loss after restart, repeat repairs, escaped regressions, diagnosis time, write amplification, and number of times Human intent must be restated. Measure verification maintenance cost, too. No invented baseline or performance target may substitute for recorded observations.

**Acceptance for the pilot:** approved contract v1.0.0 + model consistency + independent end-to-end evidence + retained exact recovered user outcome, with stated support conditions and no contradiction of protected identities. The contract is approved but implementation conformance remains **UNPROVEN** until those observations; acceptance of meaning is not a green product result.

## 9. Human decisions / approval record

**Status:** APPROVED — 2026-10-08, v1.0.0. Approval follows explicit Human correction of the Save-before-Lock ordering and later statement “approved - whats next”.

| Decision | Accepted meaning |
| --- | --- |
| Human promise | Exactly saved selected media and its separately confirmed Lock survive normal same-profile/device restart and story reopening; no false success or unrelated mutation. |
| Recovery scope | Same authenticated Human/profile and same device, supported persistent media available; no promise of cross-device or device-loss recovery in v1. |
| Pending/unknown leave policy | Preserve work, report uncertainty, prevent unsafe in-app Unload/Logout/profile switch until reconciliation; routine timeouts/retry mechanism belong to engineering design. |
| Save-before-Lock | Lock is impossible until durable Save of the exact selected artifact/version succeeds. A Save in READY, PENDING, REJECTED or UNKNOWN does not permit Lock. |
| Previs handoff | Previs consumes only the exact durably Saved and durably Locked candidate. |

| Record | Value |
| --- | --- |
| Original Human statement | Preserved in conversation and referenced in #2845 |
| Approved version | 1.0.0 |
| Approval date | 2026-10-08 |
| Approval route | User corrected Rule 3, then explicitly replied “approved - whats next” to the proposed first pilot |
| Contract acceptance | Confirmed |
| Model consistency baseline | Not yet executed |
| Independent implementation verification | UNPROVEN — no PP-SAVE-001-specific baseline run has yet occurred |
| Live Windows Human recovery acceptance | Not yet observed |
| Current delivery | Approved normative contract plus proposed Casebook verification definition; implementation work follows independent baseline |

## 10. Evolution and evidence rule

Future model sessions, PRs, migrations and repairs must receive this approved contract version rather than freshly interpreting earlier text. Behavioural changes require an explicitly reviewed successor contract; technical fixes preserving the approved outcome need no repeat approval. Each verification record must identify the contract version, exact code revision, environment, observed artefact identities and PASS/FAIL/BLOCKED/UNPROVEN results by scope.
