# Developer Brief — #2618 BUZZ Desktop 0.5.26

## Goal

Promote PlotPickle's reviewed BUZZ Desktop Windows fallback from 0.5.25 to the current stable upstream Desktop release, 0.5.26, without changing BUZZ authority boundaries or the separate managed relay lane.

## Verified upstream release

- Release tag: `desktop-v0.5.26`
- Published: 2026-09-29
- Source/tag commit: `2b4b138dc5cf2d9cc1a0ceb21d9063ff56fe8bf4`
- Windows asset: `Buzz_0.5.26_x64-setup_alpha-unsigned.exe`
- Published SHA-256: `df0b5412a786678f0dc76d8949c40569b3707ff10340b186b254388dac08f101`

## Reviewed upstream changes

The 0.5.26 release includes NIP-AR channel artifacts, long-thread query/deadline improvements, sidebar state convergence, native HPKE sealing support for nsec backup envelopes, and a relay administration console.

This promotion records those capabilities as upstream facts only. It does not make BUZZ artifacts PPF canon, does not transfer PlotPickle workflow authority to BUZZ, and does not activate new admin/backup behavior inside PlotPickle.

## Boundaries

This is a BUZZ Desktop companion promotion only.

Do not change:
- the BUZZ managed relay pin;
- the 0.5.3 installed-sidecar compatibility floor in `build/buzz-desktop-discovery.ts`;
- PlotPickle orchestration, canon, story-decision, PPF, or release authority;
- Community identity or signing boundaries;
- installer elevation/silent-install behavior.

The existing installer may continue to resolve a newer compatible official Desktop release at maintenance time, but it must never downgrade below the reviewed fallback and must verify the official release digest when published.

## Implementation

- update `config/buzz-desktop.json` to 0.5.26;
- update the current startup/updater regression contract;
- update current BUZZ health/runtime documentation;
- add issue-scoped development convergence evidence;
- preserve package-smoke and installer integrity contracts.

## Verification

Run the focused BUZZ updater regression and development convergence check, then normal exact-head CI. Repair failures without weakening the contract. Stop after the PR is green; merge is not authorized by this issue request.
