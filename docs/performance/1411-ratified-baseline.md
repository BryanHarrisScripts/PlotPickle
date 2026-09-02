# #1411 Ratified Performance Baseline

Ratified from merged PR #1623, exact benchmark head `a7741f473fe8e20e8e643b4922f3dee9d4eda772`, Windows Performance Baseline artifact `9840160725` (`sha256:efbd544427ec779b59a78018bea35ac9f83130467d81fe6a8a0142ddbee7d7fa`).

The evidence contains three authoritative Windows x64 / Node.js 24.19.0 samples for each of four independently identified modes: fresh runtime, fresh optimizer, warm persistent runtime, and local Story Workflow. Afterglow v9, PPF revision 9, the current Afterglow curriculum identity, BUZZ disabled, and no optional integrations define the ratified workload identity.

Timing thresholds are intentionally evidence-derived rather than aspirational. Warning tolerance is the observed maximum plus the larger of two standard deviations or 10% of the observed maximum. Hard tolerance is the observed maximum plus the larger of four standard deviations or 25% of the observed maximum. Values are rounded upward. This gives noisy hosted-Windows measurements more room than stable measurements and prevents routine variance from becoming a false release failure.

Settled idle behavior is stricter because the repeated evidence was exact: same-origin requests, API requests, external requests, DOM mutations, and explicitly identified launcher-owned Agent/model processes must remain zero during the measured idle window. Launcher-owned working-set growth is separately bounded, while whole-machine CPU and GPU remain explicitly unclaimed because the current observer does not measure them reliably.

The local Story Workflow keeps deterministic structural budgets: targeted re-evaluation must remain bounded to no more than 60% of full-audit work items, 75% of specialists, and 60% of context bytes, while preserving unaffected completed work in every healthy sample. These limits apply to the pinned Afterglow workload, not to creative model latency or wording quality.

The ratified evaluator runs only when repeated authoritative evidence exists: explicitly named `baseline/1411-*` pull requests or manual Windows baseline profiles. Ordinary pull requests keep the single bounded fresh-runtime regression and deterministic contract tests. Warnings are reported but do not fail the gate; hard regressions return a non-zero exit code.

This baseline is the performance handoff for #1412. Package/runtime weight work should compare against it rather than assuming smaller packaging automatically means a faster or healthier PlotPickle.
