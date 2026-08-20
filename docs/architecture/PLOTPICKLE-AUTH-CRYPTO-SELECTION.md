# PlotPickle Auth cryptographic dependency selection

Status: selected dependency and benchmark evidence for #1138. Later Auth issues consume this contract and may not choose an ad hoc alternative.

## Selected strategy

PlotPickle uses `libsodium-wrappers-sumo` 0.8.4 for:

- `randombytes_buf` CSPRNG output;
- Argon2id v1.3 through `crypto_pwhash`;
- XChaCha20-Poly1305 authenticated encryption;
- constant-time authentication supplied by libsodium;
- best-effort zeroing of owned mutable buffers through `memzero`.

Recovery-wrap and profile-secret subkeys use Node 22's built-in `crypto.hkdfSync("sha256", ...)`. This is a reviewed runtime primitive, not a PlotPickle implementation of HKDF.

The sumo wrapper is required because libsodium.js documents that `crypto_pwhash_*` is not included in the standard wrapper. The Auth module is server-side. Plaintext PMKs and password-derived keys are not shipped to or persisted by browser application code.

## Package and maintenance evidence

| Property | Recorded evidence |
| --- | --- |
| npm package | `libsodium-wrappers-sumo` |
| Selected version | `0.8.4`, exact dependency and integrity-pinned lockfile entry |
| Repository | `https://github.com/jedisct1/libsodium.js` |
| Release activity | npm registry records 0.8.0–0.8.4 releases from January through April 2026; 0.8.4 published 2026-04-19 |
| Maintainers/upstream | libsodium.js by Ahmad Ben Mrad, Frank Denis, Ryan Lester, backed by libsodium |
| Licence | ISC for libsodium.js/wrapper; compatible with inclusion in PlotPickle's AGPL distribution when third-party notices are preserved |
| Transitive runtime | `libsodium-sumo`, resolved by the lockfile |
| Native ABI | None; prebuilt WebAssembly with pure-JavaScript fallback |
| Lifecycle scripts | The locked wrapper declares no install lifecycle script |
| Package size | npm registry metadata records 553,777 unpacked bytes across seven wrapper package files; the underlying sumo runtime is separately locked |

No package is accepted merely because it exists on npm. The dependency remains pinned, reviewed through the lockfile, tested through a known Argon2id vector, and exercised on every supported target.

## Platform and packaging decision

The WASM/pure-JavaScript distribution avoids native addon ABI and compiler requirements. The project CI proves normal installation, contract tests, the KDF benchmark, production build, and platform package staging on:

- Windows x64;
- Linux x64;
- macOS arm64;
- macOS x64 while GitHub's `macos-15-intel` runner remains available.

A separate Linux job installs with `npm ci --ignore-scripts` and reruns the contract/build. Because the selected wrapper has no install script, Auth cryptography does not depend on lifecycle execution. Normal installation remains tested because other PlotPickle dependencies may legitimately require lifecycle behavior.

The platform packager includes `core/`, so the Auth contracts consumed by future server/runtime work are staged with the application source. The package is accepted only when all matrix jobs pass on the exact pull-request head. A future native replacement requires a new architecture review, versioned migration evidence, equivalent target coverage, and compatibility with existing envelopes.

## KDF parameters and benchmark

The contract stores algorithm, Argon2 version, salt, memory, iterations, and parallelism with every password-wrapped PMK.

| Profile | Memory | Iterations | Parallelism | Purpose |
| --- | ---: | ---: | ---: | --- |
| Security floor | 19,456 KiB | 2 | 1 | Lowest accepted non-migration envelope; matches the current OWASP minimum |
| Initial default | 65,536 KiB | 3 | 1 | Stronger interactive desktop/server default selected for initial Auth work |

Repeated local proof on 2026-08-20, Linux x64, Node 24.19.0:

- security floor: approximately 50–76 ms;
- initial default: approximately 200–262 ms.

These measurements cover the `crypto_pwhash` operation after the WASM module is ready. They are not universal performance claims. `npm run benchmark:auth-crypto` records the actual target, runtime, parameters, and timing without serializing the synthetic password or derived key. GitHub CI repeats the benchmark on Node 22.13 for every supported OS/architecture above.

The default is deliberately expensive but remained interactive on the local proof machine. #1140 may tune the default only after reviewing cross-platform CI and target hardware evidence. Existing envelopes remain self-describing, so a later login can re-wrap the same PMK with stronger parameters without bulk re-encrypting project data.

## Allocation and failure behavior

The parser rejects memory above 262,144 KiB, iterations above 10, and unsupported parallelism before allocation. These are resource-safety ceilings, not recommended settings.

If the selected valid Argon2id allocation or computation fails, the library error becomes `KDF_UNAVAILABLE` and the operation fails closed. PlotPickle does not retry with lower memory and does not silently substitute PBKDF2, bcrypt, scrypt, SHA-256, or another fast derivation. Authentication endpoints added later must rate-limit KDF concurrency.

## Portability evidence

The suite fixes a synthetic Argon2id v1.3 vector with:

- password: a repository-only synthetic fixture;
- salt: `000102030405060708090a0b0c0d0e0f`;
- memory: 19,456 KiB;
- iterations: 2;
- parallelism: 1;
- 32-byte result: `ef73eb59d9e44cef62acf45bcadc31b2d0cc8e1fde478cef5b919b212564e4a0`.

Every platform job must reproduce the same result. The fixture is not a real password, key, recovery secret, or production credential.

## Envelope and domain-separation decision

All envelope parsers reject unknown fields and unsupported versions. Binary fields use canonical unpadded base64url. Canonical JSON AAD uses a fixed field order and binds:

- envelope format version;
- profile ID;
- purpose (`password-wrap`, `recovery-wrap`, or `profile-secret`);
- logical secret ID for profile-secret envelopes.

Password-wrap and recovery-wrap use separate structures and derivation contexts. Profile-secret subkeys use a random HKDF salt plus the fixed `plotpickle:profile-secret:v1` context. Copying a valid ciphertext to another profile, purpose, or secret ID fails XChaCha20-Poly1305 authentication.

## Memory handling

The implementation overwrites mutable password/key copies it owns. It does not claim guaranteed erasure of JavaScript strings, V8 copies, paging, crash dumps, or memory inspected by a privileged attacker. Callers own returned plaintext PMK/secret buffers and must keep their lifetime bounded in #1140–#1142.

## Deferred large-file contract

This issue does not invent a whole-file encrypted container for large private assets. #1141 must use a reviewed chunked/streaming construction, preserve authenticated ordering/finalization, and benchmark storage behavior before claiming large-file protection.
