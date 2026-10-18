# #3098 — Independent Cline counter-review (bounded Phase C)

Parent #3096; continues merged #3097/#3101/#3102/#3103/#3104.

## What is implemented

The default Engineering Team local path is unchanged: read-only Pi review and
focused deterministic UAT with Pi Durable explicit checkpoint/recovery. An
explicit alternative challenger dispatch is now available:

    $head = git rev-parse HEAD
    $base = git rev-parse HEAD~1
    node scripts/engineering-team/run-local.mjs --run --head $head --base $base --task pr-3098 --roles scout,tester,challenger --challenger cline --durable

The CLI requires a clean checked-out exact commit and an ancestor base. The
actual attempt must be run on the operator's Windows host; GitHub CI synthetic
fixtures do NOT establish actual model I/O.

With --challenger cline, Cline CLI must be reviewed version 3.0.73, already
installed; user-approved local Ollama/LM Studio/llama.cpp-compatible coding
model is used. No cloud fallback, no auto-install. Cline runs in headless
**plan mode** with --auto-approve false, no --yolo/--zen, local backend, no
shell commands permitted through Cline's command-permissions layer, isolated
state/data directory and empty hooks directory. Its checkout working directory
is NOT the source repo. Only selected bounded ordinary changed code files
are copied into a private isolated review bundle, with SHA256 manifest and a
small untrusted previous-agent handoff. Files named .env, keys, secrets and
private materials are excluded; file symlinks and oversized/binary sources
are blocked. The original repo is never given to Cline as cwd.

The CLI's reviewed version and a complete run_result are mandatory. Its
output is source-hashed candidate evidence only, never a test PASS or
corroborated finding. Model and endpoint/executable/changed-file selection
bind the route receipt used by Pi Durable; resuming an interrupted model
submission never repeats an unknown request. The challenger executor identity
is distinct from the Pi and focused-UAT adapters, but independence of model
weights, provider backend, network confinement or underlying process isolation
is **not** established solely by distinct CLI binaries.

## Correct safety claims

- Cline default auto-approval is enabled upstream. The new adapter explicitly
  disables it, uses Plan, and denies CLI command execution.
- Cline's own tools are still third-party executable code. An isolated bundle
  and tool-approval flags are governance controls, not a proven kernel/OS
  filesystem/network sandbox. No *absolute* "read-only process" claim.
- Private work happens only after the explicit user-approved on-demand CLI
  command. Normal startup/status remains no-inference.
- External signed BUZZ, code mutation, GitHub posting, merging, profile
  credential access and unsupervised background scheduling are not granted.
- No token/cost measurements or verified defect counts are fabricated.

## Acceptance separation

CI's node fixtures verify exact-head command selection, selected second CLI
tool restrictions, source bundle integrity and data leak boundaries, output
schema, pinned version, stale/unsafe arguments, and independent actor names.

Real operator acceptance still requires an on-device Windows Cline 3.0.73
model response, separately observed Pi Scout and focused UAT, active Pi
Durable checkpoint close/reopen with original evidence, source code unchanged,
and a third deterministic verifier. A green Cline model response is not an
independent finding verification or full Engineering Team operation.

Keep #3098 and #3096 OPEN after this slice. Continue #3008 live agent I/O,
then #3099 BUZZ matched experiments and #3100 schedule/operator controls.
