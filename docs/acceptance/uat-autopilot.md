# PlotPickle UAT Autopilot

PlotPickle UAT Autopilot is the merge-oriented acceptance layer above the existing local Playwright/MCP runner and UI Continuity Agent. It is intentionally local-first: the deterministic gate does not require paid AI, ChatGPT, Codex quota or an external cloud account.

Run it while PlotPickle is available at the normal private local address:

`node scripts/run-uat-autopilot.mjs --base-url http://127.0.0.1:4173`

The Autopilot runs the existing full browser journey, runs the UI Continuity Agent, verifies the canonical LEARN route, checks accessibility evidence depth, treats missing screenshots and browser console errors as blockers, and probes the registered Sage Brinewick and Foundations Planner agents when their local models are available.

The live Foundations Planner probe requires both requested structured fields. A response that does not contain both `output-1` and `output-2` is a blocking UAT failure rather than a startup message that can be overlooked.

Results are written under the local PlotPickle UAT folder as both `autopilot-report.md` and `autopilot-report.json`. The JSON report is the stable handoff for CI diagnostics, future screenshot-baseline comparison, and read-only review agents.

Severity contract:

- FAIL blocks acceptance: failed route/workspace state, missing screenshot evidence, browser console errors, missing or placeholder-level accessibility evidence, error-level UI Continuity findings, LEARN render failure, missing Mastra/Sage/Foundations registration, failed Sage live response when the Fast model is available, or malformed Foundations Planner structured output when the Quality model is available.
- WARN is visible but non-blocking: visible product navigation needed a recovery deep link, UI Continuity reported warning-only drift, or a local Fast/Quality model is not installed so its live AI probe cannot run.
- PASS means the deterministic acceptance contract completed without a blocker or review warning.

This changes the human UAT role. Repeatable functional, rendered-content, visual-contract, console and local-agent failures should be found by Autopilot first. Human review remains the final judgement for creative taste, clarity, usefulness and whether PlotPickle feels right.

Screenshot artifacts remain part of every browser run. The machine-readable evidence format deliberately records screenshot presence so approved image/pixel baselines can be layered into this same architecture without creating a parallel UAT system.