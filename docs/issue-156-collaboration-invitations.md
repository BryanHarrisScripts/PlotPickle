# Issue #156 — Collaboration invitations and roles

Phase 5 adds a filmmaker-facing invitation layer on top of GitHub App connection, canonical project folders and Story Proposals.

## `.ppinvite` packages

A Project Lead can create a portable `.ppinvite` JSON package for a Writer, Director, Actor, Producer or Reviewer. The package contains only bounded project identity, the user-owned repository address, approved branch, canonical project root, invitation ID, role, issuer and expiry. It never contains an API key, access token, refresh token, private key, client secret or local credential path.

The package includes a deterministic integrity value for accidental or casual modification detection. Once the collaborator connects GitHub, PlotPickle also verifies the package against the approved repository's `collaboration/invitations.json` registry. Registered role, recipient, issuer, issue date and expiry must match exactly. Missing, changed, expired, revoked and wrong-project invitations are rejected with specific guidance.

## Human-friendly onboarding

Opening a `.ppinvite` applies the story-project owner, repository, approved branch and canonical root without asking the collaborator to type GitHub metadata. GitHub authorization remains a separate, explicit account action. After sign-in, the normal repository picker is replaced by one invitation-selected repository check.

Role defaults surface the most relevant workspace first:

- Writer → Write
- Director → Storyboard
- Actor → Feedback and Table Read
- Producer → Reports
- Reviewer → Feedback in read-only review mode

The role changes interface guidance, not the installed PlotPickle edition. Every collaborator still uses the complete local-first application.

## Reviewer boundary

Reviewer mode locks canon editing and Story Proposal submission. Feedback notes remain available, as do approved-story refresh, local exports and the ability to start a separate local project. The server repeats the reviewer and invitation checks before creating any Story Proposal.

## Accepting Proposals

The Project Lead can pause or reopen new Story Proposals through the versioned repository manifest. Pausing submissions does not disable local writing, approved-story refresh, proposal review or Project Lead decisions on proposals already open.

Setting changes, invitation registration and revocation use the exact approved commit as a stale-base guard and update the approved branch with a non-forced commit. Invited roles cannot change these Project Lead controls.

## Storage and privacy

Invitation registry records live in `collaboration/invitations.json` in the user-owned story repository. Credentials remain in PlotPickle's private encrypted local secrets area and are excluded from projects, `.ppinvite` packages, `.ppf` files, reports, exports, logs and Git commits.

## Compatibility

Legacy projects normalize to Project Lead, no invitation, editable canon and accepting proposals. `.ppf` remains a portable exchange and migration format; the canonical collaboration source remains the modular `project/` folder.
