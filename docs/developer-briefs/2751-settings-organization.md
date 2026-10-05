## Draft developer brief — Settings organization and system mathematics

Status: developer brief updated with the Human's mathematics text. This pass records requirements only; implementation has not started.

## Human observations and requested changes

In Settings → General, operational tools occupy space that should be used for general information. Move the two existing sections to Settings → Operations and present the remaining General content in a single column.

Confirmed changes:
1. Move General's “UAT Semantic Review” section to Operations and rename its visible heading “Semantic UAT”. Reuse the current UAT panel and preserve its runner, in-page status/evidence, Human review and current authentication/project persistence behavior.
2. Move General's “Project Data and Recovery” section to Operations and rename its visible heading “Data Recovery”. “Backup” was considered and then superseded by the Human's final name “Data Recovery”. Reuse the existing actions and preserve their recovery/backup safeguards.
3. Remove both sections from General after relocation; each has one canonical Settings location.
4. Arrange General's remaining cards in one column, with consistent alignment and spacing using current design tokens.
5. Add a General card explaining the mathematics of how the whole PlotPickle system is structured. Use the Human-supplied mathematics below, retaining the order Act → Block → Mini-Block → Sequence → Shot → complete movie and the bracketed equations.

## Source review

Current source locates the UAT heading in app/skin-v1/uat-guide-panel.tsx and the recovery heading in app/skin-v1/settings-review-system-panel.tsx. Confirm their current Settings composition and Operations destination before implementation; relocate existing capabilities rather than duplicating them.

## Acceptance

- General has neither operational section and uses a single-column card layout.
- Operations exposes Semantic UAT and Data Recovery with their existing working controls.
- UAT still starts and updates in-page, retaining evidence, local mode and deterministic PASS/FAIL.
- Recovery controls retain existing project/profile scope, confirmation and persistence behavior.
- The General mathematics card reproduces the supplied content accurately; verify each total, unit and relationship against current system contracts and flag discrepancies before changing product constants.
- Responsive layout, keyboard access and existing Settings navigation remain usable.
- Update nearest focused Settings/UAT/recovery regressions, resolve the verification route, and run required focused UAT/build and exact-head checks once implementation is authorized.

## General mathematics card — supplied content

Suggested heading: System Mathematics.

1 Act
= 6 Blocks [3 Sequences × 2 Blocks = 6 Blocks]
= 24 Mini-Blocks [6 Blocks × 4 Mini-Blocks = 24 Mini-Blocks]
= 3 Sequences [6 Blocks ÷ 2 Blocks per Sequence = 3 Sequences]
= 600 Shots (3 seconds per Shot) [24 Mini-Blocks × 25 Shots = 600 Shots]
= 30 minutes [600 Shots × 3 seconds = 1,800 seconds ÷ 60 = 30 minutes]
= 43,200 final video frames [1,800 seconds × 24 frames per second = 43,200 frames]

1 Block
= 4 Mini-Blocks [1 Block × 4 Mini-Blocks = 4 Mini-Blocks]
= 100 Shots (3 seconds per Shot) [4 Mini-Blocks × 25 Shots = 100 Shots]
= 5 minutes [100 Shots × 3 seconds = 300 seconds ÷ 60 = 5 minutes]
= 7,200 final video frames [300 seconds × 24 frames per second = 7,200 frames]

1 Mini-Block
= 25 Shots (3 seconds per Shot) [1 Mini-Block × 25 Shots = 25 Shots]
= 75 seconds [25 Shots × 3 seconds = 75 seconds]
= 1,800 final video frames [75 seconds × 24 frames per second = 1,800 frames]

1 Sequence
= 2 Blocks [1 Sequence × 2 Blocks = 2 Blocks]
= 8 Mini-Blocks [2 Blocks × 4 Mini-Blocks = 8 Mini-Blocks]
= 200 Shots (3 seconds per Shot) [8 Mini-Blocks × 25 Shots = 200 Shots]
= 10 minutes [200 Shots × 3 seconds = 600 seconds ÷ 60 = 10 minutes]
= 14,400 final video frames [600 seconds × 24 frames per second = 14,400 frames]

1 Shot
= approximately 3 seconds [1 Shot × 3 seconds = 3 seconds]
= 72 final video frames at 24 fps [3 seconds × 24 frames per second = 72 frames]

Then the complete movie:
4 Acts
= 24 Blocks [4 Acts × 6 Blocks = 24 Blocks]
= 96 Mini-Blocks [24 Blocks × 4 Mini-Blocks = 96 Mini-Blocks]
= 12 Sequences [4 Acts × 3 Sequences = 12 Sequences]
= 2,400 Shots (3 seconds per Shot) [96 Mini-Blocks × 25 Shots = 2,400 Shots]
= 2 hours [4 Acts × 30 minutes = 120 minutes ÷ 60 = 2 hours]
= 120 minutes [4 Acts × 30 minutes = 120 minutes]
= 7,200 seconds [120 minutes × 60 seconds = 7,200 seconds]
= 1 Shot = 72 frames [24 frames per second × 3 seconds = 72 frames]
= 172,800 final video frames [72 frames × 2,400 Shots = 172,800 frames]
= 2,400 storyboard Shots become 172,800 actual video frames in a two-hour movie [2,400 Shots × 3 seconds × 24 frames per second = 172,800 frames]
= 172,800 final video frames at 24 fps [7,200 seconds × 24 frames per second = 172,800 frames]

## Arithmetic verification and presentation

All supplied totals reconcile at 25 shots per Mini-Block, a target of 3 seconds per shot, and 24 final video frames per second. The full target is 4 Acts × 6 Blocks × 4 Mini-Blocks × 25 Shots = 2,400 storyboard Shots; 2,400 × 3 seconds = 7,200 seconds = 120 minutes; 7,200 × 24 fps = 172,800 final video frames.

The card must distinguish storyboard Shots from final rendered video frames. It describes the planning mathematics and target duration/frame rate, not evidence that video frames have already been generated. Because individual shot duration is described as approximately three seconds, label resulting timing/frame totals as based on a three-second target; actual output changes if duration or export frame rate changes. This explanatory card does not silently alter renderer/export settings or story contracts.

Keep all six sections within one General card, with readable line wrapping and bracketed calculations. Preserve the supplied complete-movie summary even where it reiterates the same total. Continue to retain the Semantic UAT/Data Recovery relocation and single-column General layout in this same implementation scope.

## Implementation and verification

General now contains preferences, Source reference and System Mathematics in one aligned column. Semantic UAT and Data Recovery have independent Operations destinations, U/D shortcuts, registered visual surfaces and Back/Escape return paths. Source-only General does not fetch local recovery storage. Recovery APIs, refresh behavior, UAT execution and explicit restore confirmation are retained.

Focused UAT: 482 passing contracts. Dedicated regression checks cover panel ownership, canonical navigation and independently computed frame totals. Production compilation and exact-head PR/Product gates remain required before merge.

Local broad-test limitations: unchanged baseline has stale issue-2061/2215 assertions, issue-2159 continuity metadata drift, an invalid issue-2226 regex, and TypeScript errors in unrelated story/project consumers. These are not represented as passing. The Linux vinext build compiles application bundles but its final Node inspection cannot resolve the Cloudflare worker scheme; the independent Windows build gate is required.

Browser observation scope: actual Settings composition and panels in an isolated browser harness; unrelated host panels stubbed and storage/UAT GET services synthetic. This proves rendering and navigation, not real UAT authentication/execution or recovery mutations.

