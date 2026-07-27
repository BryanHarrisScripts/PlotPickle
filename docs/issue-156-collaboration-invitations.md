# Phase 5 of 6 — Invitations and collaborator roles

Issue: #156

## Product outcome

Phase 5 adds a role-first collaboration layer above the Git-native Story Proposal system completed in Phase 4. A collaborator can receive a credential-free `.ppinvite` file, open it in PlotPickle and begin with the correct creative workspace without entering repository owner, repository name, branch or canonical project-path fields.

GitHub remains the owner-controlled collaboration transport. PlotPickle translates that technical layer into filmmaker-facing roles, invitations, approved-story refresh and Story Proposals.

## Invitation package

A `.ppinvite` package contains only bounded onboarding information:

- invitation ID;
- project ID and title;
- repository owner, repository name and repository URL;
- approved branch and canonical project root;
- collaborator role;
- recipient and issuer labels;
- role-derived permissions and workspace defaults;
- issued and expiry dates;
- an optional welcome note.

The package rejects fields that resemble access tokens, refresh tokens, passwords, private keys, client secrets or authorization material. Credentials remain in PlotPickle's encrypted local secrets area and are never written to an invitation, project, `.ppf`, report, export or GitHub commit.

## Supported roles and role-based defaults

### Writer

Writer mode prioritizes Write, Build, Feedback and Read & Learn. It can edit locally and submit Story Proposals while the project is accepting them.

### Director

Director mode prioritizes Storyboard, Production, Feedback and Read. It can submit visual, scene and production proposals.

### Actor

Actor mode prioritizes Table Read, Characters, Feedback and Read. It can submit dialogue, character and performance-note proposals.

### Producer

Producer mode prioritizes Reports, Production, Feedback and Dashboard. It can submit production, rights and delivery proposals.

### Reviewer

Reviewer mode opens with read-only review defaults. It prioritizes Feedback, Read, Reports and Read & Learn. It can inspect the approved story and semantic proposal groups, but it cannot submit, approve or decline canonical changes.

## Role-first onboarding

The normal invitation flow deliberately keeps repository metadata hidden:

1. The Project Lead chooses a collaborator name, role, expiry and welcome note.
2. PlotPickle creates and downloads a `.ppinvite` file.
3. The collaborator opens the file in PlotPickle.
4. PlotPickle derives the role, workspace defaults and repository selection from the invitation.
5. When the GitHub App is already connected, PlotPickle selects the invited repository automatically.
6. When GitHub sign-in is still required, the collaborator signs into GitHub without manually entering repository fields.
7. PlotPickle verifies the invitation against the connected project, approved branch and collaboration policy.

Expired, revoked, wrong-project and repository-mismatched invitations are rejected with a specific message.

## Accepting Proposals

The Project Lead controls an **Accepting Proposals** switch stored in the canonical file:

`project/collaboration/policy.json`

Turning the switch off blocks new Story Proposal submissions while preserving:

- local writing and planning;
- approved-story refresh;
- proposal queue reading;
- local backups and `.ppf` exchange;
- Project Lead policy management.

The policy also stores a sorted list of revoked invitation IDs. It contains no personal access credentials.

Policy updates use the Git Data API with an expected approved-branch commit, one new blob, one tree, one commit and a non-forced branch update. If the approved branch moves after the policy is loaded, PlotPickle stops and requires a refresh.

## Server-side access guard

Buttons are not the security boundary. A server-side access guard runs before the Story Proposal and invitation gateways.

It enforces that:

- only the Project Lead workspace can create invitations;
- only the Project Lead workspace can change collaboration policy;
- only the Project Lead workspace can approve or decline proposals;
- reviewer and other non-submitting roles cannot submit proposals;
- expired, revoked, wrong-project or repository-mismatched invitations cannot submit;
- no role can submit while **Accepting Proposals** is off.

Removing an accepted collaborator role from the local computer restores Project Lead controls without deleting the story, local backups or GitHub account connection.

## Compatibility and privacy

- Canonical story files remain the collaboration source of truth.
- `.ppf` remains the portable exchange and migration format.
- Invitations are stored locally outside the project after import.
- Windows stores new or updated local invitation state using current-user DPAPI protection.
- macOS and Linux use current-account restricted file permissions.
- GitHub repository details are present in the invitation package but remain hidden from normal onboarding forms.
- Manual fine-grained tokens remain an Advanced Setup fallback.

## Phase boundary

Phase 5 does not add background synchronization, offline proposal queues, automatic retries, moved-repository recovery, deleted-branch recovery or conflict repair. Those reliability and recovery concerns belong to Phase 6.

## Validation

Phase 5 is complete when:

- executable invitation-format tests pass;
- credential-bearing, expired, revoked and wrong-project packages are rejected;
- role permissions and workspace defaults are deterministic;
- the Project Lead-only server guard covers invitation, policy, approval and decline operations;
- **Accepting Proposals** is enforced at the server before proposal creation;
- role-first UI and read-only review controls are present;
- the PlotPickle Quality, Phase 1 compatibility and Windows/macOS/Linux release-candidate workflows pass.
