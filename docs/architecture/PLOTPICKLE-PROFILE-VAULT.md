# PlotPickle Profile Master Key vault

Status: canonical server-side profile-vault lifecycle introduced by #1140. Storage, credential, session, UI and BUZZ work must consume this service instead of generating a parallel Human key hierarchy.

## One PMK owner

`core/auth/plotpickle-auth-core.mjs` is the central vault service. Profile creation generates one independent random 256-bit Profile Master Key (PMK), then persists only the separate password and recovery envelopes defined by #1138. The PMK is not derived from a password, profile identifier, display name, Node identifier, operating-system account or BUZZ identity.

The service keeps a separate PMK copy for each authenticated session. It never returns a PMK through a status, profile, browser, log, PPF, BUZZ or GitHub payload. A trusted server-side consumer receives a profile-scoped capability with only `wrapSecret` and `unwrapSecret`; every use revalidates the captured `AuthContext`. It cannot select another profile or read the PMK.

Multiple profiles and sessions may be unlocked concurrently. There is no process-global active Human. Locking Profile A removes A's session key copies and invalidates A's capabilities without affecting an authenticated Profile B.

## Password and recovery lifecycle

Passwords are exact UTF-8 inputs to the reviewed Argon2id contract. The Auth policy accepts long password-manager values and Unicode without normalization or silent truncation, rejects padding-only values and predictable profile-derived values, and does not impose composition rules. A short numeric PIN is not accepted as the only offline secret.

A password change reauthenticates the current password, unwraps and verifies the same PMK, creates a fresh Argon2id salt under the current policy, verifies the replacement envelope, and then commits it. Password change therefore keeps the same PMK and does not bulk re-encrypt PMK-backed project data. All profile sessions are rotated after commit; the caller receives a new session and other stale capabilities fail immediately.

Recovery is offline. Profile creation returns a generated 256-bit recovery secret once in a `pprec1` base64url encoding with a 40-bit transcription checksum. Existing raw base64url recovery secrets remain readable for compatibility. Recovery material has no standalone authentication path and cannot create a vault capability. The only recovery operation unwraps the existing PMK while requiring a new password, verifies new password and recovery envelopes, atomically commits both, rotates every old profile session, and returns a full session plus the newly generated recovery secret only after that commit. PlotPickle stores no plaintext recovery value and has no email, SMS, cloud, universal or operator backdoor.

## KDF maintenance

Every password envelope carries its own Argon2id parameters. Successful password unlock detects an older supported policy only when every current-policy dimension is at least as strong, re-wraps the same PMK with a new salt, verifies it, and commits it. It never replaces a stronger stored dimension with a weaker one.

If the newer KDF or persistent write fails after the old envelope authenticated, login succeeds against the last verified envelope and reports `upgrade-deferred`. The old envelope remains authoritative, so opportunistic maintenance cannot lock out the Human.

## State and cleanup

The public-safe vault states are `uninitialized`, `locked`, `unlocking`, `unlocked`, `locking`, `recovery-required` and `corrupt`. An unsupported future envelope has a distinct internal `AUTH_STATE_UNSUPPORTED` diagnosis. Authentication still gives the same public rejection for an unknown profile, wrong password, wrong recovery material or an AEAD authentication failure.

After PMK copies are wiped and sessions are removed, lock, profile lock, expiry, disable, password change, recovery reset and service shutdown emit an ordered cleanup event. Later project storage, private thumbnail, background-job, retrieval/agent-memory and BUZZ implementations register observers here. Observer errors cannot prevent key wiping or session invalidation, and events contain only the profile id, reason, invalidated-session count and timestamp.

## Crash-safe persistence

`createJsonFileAuthStateStore()` writes a same-directory exclusive temporary file, fsyncs and closes it, parses the completed bytes, and only then uses atomic rename/replace. Before replacement it verifies the current JSON and writes a separately fsynced `.previous` copy. A failure before the final rename leaves the current verified vault in place, while the previous verified generation remains recoverable after a completed commit.

Malformed existing JSON is never overwritten or replaced with an empty vault. Startup fails closed with `AUTH_STATE_CORRUPT`; unsupported future envelope versions fail with `AUTH_STATE_UNSUPPORTED`. Recovery is an explicit operator action, not silent auto-creation that could look like successful data loss.

## Memory guarantee

The implementation overwrites mutable `Uint8Array` PMK, recovery and derived-key copies it owns at lock, expiry, rotation and shutdown boundaries. JavaScript and the operating system cannot guarantee erasure of immutable strings, engine-internal copies, paging, crash dumps or memory inspected by a privileged attacker. The actual guarantee is bounded ownership and lifetime with best-effort zeroing, not a claim that garbage-collected memory is physically unrecoverable.
