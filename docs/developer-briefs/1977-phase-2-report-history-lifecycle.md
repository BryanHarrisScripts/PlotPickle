# Developer Brief — #1977 Phase 2

Goal: add deterministic daily OSS Radar reports, comment-backed cross-day history, and one rolling monthly Radar issue on top of Phase 1 discovery.

Authority stays unchanged: Human decides adoption; no dependency install, code/curriculum import, product/canon mutation, implementation-issue creation, scheduled workflow, or model-assisted analysis.

Rules:
- select at most five qualifying findings and never pad weak results;
- use WATCH as the conservative Phase 2 disposition; Phase 3 owns SAVE / IMPROVE / ADD / LEARN / WATCH mapping;
- store one small machine state marker in each dated daily comment;
- reconstruct history from prior Radar comments for 730 days;
- same-day reruns ignore the current day's state baseline and update that same comment;
- suppress unchanged recent repositories;
- allow resurfacing for category change, score delta of at least 5, or changed activity after a 30-day cooldown;
- create/reuse `[OSS RADAR] <Month> <Year>` and fail on duplicate exact monthly issues;
- issue writes are limited to monthly issue creation plus daily comment create/update.

Daily reports include the required `What can PlotPickle learn from this?` question, matched-lane evidence, license/activity, score evidence, and an explicit no-padding note when fewer than five qualify. README/source bodies are not fetched.

Implementation files:
- `lib/verification/oss-radar/history.mjs`
- `lib/verification/oss-radar/report-renderer.mjs`
- `lib/verification/oss-radar/issue-lifecycle.mjs`
- `lib/verification/oss-radar/run-radar.mjs`
- `tests/fixtures/oss-radar/phase-2-report-candidates.json`
- `tests/issue-1977-oss-radar-phase-2.test.mjs`
- `config/development-convergence/1977.json`

Exit: fixture-prove report selection, history suppression/reappearance, month rollover, same-day idempotency, and issue/comment-only writes; then require exact-head Architecture Verification green and stop before Phase 3.