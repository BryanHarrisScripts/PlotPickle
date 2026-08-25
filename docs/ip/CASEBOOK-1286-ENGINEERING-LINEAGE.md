# Casebook 1:1 Business Case engineering lineage

Issue #1286 implements the existing Casebook 1:1 Business Case architecture recorded in the PlotPickle IP and product developer briefs.

Engineering lineage anchors for this implementation:

- reusable Business Case contribution/registry contract: `scripts/casebook/business-case-registry.mjs`;
- installed product/plugin contribution mapping and compatibility migration seam: `scripts/casebook/installed-contributions.mjs`;
- discovery/filter/retry/release runner: `scripts/run-casebook-business-cases.mjs`;
- independent registry and failure-isolation regression proof: `tests/issue-1286-casebook-business-case-registry.test.mjs`.

This implementation preserves the earlier architectural rule that the Business Case contract is semantic authority, production fulfills it, and UAT independently proves it. It does not create a new UAT framework or a second product authority.