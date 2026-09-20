# #2291 — Unified Startup / Profile Gate + Layer 1 Verification Consolidation

## Purpose

Converge PlotPickle startup into one continuous Human-facing Profile Gate while preserving Auth Core authority, add deterministic WebMCP evidence for initialization and locked/passphrase states without browser credential entry, and stop Layer 1 from growing through permanent issue-specific regressions.

## Startup contract

Ordinary single-profile desktop-loopback launch:

`initializing → locked selected profile → authenticated application`

The initialization and locked states share one persistent Skin V1 Profile Gate shell. Multi-profile, Switch Profile, Add Profile, Guest, Recovery, and server-unavailable flows remain available.

A verification-only browser flag may hold the harmless initialization state for deterministic capture. It cannot authenticate or expose private state.

## WebMCP contract

WebMCP captures, separately from the 30 authenticated standard surfaces:

- `.artifacts/visual-readiness/startup-initializing-candidate.png`
- `.artifacts/visual-readiness/profile-locked-candidate.png`

The locked capture contains exactly one empty passphrase field. Browser automation never types or fills a credential. Synthetic profile creation and authentication use the existing loopback-only verification API harness before the authenticated WebMCP run.

## Layer 1 migration

Before #2291, 13 catalogue entries were ordinarily owned by `experience-skins`.

After #2291, ordinary Layer 1 selection has three current-product owners:

1. `experience.skin-surface-contract` — fast current Skin/Profile Gate contract.
2. `experience.navigation-continuity` — fast current Dashboard/nested-return/standard-catalogue contract.
3. `experience.webmcp-live-observer` — rendered browser/Visual Director/UI conformance evidence.

Historical issue-specific tests remain in the repository and are selected through `manual` mode when needed.

### Historical/manual entries retained

- `experience.webmcp-baseline-approval-2151`
- `experience.manual-uat-follow-up-2153`
- `experience.pre-phase2-1954`
- `experience.home-launcher-1960`
- `experience.community-conversation-1963`
- `experience.product-identity-1971`
- `experience.learn-journey-shell`
- `experience.learn-semester-one`
- `experience.navigation-continuity-2249`
- `experience.story-bible-surface-2251`
- `experience.public-site-authority-2262`
- `experience.skin-v1-uat-corrections-2266`

No historical test file is deleted.

## Boundaries

- Auth Core remains the authentication authority.
- WebMCP never enters a Human or synthetic passphrase in the browser.
- Startup/auth captures do not join the 30 authenticated standard-surface catalogue.
- Skin V1 remains the visible startup authority; no Legacy Skin flash is reintroduced.
- Layer 2–7 ownership is unchanged.
- Coverage is consolidated around current invariants rather than historical issue chronology.
