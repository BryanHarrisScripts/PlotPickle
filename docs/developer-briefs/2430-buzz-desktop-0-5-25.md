# Developer Brief — #2430 BUZZ Desktop 0.5.25

## Goal

Promote PlotPickle's reviewed BUZZ Desktop Windows fallback from 0.5.22 to the current stable upstream Desktop release, 0.5.25, without changing BUZZ authority boundaries or the separate managed relay lane.

## Verified upstream release

- Release tag: `desktop-v0.5.25`
- Published: 2026-09-24
- Source commit: `c8f73213089cbd5a0f1e675d3193558280d46e10`
- Windows asset: `Buzz_0.5.25_x64-setup_alpha-unsigned.exe`
- Published SHA-256: `fff84c9048acbb0592d873f6cc8c8cd9816c43a753042407bfa47b452c2bda43`

## Boundaries

This is a BUZZ Desktop companion promotion only.

Do not change:
- the BUZZ managed relay pin;
- the 0.5.3 installed-sidecar compatibility floor in `build/buzz-desktop-discovery.ts`;
- PlotPickle orchestration, canon, story-decision, or release authority;
- Community identity or signing boundaries;
- installer elevation/silent-install behavior.

The existing installer may continue to resolve a newer compatible official Desktop release at maintenance time, but it must never downgrade below the reviewed fallback and must verify the official release digest.

## Implementation

- update `config/buzz-desktop.json` to 0.5.25;
- update the current startup/updater regression contract;
- update current BUZZ health/runtime documentation;
- preserve package-smoke and installer integrity contracts;
- leave issue #2410 open for its remaining Mastra/Pi scope.

## Verification

Run the focused BUZZ updater tests plus normal exact-head CI. Merge only when green.
