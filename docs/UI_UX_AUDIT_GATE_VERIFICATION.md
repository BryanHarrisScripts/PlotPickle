# UI/UX audit gate verification

The merge gate is considered active only when all of the following are true:

1. `.github/workflows/ui-ux-code-audit.yml` exists on `main`.
2. The workflow job is named `Audit UI/UX against Design Rules`.
3. The `main` branch ruleset requires that exact check name.
4. A pull request with no relevant UI files receives a successful check.
5. A pull request with a reported UI/UX issue receives a failed check.

The checked-in configuration and tests enforce items 1 through 3. GitHub Actions provides the live evidence for items 4 and 5.
