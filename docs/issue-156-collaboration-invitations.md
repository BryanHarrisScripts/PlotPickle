# Issue #156 — Collaboration invitations and roles

Phase 5 adds a human-facing invitation and role layer over the merged GitHub App, canonical project-folder and Story Proposal engines. It does not duplicate those engines.

## `.ppinvite` packages

A repository owner or maintainer acting as Project Lead can create a portable `.ppinvite` JSON package for a Writer, Director, Actor, Producer or Reviewer. It contains bounded project identity, the user-owned repository address, approved branch, canonical project root, invitation ID, role, issuer and expiry. It never contains an API key, access token, refresh token, private key, client secret or credential path.

A deterministic integrity value detects package modification. After GitHub connects, PlotPickle verifies the package against `collaboration/invitations.json` on the approved branch. The registered role, recipient, issuer, issue date and expiry must match exactly. Missing, changed, expired, revoked, wrong-project and wrong-repository invitations are rejected clearly.

## Onboarding and role defaults

Opening a package identifies the exact story repository without asking the collaborator to type repository metadata. GitHub authorization remains a separate explicit account step, and credentials remain in PlotPickle's encrypted local secrets area.

- Writer → Write
- Director → Storyboard
- Actor → Feedback and Table Read
- Producer → Reports
- Reviewer → Feedback in read-only review mode

Roles guide the interface rather than creating separate PlotPickle editions. The complete local-first application remains installed.

## Reviewer boundary

Reviewer mode opens Feedback and blocks canon form changes, content editing, drag/drop mutation and Story Proposal submission. Viewing the story, navigating, leaving Feedback, refreshing the approved story and exporting local material remain available. The local gateway repeats the reviewer check before the existing Story Proposal engine runs.

## Accepting Proposals

The Project Lead can pause or reopen new Story Proposals through `plotpickle-project.json`. Pausing does not disable local writing, approved-story refresh, review of proposals already open or Project Lead decisions.

## Project Lead authority

Invitation registration, revocation, proposal acceptance settings, proposal approval/decline, approved-folder publishing, repository migration and release snapshots require repository owner or maintainer permission. The Phase 5 gateway is mounted before the existing proposal and synchronization gateways and blocks unauthorized operations before their request bodies are consumed.

Invitation and manifest changes use the exact approved commit as a stale-base guard, create one Git tree and one commit, and update the branch with `force: false`.

## Storage and privacy

The invitation registry is versioned in the user-owned story repository. The active role session is stored in the same private local credential boundary already used by PlotPickle connections. Credentials are excluded from projects, `.ppinvite` packages, `.ppf` files, reports, exports, logs and Git commits.

## Compatibility

Projects without an invitation remain in normal Project Lead mode. `.ppf` remains a portable exchange and migration format; the canonical collaboration source remains the modular `project/` folder. Phase 6 offline queue and recovery work remains separate.
