# PlotPickle Auth threat model

Status: canonical security boundary for #1137 and first implementation contract for #1138.

This document defines what PlotPickle Auth is designed to protect, what it cannot truthfully promise, and which controls later Auth work must preserve. It applies to the offline desktop Node and to an explicitly configured server Node. BUZZ, an operating-system account, a browser cookie, a display name, a Node identity, and an Agent identity are not substitutes for PlotPickle Human authentication.

## Assets and authorities

The protected assets are:

- the Profile Master Key (PMK) and its password/recovery-wrapped envelopes;
- Human-profile projects, Library state, drafts, private assets, thumbnails, retrieval indexes, and agent memory;
- profile-scoped BUZZ Human private keys, Community membership caches, OAuth tokens, provider credentials, and personal settings;
- server-side sessions and authorization state;
- recovery material and backup envelopes;
- the boundary that prevents one Human profile from learning another profile's private metadata or content.

The Node identity proves installation/device provenance. A PlotPickle Human profile owns private workspace authority after authentication. A BUZZ Human identity signs social actions after the PlotPickle profile is unlocked. Agents receive bounded, profile-scoped authority. None of these identities may silently substitute for another.

## Trust boundaries

The principal boundaries are:

1. an unauthenticated browser or client to the PlotPickle server;
2. one authenticated Human session to another Human profile;
3. encrypted profile storage to bounded decrypted server memory;
4. browser-visible presentation state to server-side authorization state;
5. profile-private data to Node-scoped runtime services;
6. local private state to BUZZ, GitHub, providers, exports, logs, diagnostics, and backups;
7. one process/session lifetime to the next lock, logout, profile switch, or restart.

## In scope

PlotPickle Auth must address:

- one Node hosting multiple Human profiles under the same operating-system account;
- remote unauthenticated clients when server-network mode is enabled;
- copied or stolen profile storage while the profile is locked;
- cross-profile insecure direct object reference, path traversal, and identifier substitution;
- stale sessions after logout, lock, profile switch, profile disablement, password change, or recovery;
- accidental cache, retrieval, agent-memory, thumbnail, recent-item, and UI-state leakage;
- password, PMK, recovery material, credential, OAuth token, and BUZZ private-key leakage through browser persistence, logs, PPF, export, diagnostics, exceptions, or GitHub evidence;
- ciphertext/tag/nonce tampering and valid-envelope substitution across profiles, purposes, or logical secret identifiers;
- offline brute-force attempts against copied password-wrapped profile keys;
- online brute-force and resource-exhaustion attempts against authentication endpoints;
- malformed or attacker-selected KDF parameters intended to force unsafe fallback or excessive allocation;
- concurrent server sessions that must never depend on a process-global current user;
- migration of existing Node-global private state without silent loss or cross-profile adoption.

## Explicitly out of scope

A malicious root/Administrator controlling the host while a profile is unlocked is out of scope. PlotPickle also does not claim to protect against:

- compromised PlotPickle binaries or dependencies;
- kernel malware, debugger attachment, process-memory inspection, or hostile runtime instrumentation;
- physical attacks against an already-unlocked device;
- a malicious server operator while that server is actively processing a Human's decrypted data;
- guaranteed erasure of immutable JavaScript strings or garbage-collected copies from process memory;
- recovery of data after a user has lost both the password and independent recovery material.

Protecting a Human from the operator of the server processing that Human's data would require a separate client-side end-to-end encryption architecture. PlotPickle does not claim that property in #1137–#1146.

## Threats and mandatory controls

### Offline vault theft and password guessing

Each profile receives an independent random 256-bit PMK. The PMK is not derived from a password, display name, profile ID, Node identity, operating-system account, or BUZZ identity. Passwords derive a wrapping key through Argon2id using a unique random salt and self-describing parameters. Recovery uses separate high-entropy random material and a separate derivation context.

