# PlotPickle Auth release checklist

Issue: #1146

This checklist is the manual companion to `npm run test:plotpickle-auth`. Deterministic tests own automated PASS/FAIL. These checks record installed-machine, browser and operator observations that automation cannot honestly prove by itself.

## Fresh desktop profile creation

- Launch a clean desktop-loopback PlotPickle home with no Auth state.
- Confirm the first screen offers `Create your local profile` rather than requiring email, BUZZ, GitHub, Google or Internet access.
- Create the profile with a long passphrase, save the one-time recovery secret, restart PlotPickle and unlock the same Human profile offline.
- Confirm a second local Human can be added only from an authenticated/authorized profile flow.

## Two simultaneous Human sessions

- On one shared Node, authenticate two different Human profiles in separate browser sessions.
- Confirm each Human sees only their own projects, Library, memory, settings, provider connections and BUZZ Human identity.
- Lock or log out one Human and confirm the other session remains usable.
- Confirm diagnostics and developer endpoints do not enumerate the other Human's private profile resources.

## Negative authentication and recovery

- Try wrong password and wrong recovery values repeatedly and confirm errors remain generic and throttled.
- Confirm password change invalidates older sessions for that Human.
- Confirm recovery reset creates a new password and new recovery secret instead of treating recovery as a standing normal login credential.

## Portable backup and restore

- Create a `.ppbackup` on one Node and restore on another fresh Node.
- Confirm the stable Human profile id and Human-owned encrypted work survive while the destination keeps its own Node identity.
- Confirm BUZZ Human identity is absent by default and is restored only when explicitly included.
- Confirm recovery-based restore rotates the password/recovery wrapping and the old password no longer unlocks the restored profile.

## Secrets and browser inspection

- Inspect browser storage, network responses and downloaded support/report artifacts while exercising Auth.
- Confirm provider tokens, BUZZ private keys and recovery material never appear in durable browser storage, profile chooser metadata, diagnostics or ordinary API responses.
- Confirm session material is cookie-bound and not accepted from URLs or authorization-style headers.

## Server-network HTTPS

- Use an explicitly configured server-network Node with trusted HTTPS, exact Host/Origin allowlists and the intended bind address.
- Confirm an unconfigured or non-HTTPS server refuses Human authentication.
- On a fresh ready server, confirm first-profile creation requests the one-time server bootstrap proof before the Human profile can be claimed.
- Confirm Secure/HttpOnly/SameSite cookie attributes and CSRF rejection on mutations.

## Filesystem and tamper checks

- Attempt path traversal, absolute paths and symlink substitutions against profile-private and restore paths.
- Corrupt an encrypted profile object and a backup entry and confirm PlotPickle fails closed without silently replacing trusted data.
- Confirm an existing destination profile id is never overwritten during restore.

## Release archive

- Stage each supported release archive through the platform packager.
- Run the credential package audit against the release archive, not only the source tree.
- Inspect the archive for local Auth state, recovery secrets, profile-private data, provider tokens, BUZZ private keys, `.env` files, temporary files and quarantined data.
- Confirm only intended public identifiers and configuration templates remain.

## Dependency and legal boundaries

- Review the lockfile and advisories for Auth/crypto dependencies before release.
- Keep WebAuthn/passkeys optional; do not make them the sole portable recovery mechanism.
- Keep OPAQUE/PAKE deferred unless a maintained, independently reviewed implementation is deliberately adopted.
- Legal/privacy wording must match approved product policy. Automation may detect drift but does not grant legal approval.
