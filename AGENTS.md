# PlotPickle Development Rules

These rules are the shared development contract for human developers and repository-aware coding agents. Pi and Cline both load this file. Tool-specific configuration may add capabilities, but it must not weaken or contradict these rules.

## Platform

- PlotPickle development is Windows-native first. PowerShell and the existing Windows startup flow are supported paths.
- Do not require WSL, Docker, Herdr, OpenHands, or another orchestration layer for ordinary development.
- Keep paths and scripts cross-platform when practical, but do not break the Windows path to achieve that.

## Architecture

PlotPickle is global at the foundation and modular at the feature level:

`PlotPickle Core -> Modules & Plugins -> Agents -> AI Runtime Abstraction -> OpenAI-compatible runtime -> local/cloud providers`

- Shared contracts, design tokens, project state, navigation, provider abstractions, UAT, and observability belong in the core/foundation layer.
- LEARN, PLAN, Wyrmwood, Settings, agents, and providers remain modular.
- New capabilities should become a shared capability, module, plugin, agent, or provider adapter rather than a feature-specific special case.
- Preserve provider independence. Do not hard-code LM Studio, llama.cpp, Ollama, or one model as the only path when an existing abstraction exists.
- Mastra remains the application-agent runtime. Pi and Cline are developer tools outside the PlotPickle product runtime.

## Change discipline

Use the smallest safe change that solves the actual problem.

1. Check whether the behavior already exists before adding anything.
2. Prefer deletion, reuse, standard library, browser/platform features, and already-installed dependencies before adding new dependencies.
3. Fix root causes rather than weakening tests or hiding errors.
4. Do not rewrite unrelated files during a focused repair.
5. Preserve user-authored story/curriculum content unless the task explicitly changes it.
6. Do not silently convert failed AI output into fake completed work.

## Git and worktrees

- Never develop directly on `main`.
- Use a branch or isolated git worktree based on current `main`.
- Do not force-push, rewrite shared history, or delete unrelated branches.
- Coding agents may edit and test their worktree. They must not merge their own work.
- GitHub CI is an independent gate. Merge only the exact tested head after required checks are green.

## Testing and UAT

The active focused UAT scope is Startup, Settings, Foundations/LEARN, PLAN, and Wyrmwood.

- Add or strengthen the nearest focused regression for behavior changes.
- Keep `config/uat-autopilot-registry.json` as the ownership registry for focused UAT.
- Do not pull the legacy whole-app UAT suite into routine focused validation.
- Required minimum validation for product changes is the relevant focused regression, focused UAT contracts, and the production build.
- When CI fails, inspect the exact failing assertion/log. Fix the product or stale contract for the right reason; do not paper over it.

Useful commands:

```text
node scripts/run-uat-autopilot.mjs --contracts-only --artifact-root .artifacts/uat-focused
npm run build
node scripts/run-uat-closed-loop.mjs --github-report --repair
```

## Developer agents

The supported developer-agent candidates are Pi and Cline.

- They are interchangeable workers, not product dependencies.
- Both use this `AGENTS.md` as the common rules source.
- Shared executable developer tools should be exposed through the repository MCP boundary where that improves portability.
- Pi may use the pinned project packages in `.pi/settings.json` for minimal-diff guidance, subagents, repository search, and MCP access.
- Cline may use its native rules, MCP, checkpoints, subagents, and worktrees, but it must follow this file first.
- Do not add OpenHands or Herdr to the required stack.

## Agent skills

PlotPickle separates agent procedure from agent capability.

- MCP and native tools describe what an agent can do. Skills describe how PlotPickle expects a specific job to be done. This file remains the higher-level constitution.
- `config/agent-skills.json` is the lightweight skill discovery registry. Skill bodies live under `.agents/skills/<skill-id>/SKILL.md` and should use progressive disclosure rather than being copied into every system prompt.
- A skill must never grant permissions the host or this file does not already allow. Tool, credential, git, network, privacy, and merge boundaries remain authoritative outside the skill.
- Pi must load the `uat-repair` skill before performing a UAT repair. The deterministic repair wrapper remains responsible for worktree creation, validation, commit/push, draft PR creation, and GitHub state.
- Keep skills model-independent and runtime-independent. A newer local model should be able to inherit the same procedure without a model-specific prompt rewrite.
- Skill metadata may carry `skill://` URIs so the same packages can later be exposed through MCP Resources without changing the skill body.

## Agent review pattern

For non-trivial changes, prefer separation of concerns:

- scout: locate the relevant code and contracts;
- implementer: make the smallest repair;
- reviewer: inspect correctness, regressions, security, and unnecessary complexity;
- deterministic gates: run tests/build/UAT independently of the reviewer.

A reviewer should not approve merely because the implementation agent says the task is complete.

## Local AI

- Local developer models connect through provider/runtime abstractions rather than product-specific hard-coding.
- Large repair/coding models are on-demand; do not keep them resident if that harms Sage, PLAN, or ComfyUI resource availability.
- Never commit API keys, tokens, passwords, provider credentials, local model paths containing secrets, or user conversation/story data.

## Observability and privacy

- Operational traces may include agent/tool/model/runtime/timing/status metadata.
- Do not store hidden reasoning, full prompts, full model responses, story text, or credentials in developer telemetry.
- Evidence should be sufficient to reproduce a failure without leaking private content.

## Completion contract

A change is complete only when:

1. the requested behavior is implemented;
2. the relevant regression exists and passes;
3. focused UAT contracts pass;
4. the production build passes;
5. the diff contains no accidental or unrelated changes;
6. the PR describes what changed and why;
7. GitHub CI is green on the exact head that is merged.
