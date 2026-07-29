# Issue #182 — Provider-neutral Collab workspace

## Purpose

Phase 1 adds one application-level **Collab** workspace without changing PlotPickle's ten-step creative workflow. It separates service configuration from shared project activity:

> Settings configures services. Collab uses services.

The new workspace appears after Reports and before Settings. GitHub and Google remain optional; local writing never requires an external account.

## Navigation contract

The creative workflow remains:

`Dashboard · Learn · Plan · Storyboard · Write · Pitch | Build · Feedback · Refine · Reports`

Collab is a separate application workspace:

`… Reports | Collab | Settings`

Its sections are:

- Overview
- Approvals
- Meetings
- Calendar
- Connections

## GitHub responsibility split

The existing GitHub engines are reused rather than copied.

### Settings → GitHub

Settings owns configuration and recovery:

- GitHub account connection and disconnection
- repository selection and initialization
- approved branch and readiness checks
- advanced fine-grained-token setup
- repository installation and permission management
- connection and repository recovery

### Collab → Approvals

Collab owns use of the configured collaboration service:

- refresh the approved canonical story
- compare and synchronize canonical project files
- create and inspect Story Proposals
- semantic review by story area
- selective Project Lead approval or decline
- approved revision history
- contributor onboarding and invitation use

`GitHubCollaboration` now supports separate `configuration` and `approvals` surfaces. The legacy `github` surface remains compatible and renders both.

## Google boundary in Phase 1

Meetings and Calendar are provider-neutral empty states backed only by the existing sanitized connection-status snapshot. They do not call Google APIs in this phase.

When Google is disconnected, Collab routes the user to **Settings → Scheduling & Meetings**. When connected, Collab shows provider readiness but still sends permission changes back to Settings.

Future phases may add project-focused Calendar events and unique Google Meet links. The complete personal calendar must not be imported by default.

## Privacy boundary

- GitHub and Google credentials remain in protected local credential storage.
- Collab never asks for passwords, tokens, repository identifiers or OAuth permission grants.
- Credentials never enter canonical project folders, `.ppf` packages, exports, reports, logs or commits.
- Meeting attendee details and private calendar data remain outside the canonical project unless a user explicitly records approved project notes.

## Compatibility

- The ten creative workspaces retain their names and order.
- Existing GitHub proposal, synchronization, invitation and recovery engines are not duplicated.
- Existing Settings deep links remain valid.
- The `/collab` route maps to the in-application Collab workspace.
- Google OAuth and provider gateways remain unchanged in Phase 1.
