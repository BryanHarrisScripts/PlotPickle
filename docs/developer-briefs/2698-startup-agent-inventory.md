# 2698: normal startup agent inventory

## Observed problem

The configured Windows startup log from October 2 ran Sage and Foundations Planner inference after runtime readiness. The previous isolated CI host had no configured models, so the full health chain skipped those operations. This violated the normal-startup requirement to avoid automatic model/provider work.

## Result

Normal startup validates agent profiles and the embedded Mastra agent registrations locally. Its output distinguishes registration readiness from response verification and explicitly reports inference tests as not run. Existing exported full diagnostics remain available for deliberate verification. No provider selection, model loading, generation, or profile synchronization belongs in this automatic check.

## Acceptance and verification

1. The automatic Vite plugin calls registration inventory, preserving explicit full diagnostics.
2. Configured and available model metadata does not trigger a request; unavailable registrations remain visibly unavailable.
3. Supported Windows normal startup records the inventory completion and no inference, including restart and owned shutdown.
4. Focused startup contracts, production build, independent convergence and all seven exact-head architecture checks pass before merge.

Scope: the startup diagnostics entry point, its current adapter, a helper under the existing startup owner, focused tests and verification wiring. Optional Media remains degraded when its renderer is absent. This follow-up does not claim an actual generated video or a multi-sample Afterglow performance benchmark.

## Windows proof follow-up

The first follow-up Windows run observed inventory readiness with inference not run, then exposed EPERM during replacement of the supervisor status file. Serialize writes per status path, use unique temporary files, and retry only transient sharing/permission errors with a bounded delay. Preserve the last valid snapshot and propagate persistent errors. Tests must cover temporary locks, concurrent writes, bounded failure and recovery; real Windows launcher proof remains required.
