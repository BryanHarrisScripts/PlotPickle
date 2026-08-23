# PlotPickle developer-agent stack

PlotPickle uses a small, replaceable developer-agent layer outside the application runtime. The supported first stack is Windows-native and deliberately does **not** require OpenHands or Herdr.

```text
                         PLOTPICKLE REPOSITORY
                                  │
                        AGENTS.md + shared MCP
                                  │
                  deterministic UAT / BEN evidence
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                   PI                         CLINE
             primary / reviewer          primary / reviewer
                    │                           │
                    └─────────────┬─────────────┘
                                  │
                         isolated Git worktree
                                  │
                         local AI abstraction
                                  │
                   LM Studio / llama.cpp / Ollama
                                  │
                       tests → build → focused UAT
                                  │
                              GitHub PR
                                  │
                              GitHub CI
                                  │
                         exact green head only
                                  │
                                MERGE

          BEN deterministic code-quality evidence
                         │
                  read-only Pi review
             recommendations, never authority

          PLOTPICKLE AGENT BENCH (sidecar, not runtime dependency)
                     Pi ↔ Cline on frozen repairs
```

## Responsibilities

`AGENTS.md` is the repository constitution. It contains architecture, change-discipline, privacy, UAT, Git, and completion rules that both Pi and Cline must follow. Tool-specific files may add capabilities but must not contradict it.

The shared MCP server is `scripts/developer-agent-mcp.mjs`. It intentionally exposes a narrow deterministic PlotPickle tool surface: repository status, current focused-UAT evidence, focused contract UAT, production build, and a combined validation gate. It does not expose credentials, arbitrary user folders, hidden reasoning, or a merge tool.

Pi and Cline are interchangeable developer workers. They are not PlotPickle product-runtime dependencies and they do not replace Mastra, Sage, PLAN, Wyrmwood, or the application UAT Repair Agent. A developer can use either as an implementation worker and the other as reviewer/second attempt.

Pi is additionally the default local UAT repair worker. Because that repair capability is part of PlotPickle Full Verification, Full Verification now requires Pi readiness rather than silently treating a missing Pi executable as optional.

## Pi required readiness

The canonical Pi readiness sequence is:

1. resolve an existing Pi executable from `PATH` or npm's global prefix;
2. if Pi is missing and automatic provisioning is allowed, install the reviewed npm package `@earendil-works/pi-coding-agent` with lifecycle scripts disabled;
3. require Git Bash on Windows so PlotPickle does not fall through to the WSL launcher;
4. ensure an approved local coding model is available through the local OpenAI-compatible runtime layer;
5. write PlotPickle-local Pi provider settings below the user's local application-data directory, not into committed project credentials;
6. run a headless Pi smoke request against the resolved local model;
7. only then report the Pi repair worker READY.

The implementation lives in:

- `scripts/pi-worker-runtime.mjs`
- `scripts/ensure-pi-repair-stack.mjs`
- `scripts/verify-pi-repair-worker.mjs`

Full Verification stage 5 self-heals a missing Pi installation where possible. Stage 6 proves Pi can actually invoke the approved local model. There is no cloud fallback and no provider-credential mutation.

Set `PLOTPICKLE_PI_AUTO_INSTALL=0` only when you deliberately want missing Pi to remain a hard setup error instead of allowing PlotPickle to install it. `PLOTPICKLE_PI_COMMAND` can point PlotPickle at an explicit trusted Pi executable when needed.

## Pi project profile

`.pi/settings.json` pins the project extensions rather than following floating latest versions:

- `@dietrichgebert/ponytail` — minimal-diff/YAGNI discipline;
- `pi-subagents` — scout/reviewer delegation;
- `@ff-labs/pi-fff` — fast repository search;
- `pi-mcp-adapter` — access to the shared `.mcp.json` tool boundary.

Model/provider configuration is intentionally not committed. Pi can use whichever approved local or cloud provider the developer configures for interactive development, but PlotPickle's automated repair and Full Verification paths are local-only and use the host-owned local provider profile.

## Pi code-quality / AI-slop review

BEN remains PlotPickle's deterministic code-quality observer. `scripts/run-ben-code-quality.mjs` owns the pinned `slop-scan` evidence and remains part of the authoritative quality system.

