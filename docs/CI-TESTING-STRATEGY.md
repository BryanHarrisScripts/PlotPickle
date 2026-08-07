# PlotPickle CI testing strategy

PlotPickle uses two validation depths so pull-request iteration stays fast without removing release safety.

## Pull requests: fast, change-focused validation

Pull requests must prove the changed area is healthy without rerunning the entire historical regression inventory in every workflow.

Required PR checks keep their existing names so branch protection remains stable, but their work is scoped:

- `build-test-lint` installs once, validates the diagnostics registry, lints, builds, and runs `npm run test:changed` for the PR diff.
- If the changed-file registry does not yet own a change, Quality runs a bounded core compatibility fallback instead of silently selecting the complete suite.
- `validate` keeps the historical Phase 1 status name, but only runs focused schema/core-model tests when those contracts changed. It no longer repeats lint, build, and the complete regression suite.
- `Package windows`, `Package macos`, and `Package linux` perform deep packaging only when packaging/runtime-owned files changed. Otherwise they complete quickly and defer full packaging to main.
- `audit` always validates publication boundaries, but production vulnerability scanning runs on PRs only when dependency manifests changed.
- `Full history audit` scans only commits introduced by the PR. The complete reachable-history scan runs on main/manual validation.
- `Pack active Phase 5 branch` remains a stable required status, but Repomix packing is diagnostic evidence produced on main/manual runs rather than every feature PR.
- `Credential boundary audit` remains a strict PR safety check.
- The AI `Audit UI/UX against Design Rules` check is advisory. It may comment on a UI PR, but AI-generated findings do not independently block a merge. Deterministic accessibility, source-contract, build, security, and focused UI tests remain authoritative.
- Area-specific UI workflows use path filters and run only when their owned surface changes.
- Full CodeQL analysis runs on main, scheduled, and manual security validation instead of every feature PR. Dependency review remains available for dependency-changing PRs.
- Full-product screenshot capture does not run automatically on every PR. It can be manually dispatched on a feature branch when visual evidence is specifically needed.

## Main and releases: deep validation

After a merge to `main`, PlotPickle runs the complete regression suite and the expensive cross-platform checks that are inappropriate for every edit loop:

- complete `npm test` regression through structured diagnostics;
- Windows, macOS, and Linux package staging;
- clean-machine extraction and dependency verification;
- Windows runtime binding verification and package interaction evidence;
- complete reachable-history publication scan;
- production dependency audit and CodeQL security analysis;
- Repomix diagnostic package;
- full-product visual capture for interface-related main changes;
- release artifacts and checksums for release tags.

The historical Issue #208 packaged Windows smoke is retired from the release-candidate merge gate. Current deterministic Windows release and interaction smoke paths remain available.

## Why this split exists

The repository accumulated one-off regression jobs as individual issues were completed. Those tests remain valuable as focused contracts and as part of the complete post-merge suite, but completed historical issue checks should not make every unrelated pull request wait for the entire product history.

The rule is:

`PR = build + lint + security boundaries + changed-area tests`

`main/release = full regression + full security + full package + full visual evidence`

This preserves fast feedback during active development while keeping the deeper safety net on the canonical branch and release path.
