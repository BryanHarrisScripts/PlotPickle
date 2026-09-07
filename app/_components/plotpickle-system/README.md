# PlotPickle visual system

This directory is the single adoption and locking authority for PlotPickle's bronze, patina, stone, moss, jade and rune interface language.

`system.css` maps semantic product roles onto the central tokens. It must not use global component selectors or `!important`. Screens consume these roles through their owned CSS modules.

`screen-registry.json` separates visual maturity from product authority. Discoverable means a writer can reach and understand an area. Canon-editable means the implemented workflow may write through the existing PPF and approval boundaries. One must never imply the other.

Screens advance through experimental, adopting, approved and locked. A locked screen has a versioned visual hierarchy, responsive behavior, accessibility evidence and deterministic CI coverage. Locking does not freeze copy, data or product behavior.

## Experience V2 workflow states

Issue #1742 is the authoritative Experience V2 journey, state and data-flow contract. The exact workflow-state names are recorded in `screen-registry.json` and exported by `contract.mjs`:

- `locked`: a real prerequisite is missing; the destination explains why and how it unlocks.
- `available`: the user may enter, but meaningful work has not started.
- `incomplete`: work has started and partial canonical data must survive leaving and reopening.
- `ready`: required evidence is present for review; ready is not accepted.
- `accepted`: the user explicitly accepted the work as current canon; downstream areas may unlock.

These workflow states are distinct from screen maturity. A screen may be visually `approved` while a project item displayed on that screen is `incomplete`, for example.

State color is supportive only. `system.css` provides `--pp-state-*` visual roles, but state meaning must also be represented through text/semantics and canonical project data. AI or agent output remains a proposal until explicit user acceptance.

The current `app/design-tokens.css` and `app/approved-visual-system.css` are a compatibility bridge for unmigrated screens. Issue #1736 owns the bridge. Remove it only after every active registered screen is locked here and no runtime selector depends on the legacy palette.

Status colors remain truthful system signals. Luminous rune green may identify navigation and actions, but labels such as ready, connected, nominal or complete require real runtime state.
