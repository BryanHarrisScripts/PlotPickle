# PlotPickle Focused UAT Autopilot

PlotPickle UAT Autopilot is intentionally narrow. It currently tests only the product areas under active development: Startup/local agents, Settings, Foundations/LEARN, PLAN, and the Wyrmwood game.

The source of truth is `config/uat-autopilot-registry.json`. Each area owns its focused contract tests. Rendered areas also declare their canonical route, expected visible terms, and a minimum useful-content floor.

CI runs:

`node --test tests/issue-622-uat-autopilot.test.mjs`

then:

`node scripts/run-uat-autopilot.mjs --contracts-only --artifact-root .artifacts/uat-focused`

and finally the production build. The focused UAT Markdown/JSON report is uploaded as a GitHub Actions artifact for 14 days even when a validation step fails.

## Local closed-loop UAT

For the normal local product pass while PlotPickle is already running:

`node scripts/run-uat-closed-loop.mjs --base-url http://127.0.0.1:4173`

This runs the registered focused product pass plus the real Sage conversation UI matrix. Sage is tested through the visible LEARN composer rather than only through `/api/writing-assistant/chat`.

The Sage matrix currently covers:

- `what is your name`
- `Who are you?`
- `Can you help me?`
- ordinary greeting/conversation
- a curriculum/story-craft question
- a follow-up turn

Any visible response containing internal control text such as `QUALITY MODEL ESCALATION`, `CONVERSATION MODE`, `curriculum_context`, `project_memory`, serialized project-memory fields, or similar PlotPickle scaffolding is a blocker.

The live pass uses the existing local Playwright MCP runtime. It captures screenshots and evidence for Settings, Foundations/LEARN, PLAN, Wyrmwood, and the Sage conversation matrix; checks visible-content depth and expected text; and fails on browser console errors or bad user-visible Sage responses.

## Findings and GitHub handoff

Results remain local by default under `%LOCALAPPDATA%\PlotPickle\uat-focused` on Windows. Use:

`node scripts/run-uat-closed-loop.mjs --base-url http://127.0.0.1:4173 --github-report`

to also send unique blockers to `BryanHarrisScripts/PlotPickle` through the authenticated GitHub CLI. Each finding receives a stable fingerprint such as `sage.internal-scaffolding-leak`. Existing open findings are updated instead of duplicated.

New blocker issues receive both `uat:autopilot` and `uat:auto-repair`. The `UAT Repair Handoff` workflow then creates a dedicated draft branch/PR containing the finding evidence. That draft is explicitly a repair workspace, not a claim that the defect has already been fixed. The regression and code repair must be added there, and the standard PlotPickle gates must pass before the PR is made ready or merged.

This separation is deliberate: UAT is allowed to identify, preserve evidence, open/update the issue, and create the repair workspace automatically, but it is not allowed to silently weaken a failing assertion or pretend an evidence-only PR is a completed repair.

## Startup probes

Startup is tested through PlotPickle's local status and agent routes. Mastra must be ready in embedded mode and Sage Brinewick plus Foundations Planner must be registered. The startup health console remains a lightweight readiness probe; it is not a substitute for the browser-level Sage conversation matrix.

If a Fast local model is available, Sage receives the existing craft health probe. If a Quality local model is available, Foundations Planner receives a disposable structured-output probe and must return both requested PLAN fields. A missing optional local model is a warning rather than a false failure. A model that is available but returns a bad response is a failure.

This UAT system is designed to grow with the app instead of becoming a giant all-screen suite. When a new area becomes active, add one registry entry with its route, rendered expectations, and focused tests. Existing unrelated workspaces remain outside this UAT pass until intentionally added.

Human UAT remains useful for creative judgement and whether the experience feels right. Repeatable startup, rendering, console, Sage-response safety, Foundations/PLAN structured-output, and game contract failures should be caught automatically first.
