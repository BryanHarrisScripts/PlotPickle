# Issue #184 — Official Google Desktop OAuth connection

## Purpose

Phase 2 turns the existing Google connection foundation into a packaged desktop feature. A writer opens **Settings → Google Services**, chooses only the permissions needed, clicks **Sign in with Google**, completes consent in the system browser and returns to a sanitized green connection status.

Google remains optional. A failed, cancelled or unavailable connection never blocks local writing, GitHub collaboration, project storage or export.

## One authenticated owner action

Google requires the application owner to create the public OAuth client in Google Cloud. Repository code and CI cannot perform this account-owned registration.

From a trusted PlotPickle checkout, run:

```text
npm run google-oauth:register
```

This opens Google Auth Platform. Under the intended PlotPickle Google Cloud project:

1. Configure Branding, support contact and Audience.
2. Enable the Google Calendar API and Google Meet REST API before Phase 3 is released.
3. Create an OAuth client with **Application type: Desktop app**.
4. Name it **PlotPickle Desktop**.
5. Copy the public Client ID ending in `.apps.googleusercontent.com`.
6. Do not copy or commit the downloaded client secret.
7. Run:

```text
node scripts/google-oauth-registration.mjs configure <desktop-client-id>
npm run google-oauth:verify
```

The Desktop Client ID is a public identifier. PlotPickle does not package a client secret, refresh token, access token, authorization code, ID token or PKCE verifier.

## Packaged public configuration

The canonical public file is:

```text
config/google-oauth.json
```

Windows, macOS and Linux launchers set `PLOTPICKLE_GOOGLE_OAUTH_CONFIG` to that packaged file. `build/google-oauth-public-config.ts` validates it before the local connection gateway starts.

Development, recovery and self-hosted installations may override the packaged public identity with:

```text
PLOTPICKLE_GOOGLE_OAUTH_CONFIG
PLOTPICKLE_GOOGLE_CLIENT_ID
```

These are public configuration overrides, not credential storage.

## Desktop authorization flow

PlotPickle uses Google's installed-app Authorization Code flow:

1. Generate a high-entropy PKCE verifier and S256 challenge.
2. Generate a cryptographically random state and one-time attempt ID.
3. Bind a temporary HTTP listener to `127.0.0.1` on a random available port.
4. Open Google's HTTPS consent page in the system browser.
5. Accept only one callback from the expected loopback host, port and path.
6. Verify state before consuming the callback.
7. Exchange the code without a packaged client secret.
8. Validate the Google ID-token issuer, audience, expiry and verified email.
9. Confirm UserInfo matches the issued subject and email.
10. Encrypt and save the connection only after all checks pass.

Only one authorization attempt may be active. Attempts expire after ten minutes, can be cancelled from Settings and cannot reuse a completed callback.

## Permission model

Identity scopes are always:

```text
openid
email
profile
```

Optional permissions are selected separately in Settings:

```text
https://www.googleapis.com/auth/calendar.events.owned
https://www.googleapis.com/auth/meetings.space.created
```

Phase 2 obtains and reports these grants but does not create Calendar events or Meet spaces. Those operations belong to Phase 3, issue #185.

## Encrypted local credentials

All provider credential files use OS-user encryption and atomic replacement:

- Windows: DPAPI, CurrentUser
- macOS: AES-256-GCM with the master key stored in the current user's Keychain
- Linux: AES-256-GCM with the master key stored in the current user's Secret Service

If the native key store is unavailable, PlotPickle fails closed and does not write plaintext credentials. Existing plaintext credential files are replaced atomically with encrypted envelopes before use; the original remains untouched if migration cannot complete.

The credential folder contains encrypted envelopes only. Tokens never enter browser storage, project folders, `.ppf` packages, exports, reports, prompts, logs or GitHub commits.

## Disconnect and revoke

**Disconnect and revoke** attempts Google's revocation endpoint using the refresh token, then removes the local encrypted file regardless of network availability. Erasing all PlotPickle credentials also removes the shared macOS Keychain or Linux Secret Service master key after deleting the credential files.

## Release gate

An official release package fails verification unless:

- registration status is `registered`;
- the Desktop Client ID has the expected Google format;
- application type is `desktop`;
- loopback redirect and PKCE S256 are required;
- no client secret is packaged;
- endpoints and declared scopes match the implemented contract;
- all three launchers load the same packaged public configuration;
- the release manifest records the configured Google OAuth identity;
- source tests confirm DPAPI, Keychain and Secret Service protection with no plaintext fallback.

## Phase boundary

Phase 2 ends with a verified account and permission status. Creating, listing, updating or cancelling project meetings is deliberately excluded until #185.
