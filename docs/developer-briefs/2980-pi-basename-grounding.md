# #2980 — Pi Draft basename grounding in authenticated Settings → Command

## Observed real failure

On 2026-10-14 the Human's current authenticated Windows Command shows **01 Interpret complete**, **02 Pi Draft technical brief failed** and **03 Publish Brief unavailable**. Stack: `scripts/dsdd-integrity.mjs` → `scripts/pi/dsdd-grounding-repair.mjs` → `scripts/dsdd-pi-draft.mjs`. The locked request seeks a unified, governed creative Command interface. DSDD correctly did **not** mutate code or publish an issue.

The Pi output had six unqualified backticked filenames. Four are actually indexed files at unique verified locations: `modules/write/model/selected-ppf-runtime-grid.mjs`, `build/dsdd/dsdd-github-brief.ts`, `tests/issue-1847-1849-cloud-agents-settings.test.mjs`, `tests/issue-2863-settings-time-and-operations-order.test.mjs`. Two, `story-decisions.yml` and `command-review-panel.tsx`, are not verified as existing source paths. Distinguish missing directory qualification from non-existent code; do not invent either.

## Narrow fix and safety invariants

1. Reuse the read-only, shell-free `git ls-files --cached -z --full-name` index already consulted by #2975. Restrict candidate evidence to present, regular files within the repository's real root, excluding deleted, untracked, traversal and symlink escapes.
2. Only for backticked **bare filename** claims in Pi's generated Markdown, if the basename has one—and only one—matching indexed existing file, substitute that canonical repo-relative path. Do not guess any prefix, normalize explicit path-bearing claims or accept ambiguities. No fuzzy matching.
3. Preserve the original locked Human intent byte-for-byte; no reinterpretation and no source, PPF, media, credential, worktree or GitHub mutations. Maintain the original one bounded correction for still-invalid claims, and the final independent `assertPiDraftGrounding` guard after either completion. Missing or ambiguous claims after correction still block Publish Brief.
4. Make the correction instruction explicit: exact tracked full paths for existing files, or plain **Unknown / requires inspection** for proposed/missing components; avoid putting unverified filenames in backticks.
5. Add new, narrowly scoped tests: the precise four real basename references plus two missing ones; duplicate basenames; explicit nonexistent qualified paths; Windows index separators; untracked, deleted, symlink and traversal cases; single and two-pass behavior; fail-closed second invented result; unchanged locked prompt.
6. Register the new test under approved WHITE-PAPER-V3 W8/W9 with its exact SHA-256 and `dsdd-pi-managed-runtime` ownership. Run #2975 and other adjacent DSDD tests, full affected layers and exact-head CI; fix failures, merge only when required checks green.

## Evidence limits

Synthetic tests check deterministic repository indexing and response grounding; they do **not** claim the live local Qwen model produced a useful Command orchestration brief. The Human should repeat **Pi Draft** on the existing locked interpretation after updating PlotPickle from main; then review **Publish Brief** rather than automatically creating an issue. Do not close #2977 (creative first Block is still incomplete). The screenshot's Hunk unavailable/compatible message is a separate optional review-tool readiness observation, not Pi's source-grounding cause. Normal runtime must not install tools silently.
