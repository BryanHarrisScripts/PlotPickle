# Developer Brief — #2196 OSS Radar Run Regression

## Goal

Restore the established GitHub-native OSS Radar delivery flow after the #2194 7×3 redesign while keeping the new adaptive architecture behavior.

## Root cause

The first live manual run after #2194 failed in the pre-run regression suite. The Radar itself never executed.

Seven older tests still asserted legacy Top-5 or X-draft wording, and the Phase 4 fixture loaded only the base discovery contract while production now loads the adaptive overlay.

## Delivery contract

The workflow remains manually dispatchable and scheduled.

Successful execution now follows:

GitHub Actions run
→ deterministic Radar verification
→ live OSS Radar execution
→ rolling monthly [OSS RADAR] issue update
→ GitHub Actions run summary containing the full-report link and X-ready copy
→ GitHub account notification behavior remains GitHub-managed.

No SMTP secrets, custom recipient address, curl mail send or workflow email-mode selector are required.

## Compatibility

The base non-adaptive contract retains its historical Top-5 semantics for the older deterministic regression fixtures.

The merged production contract retains #2194 behavior:

- seven architecture areas;
- up to three findings per area;
- up to 21 distinct findings;
- next-day unchanged-review suppression;
- lane-balanced bounded enrichment.

## Public digest

Restore the recognizable Script-to-Screen OSS Radar heading and existing X-ready copy format while preserving architecture-area sampling.

Footer:

Presented by PlotPickle — Today’s OSS Radar tracks useful ideas, emerging patterns and different approaches across the open-source script-to-screen ecosystem.

## Full report and run-summary footer

Presented by PlotPickle — Today’s OSS Radar.

## Verification

The Radar workflow runs #1977, #2034, #2087 and #2194 deterministic regressions before discovery.

#2087 now explicitly verifies GitHub-native summary delivery and absence of custom SMTP configuration.

Refs #2014 #2087 #2194 #2196.
