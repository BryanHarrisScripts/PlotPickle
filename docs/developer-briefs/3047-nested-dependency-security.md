# #3047 — Nested developer dependency security

Parent: #3023 / #3024. Human authorized updating, testing, PRs and merge when green.

## Assessment and approved scope

GitHub Dependabot #57 reports shell-quote 1.9.0 in the Hunk Review proof package
(GHSA-pqg4-j6r4-53mv; fixed 1.11.0). Hunkdiff's current 0.23.0 release still
pins the affected version, so use an exact security override in its existing
nested owner rather than upgrade the application or command controller.

Dependabot #59 reports MCP client 2.0.0 in the Pi extension lock
(GHSA-6qxp-vccf-f47h; fixed 2.2.0). The owning pi-mcp-adapter was already retired
from loaded settings and setup by #2591. Remove that stale dependency and its
unreferenced lock entries instead of upgrading or reactivating the retired path.
The historical dormant audit-only rollback identifier remains unchanged.

Primary sources checked October 16, 2026:
- https://github.com/advisories/GHSA-pqg4-j6r4-53mv
- https://github.com/advisories/GHSA-6qxp-vccf-f47h
- https://registry.npmjs.org/hunkdiff/0.23.0

## Acceptance and impact map

- Hunk Review lock selects shell-quote 1.11.0, still MIT, using the existing
  hunkdiff 0.23.0 package. No direct application pins change.
- Pi's nested manifest matches the active four extension packages; retired MCP
  adapter/client packages leave that lock. Remaining package versions stay fixed.
- Both nested graphs pass npm audit and clean npm ci with lifecycle scripts
  disabled. The installed Hunk CLI reports its version and help on Windows.
- Existing Pi-native-MCP, security and Command regressions, focused UAT and
  production build pass; exact-head independent reviews and required CI pass.

Owners: .pi/npm and tools/hunk-review only. Consumers: developer extension
installation and Hunk Review proof tooling. No PPF, provider, credentials,
managed Pi version, native MCP runtime, model, GPU or canonical story changes.
No package installation in the running primary checkout.

The existing optional peer @opentui/core 0.5.14 declares Node >=26.4.0 while the
supported installation uses Node 24.19.0; this unchanged engine warning remains
a compatibility limit. Hunk version/help succeeds, which does not prove every
optional TUI path. Required impact-selected Windows Command CI remains necessary.

## Verification and rollback

Use the existing unchanged regression sources after truth admission. Nested
advisory scans cover these npm graphs only, not all ecosystem components.
Retain the original root braces backport and its existing hostile-depth test;
do not dismiss root or CodeQL alerts as part of this change.

Rollback is a revert of the nested manifests/locks. The primary installation and
Human profile are untouched; a rollback would restore vulnerable dependencies
and must not be used as an unattended security downgrade.
