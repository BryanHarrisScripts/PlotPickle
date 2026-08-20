# PlotPickle Auth Core

Status: canonical Auth identity and session-facing contract introduced by #1139. Later vault, storage, session, UI and BUZZ work must consume this boundary instead of creating another Human registry.

## Authority boundary

PlotPickle owns Human authentication. A profile's stable, random `profileId` is its private ownership key; its mutable `displayName` and optional `avatarRef` are presentation only. An operating-system account, hostname, email address, cloud account, Node identity and BUZZ identity are not Human authentication authorities.

The preliminary `core/profiles/local-human-profile-core.mjs` contract from #1135 remains an identity-boundary compatibility fixture. It is not the runtime Auth registry, credential store or session authority. The canonical runtime service is `core/auth/plotpickle-auth-core.mjs`.

Each profile registry record is limited to:

- `profileId`, carrying at least 128 bits of generated opaque material;
- `displayName`, `avatarRef`, `createdAt` and `updatedAt`;
- `status`, `vaultVersion` and declared `authMethods`.

Credential envelopes are stored in a separate credential collection. Projects, story metadata, filesystem paths, BUZZ state, provider details, agent memory, prompts, thumbnails, plaintext secrets and profile master keys are forbidden from registry metadata.

## Offline first run

`desktop-loopback` first run requires only an editable display name and strong password or passphrase. The Auth Core requires at least 12 non-padding characters and rejects known defaults or values equal to the public display/Node identifiers. PlotPickle generates the `profileId`, profile master key, password envelope and recovery envelope through the #1138 crypto contract, returns recovery material deliberately once, and creates an authenticated server-side session. It does not make an Internet request or require email, cloud, BUZZ or an operating-system username.

Recovery material is not retained in plaintext. The profile master key is held only by the service instance for the lifetime of an unlocked session and is wiped when that session is locked, invalidated, expired or closed.

## Explicit access modes

Only two access modes exist:

| Mode | First run | Unauthenticated profile visibility |
| --- | --- | --- |
| `desktop-loopback` | Direct offline creation on the loopback-only Node | Safe local profile summaries may be shown |
| `server-network` | Requires the operator bootstrap proof below | Profile list and registry are not returned |

The mode is explicit persisted configuration. Hostname guessing does not create a hidden third mode or weaken either policy. Network binding, TLS, cookie and request protections are completed by the later server/session issue; this Auth Core supplies the identity and authorization context they must enforce.

## One-time server bootstrap proof

The supported `server-network` setup method is an operator-only call to `createServerBootstrapProof()` before network profile creation. It generates 32 random bytes, returns the unpadded base64url proof once for restrictive local-console or operator-channel delivery, and stores only its SHA-256 digest. Normal status, profile-list and persistent-state diagnostics never return the proof.

The proof expires after 15 minutes by default. The first successful profile creation removes the stored digest and records consumption before returning. A restart reads that consumed state and cannot reopen bootstrap. Blank, default, hostname-derived, Node-derived and otherwise predictable setup credentials are never accepted.

## Service and session boundary

Browser code must call the server-side service; it must not read or write credential files, password envelopes, recovery envelopes or profile master keys. Mutating operations carry an explicit canonical `AuthContext`:

```ts
type AuthContext = {
  sessionId: string;
  profileId: string;
  nodeId: string;
  authStrength: "password" | "password+webauthn" | "recovery";
  issuedAt: string;
  expiresAt: string;
  roles: string[];
};
```

The raw session identifier stays at the server boundary. Safe browser auth status contains configuration/readiness, access mode, visible count policy, resolved profile presentation, strength and expiry, but never the session identifier, key envelopes, KDF output, profile master key or recovery material.

Unknown-profile, disabled-profile and incorrect-password attempts share the same public error. Internal error causes may distinguish failures for safe local diagnostics but must not include submitted secrets.

## Concurrency and lifecycle

There is no process-global active Human. Each `createPlotPickleAuthService()` instance owns a map of concurrent sessions, and every protected operation resolves an explicit `AuthContext`. Profile presentation, lock and disable operations are self-scoped until a later authorization policy introduces a separately tested administrative role. Multiple profiles may share the same display name without collision because authorization joins use `profileId`.

Lock, disable, expiry and service shutdown wipe held profile keys and invalidate matching sessions. Persistent state contains registry metadata, encrypted #1138 credential envelopes and consumed bootstrap state only; session identifiers and unlocked keys are never serialized.

## Node-local persistence

`createJsonFileAuthStateStore()` provides atomic Node-local JSON persistence at an explicit absolute path. It creates private directories/files where the platform supports POSIX modes and replaces state through a same-directory temporary file. The runtime parser fails closed on corrupt JSON, unsupported fields, mismatched Node/access-mode authority, orphan credentials or profiles without credential envelopes.

The in-memory adapter exists for focused tests and embedding. Production callers select the Node-owned file location; this module does not infer identity or authority from a user home directory, environment username or process-global current-profile file.
