# Issue #184 — Official Google Desktop OAuth connection

## Purpose

Phase 2 turns the existing Google connection foundation into a packaged desktop feature. A writer opens **Settings → Google Services**, chooses only the permissions needed, clicks **Sign in with Google**, completes consent in the system browser and returns to a sanitized green connection status.

Google remains optional. A failed, cancelled or unavailable connection never blocks local writing, GitHub collaboration, project storage or export.

The approved build order is to merge this inactive foundation, build and merge Phase 3 against the stable connection contract, and then activate both phases by supplying the official public Desktop Client ID and completing a real-browser connection check.

## One authenticated owner action

Google requires the application owner to create the public OAuth client in Google Cloud. Repository code and CI cannot perform this account-owned registration.

From a trusted PlotPickle checkout, run:

```text
npm run google-oauth:register
```

This opens Google Auth Platform. Under the intended PlotPickle Google Cloud project:

1. Configure Branding, support contact and Audience.
2. Enable the Google Calendar API before Phase 3 is released. PlotPickle creates unique Meet links through Calendar conference data and does not request direct Google Meet API access.
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
```

Phase 2 obtains and reports this Calendar grant but does not create events or Meet links. Phase 3, issue #185, creates one unique Meet conference per Calendar event through `conferenceData` without requesting a separate Meet API scope.

## Encrypted local credentials

All provider credential files use OS-user encryption and atomic replacement:

- Windows: DPAPI, CurrentUser
- macOS: AES-256-GCM with the master key stored in the current user's Keychain
- Linux: AES-256-GCM with the master key stored in the current user's Secret Service

If the native key store is unavailable, PlotPickle fails closed and does not write plaintext credentials. Existing plaintext credential files are replaced atomically with encrypted envelopes before use; the original remains untouched if migration cannot complete.

The credential folder contains encrypted envelopes only. Tokens never enter browser storage, project folders, `.ppf` packages, exports, reports, prompts, logs or GitHub commits.

## Disconnect and revoke

**Disconnect and revoke** attempts Google's revocation endpoint using the refresh token, then removes the local encrypted file regardless of network availability. Erasing all PlotPickle credentials also removes the shared macOS Keychain or Linux Secret Service master key after deleting the credential files.

## Merge and activation gates

The Phase 2 code may ship as an **inactive foundation** before the owner supplies the public Desktop Client ID. In that state:

- registration status is `pending-owner-registration`;
- the Client ID is empty rather than a placeholder;
- Google sign-in is shown as unavailable with repair guidance;
- local writing, GitHub collaboration, storage and export remain unaffected;
- package verification still checks the OAuth schema, endpoints, scopes, launcher wiring and absence of secrets.

The later **activation gate** requires:

- registration status `registered`;
- a public Desktop Client ID in the expected Google format;
- application type `desktop`;
- loopback redirect and PKCE S256;
- no packaged client secret;
- all three launchers loading the same public configuration;
- a real browser sign-in returning a verified green connection state.

Supplying the Client ID is therefore configuration activation, not a reason to hold back the reviewed OAuth and encrypted-storage foundation.

## Phase boundary

Phase 2 ends with a verified account and permission status. Creating, listing, updating or cancelling project meetings is deliberately excluded until #185.
