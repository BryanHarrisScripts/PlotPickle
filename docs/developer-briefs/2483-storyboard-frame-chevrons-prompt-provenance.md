# Developer Brief — #2483 Storyboard frame chevrons and prompt provenance

## Developer brief

### Goal

Simplify Storyboard frame browsing inside each of the 25 Shot / Frame positions.

The current position card uses a **Frame pull-down selector** below the image. Replace that selector with direct **left/right chevron navigation on the image**, and use the space below the image to show the **specific Storyboard prompt associated with the currently displayed image**.

This issue is limited to the Storyboard position-card experience shown in the Human screenshot.

## Human-requested changes

### 1. Remove the Frame pull-down

Current behavior:
- each Storyboard position renders a `<select>`;
- the list can contain repeated labels such as:
  - `Recovered local Storyboard frame · position 01`;
  - historical/reference frame labels;
  - generated candidate labels;
- the Human has to open the list to move between images.

Required behavior:
- remove the visible Frame pull-down from the position card;
- do not expose repeated recovered-frame filenames/labels as the primary browsing UI;
- preserve the existing selected-image state internally.

### 2. Add image chevrons

When more than one valid image exists for a Storyboard position:

- show a left chevron on/adjacent to the left side of the displayed image;
- show a right chevron on/adjacent to the right side of the displayed image;
- left selects the previous image candidate for that position;
- right selects the next image candidate for that position;
- navigation must be deterministic;
- only candidates valid for the current Storyboard position may be traversed;
- changing the viewed candidate must not itself Keep/Lock, Reject, regenerate, or otherwise change canon/review authority.

When only one image is available:
- chevrons should be disabled or omitted.

When no image exists:
- preserve the existing empty-position/Create Frame Prompt behavior.

Keyboard accessibility must remain available. The chevrons must be actual accessible buttons with clear labels such as:
- `Previous frame for Storyboard position 01`;
- `Next frame for Storyboard position 01`.

Do not intercept the existing global Storyboard/Act/Block keyboard-navigation contract.

## 3. Show the exact Storyboard prompt for the displayed image

The text below the image should describe **the prompt that actually produced that displayed image**, not merely a recovery filename or generic position label.

For a generated Storyboard artifact:
- use the artifact's persisted `prompt` field;
- the displayed prompt must change immediately when the Human moves to another image with the chevrons;
- do not reconstruct a new prompt from current story state if the original persisted prompt exists.

This is provenance display: the Human should be able to see, “This is the prompt that was used for this image.”

### Recovered/local images

Recovered Storyboard assets may not always contain the historical generation prompt.

If the exact original prompt is available in persisted/recovered provenance:
- display it.

If the exact original prompt is **not** available:
- do not fabricate or regenerate one;
- show a concise state such as:
  `Original Storyboard prompt unavailable for this recovered image.`

Do not display `Recovered local Storyboard frame · position 01` as though it were the image-generation prompt.

## Current implementation evidence

The current Storyboard surface is:
- `app/_components/storyboard/storyboard-readiness-workspace.tsx`.

Current behavior builds `availablePositionImages` from:
- `project.build.foundations.visualArtifacts`;
- linked visual-story frames;
- Storyboard reference candidates.

For generated `FoundationsVisualArtifact` records, the source artifact contains:
- `assetUrl`;
- `prompt`;
- `frameNumber`;
- `narrativeIntention`;
- `reviewState`;
- provenance keys.

However, the current `availablePositionImages` projection only carries:
- `id`;
- `assetUrl`;
- `label`.

That projection must preserve the prompt/provenance information needed by the selected-image presentation.

The current position card renders:
- selected image;
- Keep / Lock;
- Redo;
- Reject;
- a `Frame` `<select>`.

The `<select>` is the control to remove/replace.

## Selection semantics

The new chevron navigation must preserve the current per-position selection key:

`block.mini.position`

For example:
`1.1.1` for Block 1 / Mini-Block 1 / Position 1.

Selection remains presentation state until an existing governed action changes review state.

### Locked frame behavior

If the currently displayed artifact is already Keep/Locked:
- the Locked state remains visible;
- browsing another candidate does not silently unlock or replace it;
- the existing Keep/Lock authority remains unchanged;
- returning to the locked candidate must still identify it as Locked.

### Reject behavior

Reject keeps its existing authority.

After rejecting a generated candidate:
- it must no longer be traversable as an active candidate for the position;
- selection should resolve safely to another available image or the empty state.

### Redo behavior

Redo keeps its existing behavior:
- it prepares/regenerates for the current position;
- a newly generated candidate becomes available to the position browser under the existing Storyboard generation rules;
- no generated candidate becomes canon automatically.

## Candidate ordering

Use one deterministic ordering for chevron traversal.

Prefer existing Storyboard provenance/order:
1. current selected candidate when opening the position;
2. remaining valid generated/recovered/reference candidates in stable existing order.

Do not reorder unpredictably on re-render.

If implementation chooses created-time ordering for generated revisions, document and test it explicitly.

## Prompt presentation

Prompt text should be readable without reopening a modal or provider screen.

Preferred treatment:
- compact `Storyboard Prompt` label;
- wrapped prompt text directly below the image/review controls;
- enough vertical space to read the full prompt;
- if the full prompt is unusually long, allow a contained expand/collapse treatment rather than truncating provenance permanently.

