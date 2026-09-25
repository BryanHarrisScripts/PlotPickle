# Developer Brief — Sound Dashboard Lane + Selectable Unavailable Rows

Issue: #2446

## Dashboard taxonomy

Insert a new top-level **SOUND** group after VISUALIZE and before PITCH.

SOUND contains exactly:
1. Narration
2. Music
3. Foley

Use unique shortcuts:
- Narration: 6
- Music: 7
- Foley: 8

These rows are intentionally unavailable destinations in this phase. They do not open a surface.

## Lifecycle vs selection

Dashboard has two independent visual/state concepts:

- Selected row: green Matrix selection bar/background follows the current row.
- Surface lifecycle: right-side square communicates locked/in-review/unavailable.

Package, Deck, Narration, Music and Foley are unavailable destinations:
- row remains selectable/focusable
- row can become aria-selected=true
- row selection updates the footer/current item
- right-side square remains gray
- no destination opens
- Dashboard stays visible

Do not model an unavailable destination as a non-interactive Dashboard control. The unavailable lifecycle state belongs to the destination, not to the row-selection mechanism.

## Implementation direction

Use one unavailable destination set in the Dashboard registry.

Panel activation must not discard unavailable rows before selection reaches the parent Dashboard state.

Host activation must:
1. receive the unavailable row
2. update Dashboard selection through the existing onActivate callback
3. remain on Dashboard
4. stop before opening any surface

Do not add fake routes or placeholder surfaces.

## Deferred Sound product direction

Do not implement these menus now, but preserve the product direction:

Narration can later develop narration / voice-over / performance controls.

Music can later include opening/beginning music, middle music, ending music, ambient music, score and cues.

Foley can later include ambient tones, room tone, crowds, wind, ocean and other environmental/physical effects.

## Verification

Focused tests must prove:
- seven-group Dashboard order with SOUND between VISUALIZE and PITCH
- exact SOUND order Narration → Music → Foley
- shortcuts 6/7/8 remain unique
- all three SOUND rows are unavailable and not connected/review/locked
- Package/Deck remain unavailable
- unavailable row activation calls Dashboard selection before returning
- unavailable selection does not open a surface
- unavailable row status square stays gray/inactive
- selected row styling remains driven only by selectedIndex
- no Sound surface/route is introduced

Then run exact-head Architecture Verification, inspect only failed jobs, fix until green, merge and stop.
