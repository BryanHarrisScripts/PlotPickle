# UI/UX required merge gate

The `UI/UX Code Audit` workflow runs for every pull request targeting `main` so GitHub always receives the required check named `Audit UI/UX against Design Rules`.

When no HTML, CSS, SCSS, JSX, TSX or Vue files changed, the workflow passes without calling an external model. When relevant UI files changed, it audits the changed files against PlotPickle's 25 design, accessibility, interaction, performance and resiliency criteria.

The gate fails when:

- one or more UI/UX issues are reported;
- the audit provider cannot be reached;
- the provider response is invalid;
- the changed UI payload exceeds the audit safety limits; or
- `OPENAI_API_KEY` is not configured in GitHub Actions.

Praises do not fail the gate. The workflow maintains one audit comment per pull request and also writes the report to the Actions job summary.

Repository setup:

1. Store the audit credential as the Actions secret `OPENAI_API_KEY`.
2. Optionally set the repository variable `OPENAI_UI_AUDIT_MODEL`; otherwise the workflow uses its checked-in default.
3. Apply `config/public-repository.settings.json` so `Audit UI/UX against Design Rules` is required on `main`.

Do not use `pull_request_target` for this workflow. The audit reads pull-request code while using a provider credential, so it must retain the safer `pull_request` event boundary.
