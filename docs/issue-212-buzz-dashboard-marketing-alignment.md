# Issue #212 — Buzz Settings, Dashboard, Splash and README alignment

## Decision

PlotPickle will complete the next product-alignment phase as one coordinated change set:

1. make Buzz configurable from **Settings → Integrations → Buzz**;
2. redesign the real Dashboard toward the approved premium marketing direction;
3. connect Dashboard cards to real project, storage, GitHub, Collab and Buzz state;
4. update focused regression and packaged smoke coverage; and
5. update the Splash screen and repository README files so marketing and documentation match the actual product.

## Product boundaries

- Settings owns connection setup, lifecycle, recovery and removal.
- Buzz remains the optional rooms, agents, media discussion and development workspace.
- Collab remains the formal GitHub approvals, Story Proposals, meetings and calendar workspace.
- Feedback remains the permanent structured review record.
- PPF remains authoritative for creative canon.
- GitHub remains authoritative for code, branches, pull requests and merges.
- Buzz remains dormant until deliberately configured.

## Reference direction

The supplied marketing reference is visual direction, not permission to create fictional product UI.

Remove or avoid:

- duplicate PlotPickle branding inside the Dashboard workspace;
- decorative avatar/profile controls that are not real features;
- mascot artwork used as a large product or Splash decoration;
- redundant footer wordmarks;
- fake collaborators, fake activity or fabricated live status.

Replace those elements with real application cards, honest empty states and actionable status.

## Phase A — Buzz configuration in Settings

Add Buzz as a visible Settings integration with honest states:

- Not configured
- Configuring
- Connected / Running
- Configured / Stopped
- Repair required
- Update available
- Unavailable in this package

Provide Settings-owned controls for bundled local Buzz, an existing relay, connection testing, start, stop, restart, repair, update, backup, restore, data removal and identity/credential erasure.

Show package status, runtime version, runtime/data/log/backup locations, identity state, relay/community/project-room state and Developer Mode state.

When Buzz is unconfigured, PlotPickle must create no process, port, identity, credential, database, room, media store or coding worktree.

## Phase B — Dashboard product alignment

Redesign the real Dashboard toward the premium dark card-based direction while preserving the existing PlotPickle shell and accessibility rules.

Strengthen real cards for:

- Current project and project source
- Storyworld Overview
- Writing and development progress
- Recent Activity
- GitHub Approvals / repository status
- Collab status
- Buzz status
- Storage and backups
- Canon and unresolved decisions

A fresh local project must not expose Afterglow-specific fragments. Representative examples must be clearly labelled as examples rather than live data.

## Phase C — Connected status and routing

- Unconfigured Buzz routes from Dashboard to Settings → Integrations → Buzz.
- Running Buzz routes from Dashboard to the Buzz workspace.
- GitHub approval status routes to Collab approvals.
- Storage status routes to Storage & Backups.
- Buzz remains beside Collab in the main navigation.

## Phase D — Validation

Add focused coverage for:

- Buzz in the Settings navigation;
- honest Buzz lifecycle states;
- Dashboard card inventory and removal of decorative-only elements;
- fresh local project state;
- Dashboard routing to Buzz, Settings, Collab and Storage;
- responsive shell behavior;
- Windows packaged smoke navigation;
- build, lint and full test matrix.

Use one consolidated correction and one final CI attempt after local validation.

## Phase E — Splash screen and README update

Update the Splash screen and repository README files so they accurately represent the current product.

### Splash

The Splash screen must:

- use the real Dashboard and current navigation as its visual foundation;
- position PlotPickle as a visual storyworld collaboration and previsualization engine;
- explain the workflow across PPF, Plan, Write, Graphic Novel, Storyboard, Feedback, Reports, Collab and Buzz;
- include one-installer, local-first and Windows/macOS/Linux positioning;
- explain GitHub, Google, AI and Buzz as optional integrations;
- describe Buzz as dormant until configured;
- explain that Settings configures services while Collab and Buzz use them;
- retain open-source, licensing and creator-ownership messaging;
- remove large mascot artwork, duplicate wordmarks and decorative profile controls;
- use only product-authentic screenshots or product-authentic illustrated states.

### README files

Update the root README and relevant packaged/platform README files with:

- current product positioning;
- the complete navigation and workspace model;
- PPF as the creative source of truth;
- local-first storage and one-installer desktop packages;
- GitHub Story Proposals and approvals through Collab;
- Google Calendar and Meet boundaries;
- Buzz purpose and dormant-by-default setup;
- Settings ownership of integrations;
- Windows, macOS and Linux installation guidance;
- first-run, connection, backup and removal guidance;
- security and credential handling;
- current screenshots and brand assets;
- a clear distinction between available features, optional configuration and future native Buzz packaging.

No Splash or README claim may advertise unshipped native Buzz binaries as available.

## Acceptance criteria

- Buzz is visible and configurable through Settings with honest package/runtime states.
- Dashboard aligns with the approved visual direction and contains no crossed-out decorative elements.
- Dashboard cards use real state or clearly labelled empty states.
- Splash and README documentation include Buzz and current collaboration capabilities without overstatement.
- Focused tests, full tests, lint, production build and platform packaging validation pass.
- Windows packaged smoke passes.
- One final CI matrix is green before merge.

## Non-goals

- shipping unverified Buzz native binaries;
- replacing Feedback with Buzz;
- replacing GitHub approvals with Buzz approvals;
- introducing real-time co-writing;
- inventing marketing-only functionality.
