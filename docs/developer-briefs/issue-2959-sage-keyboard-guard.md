# #2959 — Global Sage malformed keyboard event guard

## Human truth / observed discrepancy
Observed in authenticated October 12–13 Windows inspection, at Logon and
during automated navigation: Global Sage overlay onKeyDown accessed
`event.key.toLowerCase()` when `key` was undefined, creating an unhandled
application error. The source is `app/global-sage-overlay.tsx`.
Automation-origin event input is suspected, **not** a proven physical keyboard
reproduction or a failed login.

Approved intended outcome: malformed or unsupported input is ignored safely;
normal Shift+S shortcut and blocking/focus semantics remain unchanged.
Governing white paper: `docs/white-papers/AI_Programming_Evolution_White_Paper.md`
(WHITE-PAPER-V3, W8/W9 independent truth and honest evidence).

## PP-SAGE-KEY-001 v1 — bounded mathematical contract

Let E be an arbitrary (including null/malformed) keyboard-like event. Define:
- `ValidKey(E) := typeof E.key = string ∧ lower(E.key) = "s"`
- `AllowedMods(E) := E.shiftKey = true ∧ ¬E.ctrlKey ∧ ¬E.metaKey ∧ ¬E.altKey`
- `Eligible(E) := E exists ∧ ¬E.defaultPrevented ∧ ¬E.repeat ∧
  ValidKey(E) ∧ AllowedMods(E)`
- `Open(E) := Eligible(E) ∧ ¬TextEditingTarget(E.target) ∧
  ¬BlockingOverlay ∧ VisiblePlotPickleSurface`

Obligations:
1. For all E with missing, null or non-string `key`, `Eligible(E) = false`
   and the shortcut decision must return normally (no exception). No dialog
   mutation, `preventDefault` or event consumption follows.
2. A non-S key or invalid modifier does not open Sage.
3. A standard Shift+S keypress continues to open Sage only where all existing
   editor, modal and surface gates allow it.
4. The dialog still closes with Escape, traps Tab appropriately, restores
   origin focus and unregisters listeners on teardown.
5. The patch must not change session authentication, global routing,
   screenplay content or project persistence.

## Independent evidence and known limits
- Executable Node fixture assertions cover absent keys, every primitive and
  multiple object/array types, unsupported keys, all modifier combinations,
  defaultPrevented and repeat, and normal upper/lowercase Shift+S.
- Static source-wiring assertions ensure the actual listener invokes the
  independently tested predicate *before* the editing/overlay checks and
  retains existing Escape/Tab/focus behavior.
- The existing sole seven-layer GitHub PR workflow and installed production
  build gate provide compilation and regression evidence at exact head SHA.
- A green simulated keyboard suite and build **do not** prove the originally
  observed Windows automation event has recurred and been resolved in the
  authenticated live human environment. Keep live Windows acceptance UNPROVEN
  until such a direct observation is made in #2943.

## Scope and sequence
Single owned change in Global Sage shortcut dispatch, one pure helper and
its declaration, one negative-control regression suite, and white-paper
catalogue/evidence binding plus focused build in the existing CI workflow.
No unrelated login/session repair (#2960).
