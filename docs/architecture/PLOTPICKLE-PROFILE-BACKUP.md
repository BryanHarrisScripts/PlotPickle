# PlotPickle Human Profile Backup and Portable Restore

Issue: #1145

## Authority boundary

A PlotPickle Human backup is a portable copy of one Human profile. It is not a PlotPickle Node clone and it is not an alternate login authority.

The authorities remain separate:

```text
PlotPickle Node identity
  != PlotPickle Human profile
  != BUZZ Human identity
  != Agent identity
```

A backup may move a Human profile between Nodes while the destination Node keeps its own Node identity and runtime/service secrets.

## Recovery key versus backup data

PlotPickle treats these as different things:

```text
password or recovery secret = ability to unlock encrypted profile data
backup file                 = a copy of the encrypted profile data itself
```

A recovery secret cannot recreate projects that no longer exist anywhere. The Human needs an encrypted profile/backup copy plus one valid unlock method.

## Backup format

Version 1 uses the `.ppbackup` logical format:

```text
plotpickle-human-backup v1
  safe public header
    opaque profile id
    opaque backup id
    creation time
  password-wrapped PMK envelope
  recovery-wrapped PMK envelope
  PMK-authenticated encrypted manifest
    Human profile metadata
    object inventory and hashes
    explicit BUZZ/network-identity inclusion flag
  opaque object payloads
    already-encrypted profile-private records
```

The backup manifest is encrypted/authenticated through the existing Profile Master Key capability. Project, Library, memory, credential and settings records are copied in their existing #1141 encrypted representation rather than decrypted and encrypted through a second backup key hierarchy.

The public portion contains only what is required to identify and authenticate the bundle. Story titles, story text, provider values, BUZZ private keys and Human display metadata are not deliberately emitted in plaintext.

## Default inclusion policy

The default backup includes canonical Human-owned encrypted state from:

- projects;
- Library;
- creative-agent memory;
- portable indexes;
- Human assets currently represented by the profile-private encrypted-object contract;
- Human provider/account credentials;
- Human settings.

Regenerable cache state is excluded.

Node-owned state is excluded, including:

- Node signing identity;
- managed BUZZ relay/runtime secrets;
- model files and model inventory;
- ComfyUI installation/cache;
- BEN/Pi/UAT Node-operational state;
- build artifacts and runtime binaries;
- another Human's profile data.

## BUZZ Human identity portability

BUZZ Human identity is optional in v1 backup creation.

When `includeNetworkIdentity` is false, the `buzz` profile domain is not exported. A restored profile remains fully usable for local PlotPickle writing and Community truthfully returns to BUZZ setup/connection state.

When it is true, the Human-owned BUZZ profile material remains encrypted inside the backup. Restoring it preserves the Human's BUZZ identity while the destination PlotPickle Node continues to use its own Node provenance.

Restoring the same BUZZ Human identity to multiple authorized Nodes means each unlocked copy can act for that Human on BUZZ. That does not merge the Nodes or grant one Human access to another Human's profile.

## Creation boundary

Backup creation requires:

- a current authenticated Human profile;
- recent password-or-stronger reauthentication;
- the authoritative AuthContext profile id;
- the canonical profile-private storage root.

The browser cannot select another profile id for export.

Every source profile-private object is authenticated through the existing PMK capability before it is placed in the bundle. Symbolic links are rejected. Quarantine, previous-generation and temporary files are not treated as canonical backup objects.

The file writer uses a restrictive temporary file, verifies the serialized backup contract, fsyncs it, then renames to the requested `.ppbackup` destination.

## Verification without import

A backup can be verified with either:

- the profile password/passphrase; or
- the high-entropy recovery secret.

Private profile metadata is returned only after:

1. the supplied secret unwraps the profile PMK;
2. the PMK authenticates the encrypted manifest;
3. every entry hash matches the manifest;
4. every profile-private envelope authenticates under the original profile/object AAD.

