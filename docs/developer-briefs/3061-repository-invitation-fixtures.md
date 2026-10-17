# Node 26 repository and invitation fixture wave

Issue #3061, based on merged first wave #3062. This wave covers the historical #148 repository bootstrap, #296 repository naming and #156 collaboration invitation suites only. The Node 26 baseline has 15 cases, 6 passing and 9 failing. No production implementation changes are needed.

Diagnosis: the repository module's relative application-version import cannot resolve from a data URL. The #148 fixture's existing version substitution misses Windows CRLF; #296 has no substitution. Share one fail-closed support loader, normalize LF/CRLF/lone CR, retain the synthetic version seam and use native stripping. Prove real-source LF/CRLF behavior and refusal to load missing/changed expected imports. This is not evidence of the real application-version module.

Invitation fixtures expire in August 2026. Ambient current time makes wrong-project/owner/revocation cases fail at expiry instead. Give those cases an explicit valid time while preserving the expired case, adding a valid-use control, and retaining every rejection expectation. Keep production validation order unchanged.

The three registration assertions still expect the retired monolithic npm test list. Register these suites in a story-canon node-test catalogue entry, then assert exact entry ownership, runner kind and target membership. Preserve their exact standalone command assertions.

Bind complete revised test/support and inspected source bytes to existing approved WHITE-PAPER-V3 W8/W9. Catalogue routing is checked as current governance metadata rather than a self-referential input digest. These are synthetic pure-contract and static-source checks, not live account, network, project-persistence or GitHub collaboration proof.

Acceptance: all original manifest/naming/permission/rejection assertions pass on Node 26 with line-ending and isolation controls; no test skip, global patch, dependency or product change; focused UAT and production build pass; convergence, independent reviews, BEN and exact-head seven-layer CI pass before merge. Leave #3061 open for remaining historical callers and unresolved baseline failures.
