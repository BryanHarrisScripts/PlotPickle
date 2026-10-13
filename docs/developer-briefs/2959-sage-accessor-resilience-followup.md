# #2959 follow-up — Global Sage malformed automation input, executable handler proof

## Pre-existing engineering truth
The original October 12–13 Windows automation-suspected `event.key.toLowerCase()` crash was already corrected through merged PR #2965 (main `1704b8d51752db86fd4d276b8a4e89e4a3181ecd`). In main, the global listener delegates to a pure key-type guard before DOM/focus and before consuming the event. A simple missing `key` is already safe. Do not reopen that fixed change as if it were new work.

## Remaining bound
PP-SAGE-KEY-001 treats input as arbitrary, including synthetic objects. A truth gap remained for an event with a throwing accessor or Proxy trap: the predicate could itself throw while reading `defaultPrevented`, `repeat`, `key`, or modifiers. Source-pattern wiring also did not exercise the actual `onKeyDown` listener with malformed events. This follow-up adds fail-closed accessor handling and a controlled runnable listener test.

## Human outcome and invariants
- For any absent/malformed/throwing key-related event, the predicate returns false; the actual listener neither touches DOM gating nor consumes the event nor opens Sage.
- Normal Shift+S retains editing-target, blocking-modal and visible-Matrix requirements, `preventDefault`, `stopPropagation`, focus restoration ownership, existing Escape/Tab behavior and de-registration.
- No changes to Human account auth, Matrix route, story data, screenplay evidence, providers, generated media or credentials.
- No relaxation of existing PP-SAGE-KEY-001 normal shortcut semantics.

## Executable checks
Append direct tests to `tests/issue-2959-sage-shortcut-guard.test.mjs` that force throwing accessors on each authority field and a hostile Proxy, then evaluate the real global listener extracted from the TSX source inside controlled VM browser/Dom gates. Positive and negative outcomes are independent from the same source-pattern test. Run seven-layer architecture checks, focused suite and installed build at the exact PR head.

## Scope and limits
This is simulated event/DOM execution, **not** a witnessed return to the original authenticated Windows session or a reproduced original automation event. The observed generic Logon/Unload authentication error belongs to #2960/#2943, not Sage. The live device/UAT observation remains independently open in #2943. The new code proves malformed accessor resilience beyond the originally observed missing-key crash, not a claim of finished real-world UAT.