After Pi repair readiness is proven, Full Verification also attempts `scripts/run-pi-code-quality-review.mjs`. This is deliberately **advisory**:

- Pi receives BEN/slop-scan evidence;
- Pi may inspect only with `read`, `grep`, `find`, and `ls`;
- Pi cannot edit files, run shell commands, commit, push, open/merge PRs, or change PASS/FAIL state;
- Pi looks for evidence-backed maintainability and efficiency problems such as duplicate implementations, needless wrappers, generic names, directory fan-out, giant orchestrators, repeated defensive boilerplate, dead compatibility paths, repeated work, and other AI-generated code smell;
- recommendations are saved to local verification evidence below the PlotPickle application-data directory;
- BEN, tests, build, focused UAT, Full Verification and repository merge gates remain authoritative.

A Pi recommendation therefore becomes a candidate engineering improvement, not an automatic repair or a reason to weaken a deterministic gate.

## Cline project profile

`.cline/rules/00-plotpickle.md` points Cline back to `AGENTS.md`, and `.cline/mcp.json` exposes the same `plotpickle-dev` MCP server. Cline's native checkpoints, tools, subagents and worktree capabilities remain available, but the shared PlotPickle completion contract remains authoritative.

## Windows setup

From the PlotPickle repository root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-developer-agent-stack.ps1
```

The script checks Node, npm, Git and Bash; installs the Cline CLI and Pi coding agent; installs the pinned Pi project packages; verifies both CLIs; self-tests the PlotPickle MCP server; and validates the Agent Bench catalog.

Full Verification can also self-provision Pi when Pi alone is missing:

```powershell
node .\scripts\ensure-pi-repair-stack.mjs
node .\scripts\verify-pi-repair-worker.mjs
```

To check the complete pre-existing developer stack without installing anything:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-developer-agent-stack.ps1 -VerifyOnly
```

Provider authentication remains local to Pi/Cline. The setup script does not create, read, copy, or commit provider credentials.

## Shared deterministic tools

Both agents can use the same project MCP server. Its five tools are:

- `plotpickle_status`
- `plotpickle_uat_findings`
- `plotpickle_focused_uat`
- `plotpickle_build`
- `plotpickle_validate`

The final gates remain deterministic code, not an agent opinion. A coding agent cannot use this MCP server to merge a PR.

## Agent Bench

The benchmark is a sidecar evaluation system. It is not in the normal build path and it is not required to run PlotPickle.

List frozen tasks:

```powershell
node scripts/run-agent-bench.mjs --list
```

Run one task with Pi:

```powershell
node scripts/run-agent-bench.mjs --agent pi --task sage-help-followup-637
```

Run the same task with Cline:

```powershell
node scripts/run-agent-bench.mjs --agent cline --task sage-help-followup-637
```

Each run creates a temporary detached Git worktree at the historical failure SHA, injects the current `AGENTS.md` as the common rules baseline, installs that revision's dependencies, runs the selected agent headlessly, and then independently measures the resulting change. A passing benchmark requires a code change, a changed test under `tests/`, `git diff --check`, every task verification command, focused UAT contracts, and the production build where specified.

Reports are written below `.artifacts/agent-bench/`. The raw NDJSON/stdout and stderr are preserved locally so additional metrics can be derived later. Current summaries record elapsed agent time, best-effort JSON/tool/usage metrics, changed files, regression presence, deterministic verification results, and overall success.

The frozen tasks are intentionally historical PlotPickle defects that have known good repairs. This lets us compare Pi and Cline against the same repository state instead of judging them on different work.

## Security boundary

Third-party coding agents and Pi extensions execute with developer permissions. Keep versions pinned, review upgrades, and do not give either agent unnecessary access outside its repository/worktree. The shared MCP server has no credential tools and no merge capability. GitHub CI stays independent of the model that wrote the change.

The automated Pi code-quality review is stricter than an interactive coding session: it receives read-only repository tools only and cannot write or execute shell commands.

## What remains replaceable

The durable pieces are `AGENTS.md`, MCP, Git/worktrees, PlotPickle focused UAT, BEN/slop evidence, the verified build, and GitHub CI. Pi, Cline, individual Pi packages, LM Studio, llama.cpp, Ollama, and individual coding models remain replaceable. Agent Bench exists specifically to make those replacements evidence-based.
