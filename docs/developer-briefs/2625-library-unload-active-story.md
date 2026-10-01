# Developer Brief — #2625 Library active-story unload

## Human intent

Make Library → Load clearly show which story is active and let the Human return to PlotPickle's canonical Blank workspace without logging out or deleting the story.

## Product contract

The active Load card displays a compact `Currently loaded` badge and an `Unload` action. Unload is a story-session lifecycle action, not a profile/auth action.

The transition is:

`Blank → Load story → Currently loaded → Unload → Blank`

## Persistence sequence

1. Persist and flush the current active project while its session selection is still intact.
2. Clear the current-session active-project marker through the canonical Project Library browser boundary.
3. Persist and flush the Library again so the encrypted profile index records `activeProjectId: null`.
4. Navigate to `/?workspace=dashboard` without staging the #2621 explicit-project handoff.
5. If the second persistence phase fails, restore the prior session selection and remain in Library with an actionable error.

## Active-card rules

- Saved Human story: exact current-session project id match.
- Afterglow gateway: current-session summary is `sourceKind: "example"` and its source id is either the clean defaults id or the profile-local Afterglow id.
- Only one card may be presented as currently loaded.

## Preservation

Unload must not delete, archive, mutate or replace the project; remove packaged media; remove profile-local Afterglow changes; log out/lock/switch the Human profile; or create a new durable Untitled Story.

## UX

- Compact `Currently loaded` status rectangle.
- Secondary `Unload` button on the active card.
- Open/resume behavior remains available for non-active cards.
- Unload is disabled while the save/detach transition is running.

## Verification

Regression coverage must prove save-before-detach ordering, durable `activeProjectId: null`, no #2621 handoff during unload, active-card identity for Afterglow and Human stories, Blank-at-launch preservation, explicit Open Example preservation, and exact-head Architecture Verification green.
