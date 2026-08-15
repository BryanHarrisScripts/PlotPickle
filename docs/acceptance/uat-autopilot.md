# PlotPickle UAT Autopilot

PlotPickle UAT Autopilot is the merge-oriented acceptance layer above the existing local Playwright/MCP runner, 30-stage Creative Writer UAT and UI Continuity Agent. It is intentionally local-first: the deterministic gate does not require paid AI, ChatGPT, Codex quota or an external cloud account.

Run it while PlotPickle is available at the normal private local address:

`node scripts/run-uat-autopilot.mjs --base-url http://127.0.0.1:4173`

The Autopilot runs the existing full browser journey, then runs the 30-stage Creative Writer virtual user. That fixture creates a disposable project and exercises Story Setup, Concept Canvas, World, Characters, 24 Blocks, LEARN, Storyboard, Write, Edit, Graphic Novel, Build, Feedback, Refine, Reports, Settings and named return paths. It then runs the UI Continuity Agent, verifies the canonical LEARN route, checks accessibility evidence depth, treats missing screenshots and browser console errors as blockers, and probes the registered Sage Brinewick and Foundations Planner agents when their local models are available.

The live Foundations Planner probe requires both requested structured fields. A response that does not contain both `output-1` and `output-2` is a blocking UAT failure rather than a startup message that can be overlooked.

The deterministic Creative Writer screenshots also support a local approved visual baseline. The baseline is intentionally not self-approved. After a person visually reviews a known-good run once, approve it with:

`node scripts/run-uat-autopilot.mjs --base-url http://127.0.0.1:4173 --approve-visual-baseline`

The approved screenshot hashes are kept under the user-owned PlotPickle local-app-data UAT baseline folder, separate from story/project data. Later deterministic runs fail when an approved screenshot is missing or changes and warn when a new screenshot needs approval. Because the comparison is intentionally strict, the baseline is meant for the same local Chrome/Playwright environment; UI Continuity remains the structural cross-run visual contract.

Results are written under the local PlotPickle UAT folder as both `autopilot-report.md` and `autopilot-report.json`. The JSON report is the stable handoff for CI diagnostics and read-only review agents.

Severity contract:

- FAIL blocks acceptance: failed route/workspace state, a failed or incomplete 30-stage virtual-user journey, missing screenshot evidence, changed/missing approved visual screenshots, browser console errors, missing or placeholder-level accessibility evidence, error-level UI Continuity findings, LEARN render failure, missing Mastra/Sage/Foundations registration, failed Sage live response when the Fast model is available, or malformed Foundations Planner structured output when the Quality model is available.
- WARN is visible but non-blocking: visible product navigation needed a recovery deep link, UI Continuity reported warning-only drift, no visual baseline has been approved yet, a new screenshot needs approval, or a local Fast/Quality model is not installed so its live AI probe cannot run.
- PASS means the deterministic acceptance contract completed without a blocker or review warning.

This changes the human UAT role. Repeatable functional, virtual-user, rendered-content, visual-regression, console and local-agent failures should be found by Autopilot first. Human review remains the final judgement for creative taste, clarity, usefulness and whether PlotPickle feels right.