Wrong secrets and tampered data fail closed.

## Restore semantics

The default restore preserves the stable Human `profileId` because encrypted object AAD is bound to that profile id.

The browser-facing v1 restore flow intentionally targets a fresh/unpopulated PlotPickle Node. Live import into an already-populated running Node is not exposed yet because replacing the current singleton Auth registry would invalidate unrelated active Human sessions. Adding a restored profile to a populated live Node requires a future session-preserving Auth import primitive; PlotPickle does not fake that safety by globally restarting authentication underneath other Humans.

The lower-level restore contract remains collision-aware and stages against the destination profile root so offline/maintenance tooling can retain the same cryptographic invariants.

Restore flow on a fresh Node:

```text
read safe backup header
  -> authenticate password/recovery secret
  -> authenticate encrypted manifest
  -> authenticate every encrypted object
  -> reject profile-id collision
  -> stage files under a restore-only directory
  -> verify staged hashes
  -> move verified encrypted profile into its canonical profile root
  -> add the profile + wrapped PMK envelopes to destination Auth state
  -> reload the empty Auth runtime
  -> create a fresh destination session
```

The destination Auth registry retains the destination Node id. The source Node id is never imported.

If a crash occurs after the verified profile directory is moved but before Auth state commits, the directory is an unregistered encrypted orphan rather than an active empty profile. A retry may adopt only an exact digest match for the same authenticated backup; unrelated content fails as a conflict.

If the profile id already exists in the destination Auth registry, v1 fails closed rather than overwriting or merging. A future explicit clone/re-key flow may create a new profile id only by decrypting and re-encrypting/rebinding every object.

## Recovery-based restore

Recovery is not used to create an ordinary restored session with the old password envelope.

When restore uses the recovery secret:

1. recovery unwraps the original PMK;
2. the full backup is authenticated;
3. the Human supplies a new strong password/passphrase;
4. PlotPickle creates a new password-wrapped PMK envelope;
5. PlotPickle generates a new independent recovery secret and recovery-wrapped PMK envelope;
6. the same PMK remains the data root;
7. the old password no longer authenticates the restored profile;
8. the new recovery secret is returned once for the Human to save.

This preserves the #1140 rule that recovery is a reset path rather than a standing alternative full-session credential.

## Server-network restore

An empty `server-network` Node with an active first-run bootstrap proof cannot be remotely claimed by uploading a valid Human backup alone.

The existing one-time server bootstrap proof must also validate. It is consumed when the restored Human becomes the first profile. TLS, Host/Origin and exposure readiness remain owned by #1142.

## Passkeys and WebAuthn

No passkey dependency is introduced by v1 backup/restore.

Password/recovery portability must work across supported Nodes and operating systems without Windows Hello, Touch ID, a browser account or an OS keychain.

Future WebAuthn may be used for step-up/passwordless session authentication. WebAuthn PRF may be evaluated as an additional PMK-wrapping method only when positively supported and only while an independent portable recovery path remains available.

Normal WebAuthn assertions must not be treated as portable symmetric backup keys.

OPAQUE/PAKE remains deferred. PlotPickle does not implement a custom PAKE.

## Security invariants

- No plaintext PMK is persisted in `.ppbackup`.
- Password and recovery secrets are never written into the backup.
- Human provider tokens and BUZZ private keys remain inside PMK-encrypted profile objects.
- Node identity and Node service secrets are never restored from a Human backup.
- Object paths come only from the authenticated encrypted manifest and are restricted to allowlisted profile domains.
- `..`, absolute paths, backslash path substitution and symlink restore are rejected.
- Restore verifies all required encrypted objects before profile activation.
- Existing destination profiles are never overwritten silently.
- Live restore does not terminate unrelated Humans' sessions to make an import appear successful.
- BUZZ remains optional for local profile recovery.
- Passkeys remain optional and cannot become the only recovery mechanism.
