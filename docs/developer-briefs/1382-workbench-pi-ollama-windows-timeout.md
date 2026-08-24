# Issue #1382 — Developer Workbench real Windows Pi→Ollama timeout

## Purpose

Track and repair the remaining real-machine Windows failure after the canonical Workbench Pi readiness repair.

Build #20 (`dae5bb0070d9`) correctly waits the canonical 240-second budget, but Pi still never completes a real inference turn through Ollama and produces no stderr/stdout detail.

Observed state:

- Build green
- GitHub connected
- Local repo current
- Node green
- Ollama + `qwen2.5-coder:7b` detected
- Pi red
- Inference red

Observed diagnostic:

> Pi inference handshake failed for Ollama · qwen2.5-coder:7b. Timeout budget: 240 seconds. Pi produced no stderr/stdout detail.

## Desired proof

The Workbench must demonstrate this real chain before Pi is green:

`Workbench → managed Pi → plotpickle-local provider → Ollama → qwen2.5-coder:7b → real response`

## Investigation

1. Diff current Workbench/Pi execution against the direct Windows Pi launcher and canonical Full Verification Pi smoke path.
2. Inspect child executable, arguments, cwd, environment, provider config and stdin/TTY behavior.
3. Determine whether Pi is blocked waiting for stdin, interactive terminal state, provider bootstrap/config discovery, model response or another child-process condition.
4. Capture bounded command/process diagnostics so a timeout is actionable.
5. Preserve direct Node Windows transport and shell-safe argument handling.
6. Keep canonical real inference as the readiness requirement.
7. No cloud fallback and no product-runtime changes.

## Acceptance criteria

- Real Windows Pi→Ollama inference succeeds or fails with a concrete actionable diagnostic.
- No 240-second silent hang with zero process detail.
- Pi/Inference only become green after real inference succeeds.
- Canonical PlotPickle provider/readiness policy remains authoritative.
- Direct Node Windows Pi launch remains shell-safe.
- Focused regression protects the root cause.
- Developer Workbench Windows package, BEN and Hardware-Aware Local AI are green before merge.

## Workflow

Diff → focused repair → tests → fix concrete failures → exact-head CI → merge only when green.
