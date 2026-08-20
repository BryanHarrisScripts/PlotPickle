# PlotPickle profile-private storage

Issue: #1141
Depends on: #1138, #1139, #1140

## Authority and ownership

`createProfilePrivateStorageService` is the canonical server-side Human-private storage boundary. It accepts a canonical `AuthContext`, obtains a profile vault capability from the #1140 Auth service, and derives the storage root from the capability's opaque `profileId`. A caller cannot select an arbitrary profile path. Browser `localStorage`, display names, OS account names, BUZZ identities, project titles and request-supplied filesystem paths are never authorization authority.

The fixed layout is:

```text
PLOTPICKLE_HOME/
  node/
    identity/
    runtime/
    secrets/
  profiles/
    <opaque_profile_id>/
      vault/
      projects/
      library/
      memory/
      indexes/
      assets/
      buzz/
      credentials/
      settings/
      cache/
```

Every path segment below a profile root is fixed or validated against an allowlist. Profile, project and object IDs cannot contain path separators or traversal components. Existing path components and object files are checked with `lstat`; symbolic-link redirection fails closed. Runtime profile and Node-secret roots are excluded from source control and release packages.

## Human-private encryption

Structured projects, Library metadata, credentials, personal BUZZ state, creative memory, retrieval indexes, settings and caches are stored as versioned `plotpickle-profile-private-object` records. The record exposes ownership metadata required for safe routing but its value is a #1140 `plotpickle-profile-secret` envelope. The envelope's authenticated domain binds:

- authoritative `profileId`;
- fixed storage domain;
- stable object ID;
- storage-contract version.

The service never receives or returns the PMK. It can wrap or unwrap only through a session-bound `ProfileVaultCapability`. A copied Profile A object cannot authenticate under Profile B even if the project/object ID is guessed. Titles, counts, progress, thumbnails, prompts, provider identities and other private metadata live inside the encrypted value rather than a plaintext side index.

The current structured-object contract is bounded at 16 MiB. Large assets must use a separately reviewed streaming/chunked authenticated format before they are placed under the encrypted asset domain; the service does not pretend that buffering arbitrary media is safe.

Writes use a restrictive temporary file, file sync, decrypt/parse verification and atomic replacement while retaining the prior verified record. Malformed or unauthenticated records are quarantined and never replaced with an empty project or registry.

## Library, active project and memory

The encrypted Library registry and every project snapshot are inside the authenticated profile root. All reads, writes, lists, switches and explicit exports resolve the owner from `AuthContext`. A guessed project ID therefore searches only the current Human's project directory.

Active-project selection is keyed by server session and profile in memory. Auth lock/logout cleanup removes active state for the affected profile. It is not a Node-global `activeProject` and it is not restored from another Human's browser state.

Creative memory, retrieval indexes and caches use the same profile envelope and require domain/object IDs that include project and agent scope where applicable. Lock invalidates the capability needed to read them. Operational Node learning remains outside these Human-private roots and must not ingest their contents.

## Legacy migration

The #1122 browser Library, plaintext `PLOTPICKLE_HOME/projects` files and `PLOTPICKLE_HOME/secrets` credential store are migration inputs, not new multi-Human authorization authorities. `createLegacyProjectMigrationSource` and `createLegacyCredentialMigrationSource` make their respective writers fail closed, retain integrity manifests/snapshots and expose values only to the authenticated migration service. Migration requires an authenticated destination profile and an explicit source adapter. The migration sequence is:

1. make the legacy source read-only;
2. inventory record IDs and counts without logging values;
3. create and retain a source snapshot;
4. store an encrypted migration journal in the destination profile;
5. copy, encrypt and verify each project and credential;
6. commit progress after each verified item so the operation is resumable;
7. mark complete only after all records verify;
8. leave legacy source retirement/deletion to an explicit post-verification operation.

An inventory change after the source becomes read-only fails closed. A partial migration never re-enables the old writer. Logs contain profile/source/record IDs, counts, stage and status only—never story text, prompts, credential values or decrypted envelopes. Failed old-store decryption propagates as a migration failure rather than producing empty defaults.

The per-request cookie/session transport that supplies `AuthContext` to application gateways belongs to #1142. Until that transport is present, legacy browser state may be read only by the explicit migration adapter; it must not be treated as server authorization.

## NodeSecretStore

Node-owned operational secrets are deliberately separate. `createNodeSecretStore` writes only below `PLOTPICKLE_HOME/node/secrets` and requires an explicit operator-managed protection adapter. This supports headless/server deployments without requiring an interactive desktop keychain. The adapter may be backed by an operator secret source appropriate to the deployment, but its key is scoped to Node operational records.

`NodeSecretStore` is never passed to `createProfilePrivateStorageService`, cannot unwrap a Human PMK and is not a recovery path. Managed BUZZ relay/runtime secrets and machine H3 routing state are Node candidates. BUZZ Human signer material, personal provider/GitHub/Google authorization and personal prompt/job history are Human-profile candidates.

## Exports and sharing

Canonical internal project storage is encrypted and private. `exportProject` is a separate authenticated operation that creates a deliberate export object for the current owner. It does not mount another Human's directory or PMK. Future collaboration must use explicit grants or controlled artifacts, not implicit cross-profile filesystem access.
