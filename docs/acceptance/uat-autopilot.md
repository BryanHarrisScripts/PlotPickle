# PlotPickle Focused UAT Autopilot

PlotPickle UAT Autopilot is intentionally narrow. It currently tests only the product areas under active development: Startup/local agents, Settings, Foundations/LEARN, PLAN, and the Wyrmwood game.

The source of truth is `config/uat-autopilot-registry.json`. Each area owns its focused contract tests. Rendered areas also declare their canonical route, expected visible terms, and a minimum useful-content floor.

CI runs:

`node --test tests/issue-622-uat-autopilot.test.mjs`

then:

`node scripts/run-uat-autopilot.mjs --contracts-only`

and finally the production build.

For local live UAT while PlotPickle is running:

`node scripts/run-uat-autopilot.mjs --base-url http://127.0.0.1:4173`

The live pass uses the existing local Playwright MCP runtime only for the registered rendered areas. It captures a screenshot and accessibility snapshot for Settings, Foundations/LEARN, PLAN, and Wyrmwood; checks visible-content depth and expected text; and fails on browser console errors.

Startup is tested through PlotPickle's own local status and agent routes. Mastra must be ready in embedded mode and Sage Brinewick plus Foundations Planner must be registered. If a Fast local model is available, Sage receives a live conversational probe. If a Quality local model is available, Foundations Planner receives a disposable structured-output probe and must return both requested PLAN fields.

A missing optional local model is a warning rather than a false failure. A model that is available but returns a bad response is a failure.

Results are written as both `autopilot-report.md` and `autopilot-report.json` under the local PlotPickle focused-UAT folder.

This is designed to grow with the app instead of becoming a giant all-screen suite. When a new area becomes active, add one registry entry with its route, rendered expectations, and focused tests. Existing unrelated workspaces remain outside this UAT pass until we intentionally add them.

Human UAT remains useful for creative judgement and whether the experience feels right. Repeatable startup, rendering, console, Foundations/PLAN structured-output, and game contract failures should be caught automatically first.