Do not show provider/model plumbing unless already part of the established Storyboard surface.

## No change to Storyboard authority

This issue does **not** change:

- the 25-position Shot / Frame capacity model;
- authored Beat mapping;
- Scene/Beat/Shot semantics;
- Keep / Lock authority;
- Reject authority;
- Redo/generation authority;
- recovered Storyboard approval restoration;
- Storyboard-to-Previs handoff;
- story canon;
- accepted visual artifact IDs;
- Library recovery rules.

This is a navigation/provenance UX change only.

## Acceptance criteria

- [ ] The Frame pull-down is removed from Storyboard position cards.
- [ ] Previous/next chevrons browse valid images for the current position.
- [ ] Chevrons never browse a generated Storyboard artifact belonging to another position.
- [ ] Chevron buttons are accessible and keyboard operable.
- [ ] One/no-image states are handled cleanly.
- [ ] Changing the viewed image does not alter Keep/Lock/Reject state.
- [ ] Locked candidates remain visibly locked when revisited.
- [ ] Rejected candidates no longer appear in active traversal.
- [ ] Redo adds/replaces candidates under the existing governed generation path.
- [ ] The currently displayed generated image shows its exact persisted Storyboard `prompt`.
- [ ] Moving with chevrons updates the displayed prompt with the selected image.
- [ ] A recovered image displays its exact original prompt when that provenance exists.
- [ ] If a recovered image has no original prompt provenance, the UI clearly says it is unavailable and does not invent one.
- [ ] Generic labels such as `Recovered local Storyboard frame · position 01` are not presented as generation prompts.
- [ ] Existing #2466/#2473 Storyboard Keep/Lock recovery semantics remain unchanged.
- [ ] Existing Storyboard frame review controls remain functional.
- [ ] Focused regression coverage is added for browsing, prompt provenance and review-state preservation.
- [ ] Relevant Experience and Story/Canon verification remain green on the exact PR head.

## Human reference

Requested from the annotated Storyboard screenshot supplied on 2026-09-26:
- green annotations place navigation chevrons directly on the left/right sides of the Storyboard image;
- red annotation removes the Frame pull-down;
- Human note: use the specific Storyboard prompt used for the image.


## Implementation clarifications after double-check

### Position-scoped candidate set

The current Storyboard surface builds a broad `availablePositionImages` collection for the selected Mini-Block and only filters generated artifacts by `frameNumber` when rendering the existing pull-down.

The chevron implementation must not reuse that broad collection without narrowing it.

For each Storyboard position, derive a **position-scoped candidate list** before calculating previous/next navigation:

- generated/recovered `storyboard-frame-webp-v2` artifacts must have `artifact.frameNumber === position`;
- linked Shot/Frame evidence must belong to that same Shot/position;
- Mini-Block references may remain available only under the existing reference rules and must not cause a generated artifact from another position to appear;
- deduplicate by asset identity without losing the selected candidate's provenance.

The selected-image fallback remains compatible with current behavior:
- current explicit per-position selection when still valid;
- otherwise the latest non-rejected generated artifact for that position;
- otherwise the existing linked Shot Frame/reference fallback;
- otherwise empty.

### Chevron boundary behavior

For more than one candidate:
- show both Previous and Next controls;
- do **not** silently wrap from first to last or last to first;
- disable Previous at the first candidate;
- disable Next at the last candidate.

This makes candidate order visible and deterministic.

### Exact-prompt provenance rule

`FoundationsVisualArtifact.prompt` is structurally required, but not every value is an exact generation prompt.

Current Library recovery writes this placeholder when original prompt metadata is unavailable:

`Recovered local Storyboard resource. Original prompt metadata was unavailable in the loaded project.`

Storyboard must treat that value—and equivalent explicitly unavailable recovery provenance—as **missing original prompt**, not as the prompt that generated the image.

For #2483:
- generated Storyboard artifacts display their persisted exact `prompt`;
- recovered artifacts display an exact prompt only when the selected artifact actually carries exact prompt provenance;
- current recovered placeholders render the unavailable state;
- do not search unrelated Library snapshots, infer from current story state, or backfill a guessed prompt in this issue;
- do not change #2466/#2473 recovery approval authority.

A later recovery enhancement may preserve additional exact prompt provenance, but #2483 must work correctly without requiring such a migration.

### Presentation ordering

Within each position card, preserve this visual order:

1. Position / Shot identity;
2. image with Previous / Next chevrons;
3. existing Keep/Lock, Redo and Reject strip;
4. `Storyboard Prompt` provenance text;
5. existing empty-state/Create Frame Prompt control when applicable.

The removed `Frame` pull-down must not leave an empty labeled control behind.

### Verification ownership

Add one focused #2483 regression test and register it with the existing verification catalog owner(s) that already cover Storyboard frame review/Experience Contract behavior. The focused test must prove:

- no Storyboard Frame `<select>` remains in the 25-position loop;
- candidates are position-scoped;
- previous/next controls update only per-position presentation state;
- navigation preserves review authority;
- exact generated prompt is displayed;
- recovery placeholder is classified as unavailable;
- rejected artifacts remain excluded;
- existing Keep/Lock, Redo and Reject controls remain present.

Do not weaken or rewrite #2420, #2428, #2466 or #2473 tests to make #2483 pass; only update an older structural assertion if its sole purpose was to require the pull-down that the Human has now explicitly removed.

