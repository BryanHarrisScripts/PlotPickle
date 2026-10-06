# Developer brief — #2789 Windows startup Git-free braces runtime

## Observed failure

On October 6, 2026, a real Normal PlotPickle launch from current main reached the first persistent-runtime installation for dependency fingerprint `9c60006f45d65964e9ab` and failed before the server could start.

npm 12.2.0 returned `EALLOWGIT` because the #2706 braces security bridge resolved through `git+ssh://git@github.com/FSDevelop/braces.git#28d440b5dd449dbf1fe6f3506cf94ecca4d02660`. The launcher then attempted Rolldown and Sharp repairs against an incomplete install and repeated the same forbidden dependency in its interrupted-download retry. Windows also reported transient `EPERM` cleanup failures while removing incomplete package directories.

This is a repository dependency-policy conflict, not a story-project, disk-space, optional-provider, or generic network failure.

## Security boundary

Do not remove the #2706 braces depth guard and do not globally enable Git package fetching.

The reviewed source remains braces 3.0.3 from exact upstream commit:

`28d440b5dd449dbf1fe6f3506cf94ecca4d02660`

with exact upstream tree:

`0ffbc33a63a6f2365865e69b4217683268067847`

PlotPickle owns the runtime copy under `vendor/braces-3.0.3-depth-guard`. The provenance record pins every shipped upstream package-file Git blob SHA and a canonical SHA-256 manifest digest. The runtime manager verifies those bytes before staging the file dependency into the persistent runtime.

## Deterministic install repair

The root manifest declares braces as `file:./vendor/braces-3.0.3-depth-guard` and uses the npm `$braces` override so transitive consumers converge on that direct reviewed package. The lock represents `node_modules/braces` as a local link and contains no Git transport for that package.

Because PlotPickle installs from manifests copied into a separate persistent runtime, the runtime manager stages verified vendored packages alongside those copied manifests before npm runs. This preserves the existing replaceable-program / reusable-runtime boundary.

A production dependency-policy preflight rejects `git:`, `git+*`, `github:`, or `git@` package transports before npm installation. A policy failure is non-retryable: the launcher reports the repository dependency error and stops rather than running native repair or repeating the same install.

A normal npm install failure still receives one bounded interrupted-download repair. Rolldown and Sharp targeted repair only run after npm itself completed successfully.

## Windows cleanup hardening

Persistent-runtime directory removal uses Node's bounded recursive removal retry support with five retries and a 200 ms delay. This addresses transient Windows `EPERM` locks without unbounded waiting or broad process termination.

## Product proof

Fast cross-platform regression coverage proves exact braces provenance, byte hashes, manifest digest, Git-free lock transport, npm policy behavior, installer control flow, EPERM retry settings, and the corrected OpenPencil startup wording.

The existing Windows build / installer Product Gate additionally creates an empty temporary runtime, copies only the production manifests and verified vendored package, runs the same production `npm ci --omit=dev`, verifies the installed Vite/Rolldown native/Sharp runtime, resolves braces from the staged local package, and exercises the normal and hostile-nesting braces behavior.

The proof writes `.artifacts/runtime-2789/windows-cold-runtime.json`.

## Acceptance

- Exact #2706 braces patch source is retained with immutable provenance.
- Production package metadata contains no Git transport for braces.
- The persistent runtime receives the verified vendored package before npm installation.
- `EALLOWGIT`-class dependency-policy conflicts stop without the interrupted-download retry.
- Native and Sharp repair do not run after a failed npm package install.
- Windows cleanup uses bounded EPERM retries.
- A real empty-runtime Windows production install completes and verifies Vite, Rolldown native binding, Sharp, and braces behavior.
- OpenPencil startup wording says explicit named surfaces are opened from PlotPickle, not only from Settings.
- Focused tests, production build, impact-selected Windows Product Gate, and exact-head Architecture Verification pass before merge.
