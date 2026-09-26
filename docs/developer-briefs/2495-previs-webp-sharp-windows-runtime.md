# Developer Brief — #2495 Previs Animated WebP Sharp Windows Runtime Repair

## Human-observed failure

On Windows, Previs → Graphic Novel → Export Animated WebP displayed a BUILD ERROR overlay:

`Cannot read properties of undefined (reading 'endsWith')`

## Root cause

#2491 introduced a server-side Sharp encoder, but Sharp remained only a transitive/override dependency. PlotPickle's reusable Windows runtime readiness check proved the Rolldown native binding, but did not prove Sharp itself could load. A runtime could therefore be considered ready even though the Sharp Windows native package was missing or damaged. Sharp's loader can then surface the observed `error.code.endsWith(...)` TypeError before the route's normal error handling runs.

## Fix

- Declare `sharp@0.35.4` as a direct production dependency.
- Let the dependency fingerprint force a new matching reusable runtime after update.
- Verify Sharp by requiring it from the actual reusable runtime module tree before startup is considered ready.
- Add targeted Windows Sharp native-package repair.
- Keep existing Rolldown verification unchanged.
- Split Sharp-free media storage/path helpers from the Sharp-dependent media provider.
- Dynamically load Sharp inside the Animated WebP operation so loader failures are converted into a controlled PlotPickle repair message rather than a framework BUILD ERROR overlay.

## Human recovery

After this fix lands, fully close PlotPickle and relaunch through Start-PlotPickle.bat. The changed dependency fingerprint will cause startup to build or reuse a matching runtime that contains Sharp. If its Windows native package is incomplete, startup attempts the targeted repair before opening PlotPickle.

No story data or local generated media is stored in the dependency runtime, so rebuilding it does not remove project assets.

## Verification

- package.json and package-lock.json own Sharp directly.
- Windows runtime readiness includes a live Sharp require check.
- Windows startup includes targeted `repair-sharp`.
- Previs encoder has no static Sharp import.
- Encoder loads Sharp inside the operation and provides a controlled restart/repair message.
- Existing Animated WebP authentication/local-asset rules remain intact.
- Exact-head Architecture Verification must be green before merge.
