# UI/UX review status

The `UI/UX Code Audit` workflow runs for every pull request targeting `main` so GitHub always receives the required check named `Audit UI/UX against Design Rules`.

When no HTML, CSS, SCSS, JSX, TSX or Vue files changed, the workflow passes without calling an external model. When relevant UI files changed, it runs one bounded AI review pass against PlotPickle's design, accessibility, interaction, performance and resiliency criteria and maintains one audit comment on the pull request.

The AI review is advisory. Model-generated findings, provider availability, an invalid provider response, or a missing provider credential do not independently block a merge. This prevents probabilistic or contradicted AI findings from becoming the final authority over source code.

Merge-blocking UI confidence comes from deterministic checks instead:

- the normal build and lint gate;
- changed-area regression tests;
- focused workspace and accessibility contract workflows;
- security and credential-boundary checks;
- manual visual review when a pull request warrants it.

The full-product screenshot inventory runs after interface-related changes land on `main`, and it can be manually dispatched on a feature branch when complete pre-merge visual evidence is useful.

Repository setup:

1. Store `OPENAI_API_KEY` only if advisory AI review is desired.
2. Optionally set `OPENAI_UI_AUDIT_MODEL`; otherwise the workflow uses its checked-in default.
3. Keep `Audit UI/UX against Design Rules` in `config/public-repository.settings.json` so the stable status context is always present on `main` pull requests.

Do not use `pull_request_target` for this workflow. When the optional provider is used, the audit reads pull-request code while using a provider credential, so it must retain the safer `pull_request` event boundary.
