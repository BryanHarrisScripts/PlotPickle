# Issue #180 — Official PlotPickle GitHub App configuration

## Purpose

PlotPickle already contains the GitHub Device Flow, repository picker, repository setup and five-point readiness gate. This issue removes the remaining release-maintainer environment-variable step by packaging the public GitHub App identity with every desktop build.

The public configuration contains no secret. It may contain only the GitHub App client ID, app slug, installation URL, homepage, declared settings and declared permissions.

## One authenticated owner action

GitHub App registration is owned by a GitHub person or organization and therefore cannot be completed by repository code or CI.

From a trusted PlotPickle source checkout, the owner runs:

```text
npm run github-app:register
```

This opens GitHub's pre-filled App registration page. Review and create the app under the intended PlotPickle owner.

After GitHub creates the app:

1. Open the app's General settings.
2. Enable **Device Flow**.
3. Keep **expiring user authorization tokens** enabled.
4. Keep webhooks disabled; PlotPickle does not use them.
5. Confirm the app is public so other PlotPickle users can install it.
6. Copy the public **Client ID**.
7. Copy the app slug from its public address.
8. Run:

```text
node scripts/github-app-registration.mjs configure <client-id> <app-slug>
node scripts/github-app-registration.mjs verify
```

The client ID and slug are public identifiers. Do not create, copy or commit a client secret, private key, webhook secret, installation token, user access token or refresh token for this release configuration.

## Permissions

The registration helper preselects:

- Metadata: Read-only
- Contents: Read and write
- Pull requests: Read and write
- Administration: Read and write

Administration is used only for the explicit **Create new story project** action. Writers who connect an existing repository still pass through the same narrower readiness checks. The interface explains the elevated repository-creation permission before that action is used.

## Packaged contract

The canonical public file is:

```text
config/github-app.json
```

Windows, macOS and Linux launchers set `PLOTPICKLE_GITHUB_APP_CONFIG` to that packaged file. `build/github-app-public-config.ts` validates the file and fills the existing runtime variables before the GitHub gateway starts.

Environment variables remain valid overrides for development, recovery and self-hosted installations:

```text
PLOTPICKLE_GITHUB_APP_CLIENT_ID
PLOTPICKLE_GITHUB_APP_SLUG
PLOTPICKLE_GITHUB_APP_INSTALL_URL
PLOTPICKLE_GITHUB_APP_CONFIG
```

The packaged file is the normal release path. End users are not asked to set those values.

## Release gate

A release package fails verification unless:

- registration status is `registered`;
- the public client ID is present;
- the app slug and installation URL match;
- Device Flow and expiring user-token requirements are declared;
- webhooks remain disabled;
- all four declared permissions match the implemented workflow;
- no forbidden secret field appears anywhere in the public configuration;
- all three launchers load the same packaged configuration path.

## User experience

A configured release presents:

**Connect GitHub Account → approve PlotPickle on GitHub → install or select repository access → choose or create a story project → green Ready.**

No second application is installed. PlotPickle remains fully usable without GitHub.

## Scope lock

This issue does not change project synchronization, proposal review, semantic merge, invitations, `.ppf` handling, canonical folder formats or the existing readiness engine.
