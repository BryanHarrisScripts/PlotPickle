# Local UAT Repair Agent

PlotPickle UAT now has a real repair worker rather than an empty GitHub handoff.

## What changed

A blocker can now move through this local-first loop:

`UAT finding -> GitHub issue -> local Repair Agent -> isolated git worktree -> regression first -> root-cause fix -> focused UAT -> production build -> draft PR -> GitHub CI`

The GitHub issue and PR remain the durable collaboration/audit surface. The coding agent runs on the PlotPickle workstation because that is where the local model runtime and repository are available.

## Repair model

The dedicated default repair model is **Qwen3.8-27B**. It is not the Sage Fast model and it is not the PLAN Quality model. PlotPickle looks for a matching model through the local OpenAI-compatible endpoints in this order:

1. LM Studio — `http://127.0.0.1:1234/v1`
2. llama.cpp — `http://127.0.0.1:8080/v1`
3. Ollama — `http://127.0.0.1:11434/v1`
4. generic local OpenAI-compatible server — `http://127.0.0.1:8000/v1`

The repair runner deliberately refuses to silently downgrade to the normal Fast or Quality story models. A different model/endpoint can be supplied explicitly with `--model` and `--endpoint`, but that is an operator override rather than the automatic default.

Qwen3.8-27B is on-demand. It does not remain loaded for ordinary Sage, PLAN, or Wyrmwood usage.

## Real coding tools

The repair agent is a Mastra `Agent` with a Mastra `Workspace` backed by a `LocalFilesystem` and `LocalSandbox`. That gives the agent repository file inspection/editing and command execution instead of asking a chat-only model to describe a fix.

The deterministic wrapper creates a separate git worktree from `origin/main` under the local PlotPickle application-data directory. The agent never receives the user's main working directory as its writable workspace.

The agent is instructed to:

1. inspect the UAT evidence;
2. reproduce the defect;
3. add or strengthen the focused regression first;
4. find and fix the architectural root cause;
5. run the relevant tests and iterate until they pass.

The agent is explicitly told not to commit, push, merge, alter GitHub state, hide a failure by weakening UAT, edit credentials, or modify user story data. Git/GitHub publication is owned by deterministic wrapper code after validation.

## Deterministic validation

Before a repair PR is created, the wrapper requires:

- a non-empty repository diff;
- `git diff --check`;
- the focused UAT contract registry;
- the production build.

Only after those pass does the wrapper commit and push the repair branch and create a **draft** PR. GitHub CI remains independent and the repair agent never merges its own PR.

## Commands

Run the complete closed loop after local UAT:

```text
node scripts/run-uat-closed-loop.mjs --github-report --repair
```

Repair one already-reported GitHub UAT issue:

```text
node scripts/run-uat-repair-agent.mjs --issue 123
```

Repair one fingerprint from the local findings file:

```text
node scripts/run-uat-repair-agent.mjs --report <uat-findings.json> --fingerprint <fingerprint>
```

Use `--dry-run` to resolve the finding/model and create the isolated worktree without letting the model edit the repository. Use `--keep-worktree` when a developer wants to inspect the worktree after the run.

## GitHub handoff

The `uat:auto-repair` workflow no longer creates an empty branch and placeholder PR. GitHub Actions cannot see the workstation's LM Studio/llama.cpp/Ollama runtime, so it now records that the issue is ready for local repair and points at the local repair command.

This preserves the architecture boundary:

- **UAT** discovers and fingerprints defects.
- **GitHub** stores findings, PRs, and CI state.
- **Qwen3.8-27B Repair Agent** performs repository reasoning/editing locally.
- **Deterministic wrapper** owns branch/validation/publication state.
- **GitHub CI** decides whether the produced repair is mergeable.
