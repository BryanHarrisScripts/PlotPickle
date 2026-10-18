# #3096 — Real Windows Cline Challenger: explicit npm launcher and staged initialization

Operator proof: on the original frozen commit `35ef622a812c0a05bbbba00d1b187c925ca45ef2`, the first Engineering Team run had exactly three role starts, two saved role artifacts and one uncertain third Challenger. Managed Pi and Pi Durable 1.3.0 were READY. The private Cline review manifest and state directory existed; `handoff.txt` and the third saved review did not. `cline version` succeeded in PowerShell and returned 3.0.73.

This places the failure **before handoff preparation**: either the CLI version process invocation failed, or the private local `cline --data-dir ... auth` setup failed. The original CLI discarded the error and the original attempt has no typed stage; **do not claim a specific root cause, a Cline inference request, or a verified Challenger**.

## Narrow repair

- Node `execFile("cline")` does not reliably execute npm `.cmd` shims on Windows, although PowerShell resolves `cline` through PATHEXT. Resolve `cline` once with `where.exe`, explicitly select a `cline.exe`, `cline.cmd`, or `cline.bat` path, prefer .exe if both present, and pass that exact path to existing `runPortableCommand`. Its existing governed `windowsBatchInvocation` handles the .cmd variant with strict shell metacharacter rejection.
- Perform the resolution before the Pi Durable role adapter is admitted: the executable path becomes part of the advisory Cline executor identity and immutable route receipt. No implicit auto-install and no new cloud route.
- Record only allowlisted operational phase `cline-version`, `cline-auth`, or `cline-review` in the new sanitized failure report; use a typed `CLINE_LAUNCHER_UNAVAILABLE` code for no Windows CLI binary. **Never copy stderr, API key, prompt, raw model response or home directory into status output.**
- The existing `--plan --auto-approve false` semantics remain unchanged; CLI `auth` uses only dummy loopback identity and its isolated data directory. The source checkout is never Cline's working directory.
- Original failed attempt is immutable. An uncertain started role must NOT auto-retry or resume merely because the launcher fix was merged.

## Independent acceptance

Node fixtures cover `where.exe` output with path and extension differences, .exe preference, absence of launcher, non-Windows no-lookup, launcher route binding, and failure of the local authentication step before handoff/model request. These tests do not simulate a native Windows shell, actual local Cline auth, or real model input/output.

After exact-head W8/W9 truth catalog, seven Architecture Verification layers and green PR merge, the operator can perform **read-only** `where.exe cline` and `cline version` checks and review the existing failed scope's markers. Any new live campaign or new attempt is a separate explicit approval; do not ask the operator to re-dispatch the original uncertain step.

Parent #3096 remains OPEN for actual Windows Pi/Cline/UAT results, deterministic independent verification, and automatic campaigns.