The minimum accepted password KDF is Argon2id v1.3 with 19,456 KiB, two iterations, and parallelism one. The initial default is 65,536 KiB, three iterations, and parallelism one. A weaker algorithm is never a silent fallback when Argon2id cannot initialize or allocate memory. Online authentication must later add rate limits and concurrency limits because a deliberately expensive KDF can otherwise become a denial-of-service tool.

### Ciphertext tampering and envelope substitution

Profile-key and small-secret envelopes use XChaCha20-Poly1305 authenticated encryption. Deterministic canonical AAD binds the format version, profile ID, purpose, and logical secret ID where applicable. A valid ciphertext copied to another profile or purpose must fail authentication. Parsers reject unknown fields, malformed canonical base64url, unsupported versions, parameters below the security floor, and parameters above the resource ceiling before decryption or unsafe allocation.

### Cross-profile object and path access

Later storage and session work must authorize every private object through the authenticated server-side profile ID. Display names, browser paths, form fields, BUZZ identifiers, and client-provided ownership fields are never authority. Storage paths use opaque validated identifiers, reject traversal, and resolve beneath the selected profile root. A Node-global active-user variable is forbidden in concurrent server mode.

### Browser, cache, and agent leakage

Passwords, PMKs, recovery secrets, raw profile credentials, and plaintext private envelopes never enter localStorage, sessionStorage, PPF, URL parameters, client logs, service-worker caches, analytics, or GitHub evidence. Lock/logout/switch invalidates the server-side session and clears Human-scoped agent, retrieval, recent-item, private preview, and BUZZ signer context before another profile activates.

### Logs, diagnostics, and exports

Operational evidence may identify contract version, operation type, timing bucket, profile-safe opaque correlation ID, and success/failure category. It must not contain plaintext passwords, password length, PMKs, recovery material, encryption keys, ciphertext-derived secret previews, BUZZ private keys, OAuth/provider credentials, full prompts, private story text, or private paths. Export is an explicit Human action and does not change the canonical encrypted internal ownership boundary.

### Server mode

Server-network mode fails closed unless its later #1142 transport, cookie, CSRF, origin, rate-limit, and per-request authorization requirements are active. Loopback binding is not a substitute for Human authentication on a shared computer. BUZZ authentication does not unlock a PlotPickle profile.

## Cryptographic and memory-lifetime boundary

PlotPickle uses reviewed library primitives selected in `PLOTPICKLE-AUTH-CRYPTO-SELECTION.md`; it does not implement Argon2id, XChaCha20-Poly1305, HKDF, HMAC, or a CSPRNG itself.

Owned mutable `Uint8Array` copies of passwords and keys are overwritten with libsodium's `memzero()` when an operation finishes. This reduces accidental reuse but is not a guarantee that every runtime or garbage-collected copy was erased. JavaScript strings are immutable, V8 may copy values, and operating-system paging or crash capture may retain process memory. Later code must minimize plaintext lifetime without overstating secure erasure.

Large private assets are not encrypted as one unbounded in-memory AEAD message by this issue. #1141 must select a reviewed chunked/streaming storage contract with authenticated ordering and finalization before claiming large-asset encryption.

## Required regression boundary

The deterministic #1138 suite must continue to prove correct unwrap, wrong-password failure, ciphertext/tag/nonce/AAD tamper failure, cross-profile substitution failure, purpose separation, KDF parameter roundtrip and floor enforcement, random PMK/salt/nonce uniqueness, locked Argon2id portability output, secret redaction, lifecycle-script-disabled installation, cross-platform execution, packaging, and production build.

## Primary references

- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- libsodium password hashing: https://doc.libsodium.org/password_hashing
- libsodium XChaCha20-Poly1305: https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction
- libsodium.js repository and wrapper documentation: https://github.com/jedisct1/libsodium.js
- Node.js `crypto.hkdfSync`: https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptohkdfsyncdigest-ikm-salt-info-keylen

OPAQUE RFC 9807 remains future research. It is not implemented by this contract and must not be implemented from scratch.
