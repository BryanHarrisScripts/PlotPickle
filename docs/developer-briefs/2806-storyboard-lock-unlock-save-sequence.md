# #2806 Storyboard Lock / Unlock and Save sequence

## Developer Brief

### Objective

Make the Storyboard Lock control reversible.

For each of the 25 Storyboard Shots, the Human may browse up to the existing candidate set and should be able to:

- Lock the currently displayed candidate.
- Press the same control again to Unlock that candidate.
- Leave the Shot with no locked candidate.
- Browse to another candidate and Lock it.
- Maintain at most one locked candidate per Shot.

This is a Storyboard review-authority UX correction. It does not introduce new review state.

### Current behavior

The current Storyboard position card exposes:

Save | Lock | Redo | Delete

When the currently displayed artifact is already accepted/locked, the Lock button becomes disabled.

Current review logic already contains the necessary authority:

- locking one candidate calls `foundations.visual.accept`;
- before accepting it, existing code iterates other accepted artifacts for the same frameNumber and calls `foundations.visual.unaccept`;
- therefore PlotPickle already supports replacing one locked candidate with another without allowing two locked images for the same Shot.

What is missing is a Human-facing way to call `foundations.visual.unaccept` on the currently locked candidate itself.

### Product decision

The Lock control becomes a true toggle:

```text
Unlocked candidate
→ press Lock
→ candidate becomes the one locked Storyboard Image for that Shot

Locked candidate
→ press Unlock
→ candidate becomes unlocked
→ Shot may now have zero locked images
```

If another candidate is later locked:

```text
candidate A locked
→ browse candidate B
→ press Lock on B
→ A is unaccepted
→ B becomes locked
```

At no point may two candidates for the same Shot be locked simultaneously.

### Existing authority to preserve

Reuse:

- `foundations.visual.accept`;
- `foundations.visual.unaccept`;
- `acceptedVisualArtifactIds`;
- existing per-Shot candidate browsing/chevrons;
- #2483 candidate navigation/provenance behavior;
- #2772 accepted-candidate persistence/reload behavior;
- existing Save, Redo and Delete semantics;
- Storyboard-to-Previs locked-frame authority.

Do not create a new lock-state field or second approval store.

### Required implementation

#### Phase 1 — Lock/Unlock toggle

Update the Storyboard review control for the currently displayed generated artifact:

- if not accepted: button label is `Lock`;
- if accepted: button label is `Unlock`;
- do not disable the button merely because the artifact is already accepted;
- pressing Unlock dispatches `foundations.visual.unaccept` for that artifact;
- persist the updated project using the same canonical save path used by current Storyboard review actions;
- keep the displayed candidate selected after unlocking.

The review state/label should update immediately from Locked to the correct saved/review state.

#### Phase 2 — replacement semantics

When a different candidate for the same Shot is locked:

- preserve the existing behavior that unaccepts any previously accepted candidate for that frameNumber;
- accept the newly selected candidate;
- preserve all candidate versions;
- do not delete the previously locked image;
- do not silently change which candidate is being viewed except as required by the existing explicit Human selection.

#### Phase 3 — zero-lock state

A Shot is allowed to have no locked candidate.

After Unlock:

- Storyboard should show no Locked badge for that Shot;
- Previs and other consumers that require a locked Storyboard image must truthfully see that there is no accepted image for the position;
- do not auto-select or auto-lock a replacement;
- reloading the project must preserve the zero-lock state.

#### Phase 4 — persistence and regression coverage

Add focused tests proving:

1. unlocked candidate → Lock → accepted;
2. locked candidate → Unlock → unaccepted;
3. Unlock does not delete the candidate;
4. a Shot may have zero accepted images;
5. locking candidate B after candidate A results in B accepted and A unaccepted;
6. no Shot can have two accepted Storyboard candidates at once;
7. chevron browsing does not itself change lock state;
8. Save/Redo/Delete continue to retain current behavior;
9. reload restores whichever candidate is locked, or restores no lock when the Human deliberately unlocked the Shot;
10. Previs/locked-frame projection reflects the updated acceptance truth.

### UX wording

Preferred control behavior:

- `Lock` when the displayed candidate is not locked;
- `Unlock` when the displayed candidate is locked.

Do not add a second Unlock button.

The existing Locked badge remains useful and should disappear immediately after Unlock.

### Scope boundaries

In scope:

- reversible Storyboard lock state;
- one-lock-per-Shot enforcement;
- intentional zero-lock state;
- persistence/reload;
- regression coverage.

Out of scope:

- changing Save behavior;
- changing Redo generation;
- changing Delete confirmation;
- changing candidate-count limits;
- changing WebP routing (#2805);
- changing Previs design;
- automatically choosing a replacement candidate after Unlock.

### Acceptance criteria

- [ ] Lock becomes Unlock when the displayed candidate is currently accepted.
- [ ] Pressing Unlock calls the existing unaccept authority and persists it.
- [ ] A deliberately unlocked Shot may have zero locked candidates.
- [ ] Unlocking does not delete or reject the image.
- [ ] The Human can browse another candidate and Lock it.
- [ ] Locking a new candidate automatically unaccepts the previously locked candidate for the same Shot.
- [ ] At most one candidate per Shot can be locked.
- [ ] Candidate browsing alone never changes lock authority.
- [ ] Locked badge/state updates immediately.
- [ ] Reload preserves the exact locked-or-unlocked state.
- [ ] Previs/other locked-frame consumers receive the same updated acceptance truth.
- [ ] Existing Save, Redo and Delete controls remain intact.
- [ ] Focused tests and required exact-head verification are green before merge.

### Definition of done

For any Storyboard Shot, the Human can move among candidate images, Lock one, Unlock it back to no locked image, or Lock a different candidate, with PlotPickle preserving every candidate while maintaining exactly zero or one accepted Storyboard image for that Shot.

### Delivery rule

Build → focused test → fix → PR → required exact-head verification → fix until green → merge when green.

### Human workflow clarification — Save and Lock are independent

Live UAT clarified the intended recovery path for a candidate that was locked before the Human completed the explicit local Save step.

The Human must be able to perform:

```text
Locked · Save confirmation pending
→ Unlock
→ Save
→ Lock
```

Required semantics:

- Unlock removes only acceptance/locked authority.
- Unlock must not delete the candidate or remove an existing local-save marker.
- Save is allowed while the candidate is unlocked.
- Save writes/retains the existing `storyboard-local-save:v1` marker and does not implicitly Lock the candidate.
- Lock remains a separate Human approval action.
- After Save succeeds while unlocked, the UI should show the saved state without a Locked badge.
- Re-locking the same candidate should produce `Locked · Saved locally`.
- A candidate that is currently `Locked · Save confirmation pending` must be recoverable through the explicit Unlock → Save → Lock sequence.
- Do not require Delete/Redo or a new generated candidate merely to correct the order in which Save and Lock were pressed.

This preserves the existing authority distinction:
- Save = persist this candidate locally with the story for review.
- Lock = accept this candidate as the authoritative Storyboard image for the Shot.

Add focused regression coverage for this exact state transition.
