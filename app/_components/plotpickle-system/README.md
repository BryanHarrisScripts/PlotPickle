# PlotPickle visual system

This directory is the single adoption and locking authority for PlotPickle's bronze, patina, stone, moss, jade and rune interface language.

`system.css` maps semantic product roles onto the central tokens. It must not use global component selectors or `!important`. Screens consume these roles through their owned CSS modules.

`screen-registry.json` separates visual maturity from product authority. Discoverable means a writer can reach and understand an area. Canon-editable means the implemented workflow may write through the existing PPF and approval boundaries. One must never imply the other.

Screens advance through experimental, adopting, approved and locked. A locked screen has a versioned visual hierarchy, responsive behavior, accessibility evidence and deterministic CI coverage. Locking does not freeze copy, data or product behavior.

The current `app/design-tokens.css` and `app/approved-visual-system.css` are a compatibility bridge for unmigrated screens. Issue #1736 owns the bridge. Remove it only after every active registered screen is locked here and no runtime selector depends on the legacy palette.

Status colors remain truthful system signals. Luminous rune green may identify navigation and actions, but labels such as ready, connected, nominal or complete require real runtime state.
