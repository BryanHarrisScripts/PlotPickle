# Issue #146 — Phase 1 GitHub App connection

## Purpose

Phase 1 replaces PlotPickle’s normal manual GitHub setup with a filmmaker-friendly account connection and repository picker. GitHub remains optional. Local writing, project storage, assets and backups continue to work without a GitHub account or internet connection.

The existing fine-grained personal access token workflow remains available under **Advanced Setup** for development, self-hosted installations and recovery.

## User flow

1. Open the PlotPickle GitHub collaboration workspace.
2. Select **Connect GitHub Account**.
3. PlotPickle requests a short-lived device code from GitHub and opens GitHub’s verification page.
4. Enter the code and approve the PlotPickle GitHub App.
5. Return to PlotPickle. The local server polls only at GitHub’s required interval.
6. Select a story project from repositories installed for the PlotPickle GitHub App.
7. PlotPickle records the repository owner, repository name and default branch automatically.
8. The existing readiness engine verifies repository access, the approved branch, the canonical `.ppf` path, Contents write access and Pull requests write access.
9. The green **Ready** state appears only after all five checks succeed.

No file, commit, branch or pull request is created during sign-in, repository selection or readiness testing.

## GitHub App registration

Register a public GitHub App owned by the appropriate PlotPickle account or organization.

Required settings:

- Enable Device Flow.
- Keep expiring user authorization tokens enabled.
- Request user authorization.
- Repository access is selected by the installing user.
- Webhooks are not required for Phase 1.

Repository permissions:

- Metadata: Read-only
- Contents: Read and write
- Pull requests: Read and write

Phase 2 repository creation additionally uses Administration: Read and write. Connecting an existing repository does not use that capability.

## Release and local server configuration

Official Windows, macOS and Linux releases package the public GitHub App identity in:

```text
config/github-app.json
```

The desktop launcher supplies that file automatically. A normal user does not set a client ID or install another application.

Development, recovery and self-hosted installations may override the packaged identity with:

```text
PLOTPICKLE_GITHUB_APP_CONFIG
PLOTPICKLE_GITHUB_APP_CLIENT_ID
PLOTPICKLE_GITHUB_APP_SLUG
PLOTPICKLE_GITHUB_APP_INSTALL_URL
```

The official registration and packaging procedure is documented in `docs/issue-180-official-github-app-config.md`.

The device flow does not embed or require a GitHub App client secret in the downloaded application.

## Credential storage

The local server stores separate encrypted credential files through `build/local-credentials.ts`:

- `github-app-pending.json` while a device code is awaiting authorization
- `github-app-authorization.json` for the short-lived user access token, refresh token and signed-in identity
- `github-connection.json` for the selected story repository and the current access token used by the existing collaboration gateway

On Windows these files are protected for the current user with DPAPI. On macOS and Linux they remain restricted to the current operating-system account.

The access token expires after the period returned by GitHub. Before status checks, repository listing or selection, PlotPickle refreshes an expiring token with the saved refresh token and updates the selected connection. Tokens and device codes are never written into `.ppf` projects, exports, reports, logs or GitHub commits.

## Repository discovery

PlotPickle uses the signed-in GitHub App user access token to:

1. list app installations accessible to the user;
2. list repositories available through each installation; and
3. display only repositories granted to the PlotPickle GitHub App.

Read-only repositories remain visible but cannot be selected for collaboration. The repository’s `default_branch` becomes PlotPickle’s approved branch automatically.

## Transitional `.ppf` path

Phase 1 keeps the existing canonical `.ppf` path so the authentication redesign can ship without changing the collaboration data model at the same time. Folder-based Git synchronization belongs to Phase 3 of the six-phase collaboration roadmap.

## Error handling

The device flow handles:

- `authorization_pending`
- `slow_down`
- `expired_token`
- `access_denied`

A denied or expired sign-in does not affect local creative work. The local gateway redacts GitHub tokens and long device secrets from returned error messages.

## Manual fallback

Advanced Setup retains:

- Project Lead or organization
- story repository name
- approved branch
- canonical `.ppf` path
- fine-grained personal access token

The fallback continues to require Contents and Pull requests set to Read and write and runs the same five readiness checks.

## Out of scope

- Canonical folder-based repository synchronization
- Semantic story proposal review and selective merge
- `.ppinvite` collaboration packages
- Managed PlotPickle cloud accounts
