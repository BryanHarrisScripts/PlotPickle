# CodeQL zero-alert closeout

Issue #1837 is the final coordination boundary for the CodeQL cleanup. It does not dismiss or suppress findings.

## Landed prerequisites

- #1839 binds autonomous QA execution to the workflow-selected commit instead of a pull-request-selected revision.
- #1842 removes Casebook scroll data from browser function source and routes evidence through the shared scanner boundary.
- Earlier security passes retain cryptographic durable IDs, structured CDP arguments, approved direct Node CLI execution, plain-text screenplay import, safe React text rendering and non-sensitive build failure logging.

## Final code batch

- The two retained startup diagnostic runtimes now use `core/security/text-normalization.ts`, matching the current runtime instead of keeping partial multi-pass tag regexes.
- Affected source-contract tests use literal `includes` checks. They no longer construct regular expressions from labels or preserve identity replacements.
- The final regression runs in both PR Gate and Product Gate and also exercises the Casebook scanner regression from #1842.

## Required post-merge closeout

After the exact green PR head lands on `main`:

1. Wait for the fresh default-setup CodeQL analysis of `main` to finish.
2. In Code scanning tool status/configuration, remove the retained configurations named `public-security.yml` and `safety.yml`. Their workflow files are already absent from `main`; removing the retained configurations clears their obsolete analysis instances rather than dismissing alerts.
3. Confirm the active default-setup analysis reports zero open alerts on `main`.
4. Close #1837 only after that zero-alert state is visible.
