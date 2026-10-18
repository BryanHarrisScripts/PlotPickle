# #3112 — Native Windows UAT dev-toolchain admission

## Real evidence / classification

The first Windows Engineering Team UAT attempted contracts-only checks on exact
commit `24b4c76f6282afcfe4e6138029cf6d3f7a60099c`.
Private scope `0eba9647cb88fc2d72f469fcbcba3e637a42d1d50a35b6f4330bb51afe0e694b`
reached an actual Node child exit, but the report said observed-fail with three
file-level ERR_TEST_FAILURE failures in #593, #594 and #595.

The owner's raw TAP now proves that all three tests failed **before their
assertions** with `Error: Cannot find module 'typescript'`.
The repo declares a pinned devDependency
`"typescript": "npm:@typescript/typescript6@6.0.2"`.
This is a missing local toolchain dependency, not verified failure of
LEARN/PLAN product behavior. The original scope remains immutable.

## Post-install Windows proof: wrapper/API semver are deliberately different

A fresh owner-authorized `npm.cmd ci --include=dev` successfully installed 591
packages, then the original #3112 doctor reported a **false** version mismatch:
expected `6.0.2`, observed API `6.0.3`.

The trusted repository `package-lock.json` declares two separate exact
installations:
- `node_modules/typescript`: `@typescript/typescript6@6.0.2`, pinned
  npm alias and thin TypeScript 6 compatibility wrapper.
- `node_modules/@typescript/old`: real `typescript@6.0.3`, selected
  by wrapper dependency `npm:typescript@^6`.

The wrapper re-exports the `@typescript/old` compiler API, so
`require("typescript").version === "6.0.3"` **is correct**, not evidence
of installed alias version drift. Microsoft TypeScript issue #63866 and
a separate npm comparison under oven-sh/bun#33834 document this layout.

The corrected doctor separately checks manifest, package-lock schema/root,
locked wrapper identity/version/integrity/dependency, locked compiler identity/
version/integrity, installed wrapper metadata, installed compiler metadata,
`transpileModule` export and **runtime compiler API equality to the exact
lock's compiler version**. No arbitrary `6.x` bypass is authorized.
Conflicting, missing, swapped, or unusable packages fail closed with a
non-sensitive code. No npm installations or user data reads are performed.

Peer dependency warnings for ESLint 10 vs ESLint 9 peer ranges, and
npm install-script blocks for esbuild, unrs-resolver and workerd were
recorded in the same user log. They are **separate unproven readiness
risks** and should not be "fixed" by blindly approving install scripts
or changing the lockfile. TypeScript toolchain `READY` only permits
contracts-only admission; it proves neither browser UAT nor normal build.

## Change

`node scripts/windows-uat-control.mjs --doctor` is a read-only local
prerequisite check, anchored to the repository `package.json` and installed
TypeScript `version` / `transpileModule` capability. It distinguishes:
- `READY` and the pinned observed TypeScript version;
- `TYPESCRIPT_NOT_INSTALLED`, `TYPESCRIPT_UNUSABLE`,
  `TYPESCRIPT_VERSION_MISMATCH`, `TYPESCRIPT_PIN_UNVERIFIED`,
  `PACKAGE_MANIFEST_UNAVAILABLE`.

Do not expose raw package initialization exceptions or user-specific Windows
paths. Exit is nonzero if not ready; the doctor does not run UAT, install a
dependency, contact a cloud endpoint, or authorize an agent.

An explicit `--start` runs the same preflight **before** allocating the
write-once attempt or launching any worker. A running worker checks it again
after exact-SHA validation and before launching `run-uat-autopilot.mjs`.
Readiness changes after reservation produce an immutable `blocked` receipt,
never `observed-fail` or false `observed-pass`. Do not automatically replay.

The operator can inspect using:

    cd C:\Users\bryan\plotpickle
    node scripts/windows-uat-control.mjs --doctor
    npm ls typescript --depth=0

The TypeScript package must be restored using the project's reviewed, locked
dependency installation workflow, explicitly authorized by the owner; the
runner must not call npm install, edit the lockfile, remove existing private
installations, or promise quota-free AI. After toolchain readiness and a green
repair PR, use a **separately authorized** new UAT attempt (with a new exact
commit or explicit `--attempt`), preserving original evidence.

The tests are synthetic fixture evidence and do not prove that the owner's
Windows TypeScript installation was repaired. Neither browser UAT nor
Chat-to-Windows remote command bridge is established. The Software Factory
remains governed by W8/W9 exact digest bindings and CI; the Story Factory's
actual LEARN/PLAN product behavior is separately tested only after admission.
