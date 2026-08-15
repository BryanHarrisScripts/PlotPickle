# Local UAT Repair Worker

PlotPickle UAT has a real local repair path rather than an empty GitHub handoff.

## Current loop

`UAT finding -> GitHub issue -> Pi or Cline -> isolated git worktree -> regression first -> root-cause fix -> focused UAT -> production build -> draft PR -> GitHub CI`

The GitHub issue and PR remain the durable collaboration/audit surface. Coding runs on the PlotPickle workstation because that is where the local model runtime and repository are available.

## Worker policy

**Pi is the default developer repair worker. Cline is selectable.** The earlier Mastra/Qwen repair agent remains available explicitly as `mastra-qwen` for compatibility and comparison, but it is no longer the canonical required path.

Commands:

```text
node scripts/run-uat-repair-agent.mjs --worker pi --issue 123
node scripts/run-uat-repair-agent.mjs --worker cline --issue 123
node scripts/run-uat-repair-agent.mjs --worker mastra-qwen --issue 123
```

The complete closed loop uses Pi by default:

```text
node scripts/run-uat-closed-loop.mjs --github-report --repair
```

Cline can be selected for that run:

```text
node scripts/run-uat-closed-loop.mjs --github-report --repair --repair-worker cline
```

## Local coding model requirement

PlotPickle will use only an approved model exposed by a local OpenAI-compatible runtime. Automatic discovery checks these local endpoints:

1. LM Studio — `http://127.0.0.1:1234/v1`
2. llama.cpp — `http://127.0.0.1:8080/v1`
3. Ollama — `http://127.0.0.1:11434/v1`
4. generic local OpenAI-compatible server — `http://127.0.0.1:8000/v1`

Qwen3.8-27B remains a preferred repair model. The approved automatic coding-model family also recognizes selected Qwen Coder, Devstral, Codestral, DeepSeek Coder, and GPT-OSS coding-class local models. An operator may specify a local model and endpoint explicitly with `--model` and `--endpoint`.

PlotPickle deliberately refuses to fall through to:

- Sage's Fast model;
- PLAN's Quality model;
- Pi/Cline's ordinary cloud defaults;
- a paid provider merely because the local coding model is missing.

No suitable local coding model means **repair NOT READY**. UAT discovery and GitHub issue reporting still work.

Check readiness without modifying the repository:

```text
node scripts/run-uat-repair-agent.mjs --preflight
node scripts/run-uat-repair-agent.mjs --worker cline --preflight
```

## Pi local isolation

For automated repair, PlotPickle gives Pi a dedicated local agent configuration under the PlotPickle application-data directory. It writes a `plotpickle-local` OpenAI-compatible provider pointing only at the discovered local runtime and invokes Pi in ephemeral/offline mode.

The repair process sets Pi offline/update/telemetry controls for that run and explicitly selects the local provider/model. The repository's `AGENTS.md` and pinned `.pi/settings.json` remain the shared development rules/profile.

## Cline local isolation

For automated repair, PlotPickle gives Cline a dedicated local data directory under PlotPickle application data. The wrapper seeds an `openai-native` configuration with the discovered **local** base URL and local model ID, then invokes Cline headlessly with that isolated data directory.

This prevents a normal personal Cline cloud configuration from becoming an accidental repair fallback.

## Isolated worktree and repair contract

The deterministic wrapper creates a separate git worktree from `origin/main` under PlotPickle local application data. Pi, Cline, and the optional legacy Mastra worker all receive the same repair contract:

1. inspect the UAT evidence;
2. reproduce the defect;
3. add or strengthen the focused regression first;
4. find and fix the smallest architectural root cause;
5. run relevant tests and iterate.

Workers are told not to commit, push, merge, alter GitHub state, weaken UAT, edit credentials, or modify user story data. Git/GitHub publication remains deterministic wrapper code after validation.

## Deterministic validation

Before a repair PR is created, the wrapper requires:

- a non-empty repository diff;
- `git diff --check`;
- the focused UAT contract registry;
- the production build.

Only after those pass does the wrapper commit and push the repair branch and create a **draft** PR. GitHub CI remains independent and no repair worker merges its own PR.

## Closed-loop preflight

The closed-loop runner performs repair readiness **once** before iterating findings. If Pi/Cline is missing or no approved local coding model is available, the repair phase is skipped once with a clear message. It does not repeat the same missing-model stack trace for every finding.

Startup uses the same preflight. `READY` therefore means a developer worker and local coding model are actually available; otherwise startup reports `NOT READY` while leaving PlotPickle and UAT discovery usable.

## GitHub handoff

The `uat:auto-repair` workflow does not create an empty branch or placeholder PR. GitHub Actions cannot see the workstation's LM Studio/llama.cpp/Ollama runtime. It records the local command instead, with Pi as the default and Cline selectable.

Architecture boundary:

- **UAT** discovers and fingerprints defects.
- **GitHub** stores findings, PRs, and CI state.
- **Pi/Cline** perform repository reasoning/editing with an approved local coding model.
- **Mastra/Qwen** remains an optional legacy worker.
- **Deterministic wrapper** owns branch/validation/publication state.
- **GitHub CI** decides whether the produced repair is mergeable.
