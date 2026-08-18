---
name: uat-repair
description: Repair one concrete PlotPickle UAT blocker inside an isolated repository worktree. Use for focused UAT, exhaustive UI/UX UAT, startup-health, or Writer-in-Residence findings that require a tested code change.
compatibility: PlotPickle repository; Windows-native developer flow; local-only Pi/Cline/Mastra repair workers.
metadata:
  owner: plotpickle
  role: repair
  version: "1"
---

# PlotPickle UAT Repair

Use this skill only for a concrete, reproducible PlotPickle UAT finding. AGENTS.md remains the repository constitution; this skill supplies the task procedure and never overrides AGENTS.md.

## Required sequence

1. Read the supplied finding, fingerprint, area, severity, and evidence.
2. Work only inside the isolated repair worktree provided by PlotPickle.
3. Reproduce the failure from the existing evidence or nearest focused test before changing product behavior.
4. Add or strengthen the nearest focused regression so the reported defect is represented by a failing test.
5. Find the smallest architectural root cause. Repair that cause without weakening the assertion, hiding the error, or broadening the change unnecessarily.
6. Apply the BEN Code Quality standard (`skill://plotpickle/ben-code-quality`) while naming, moving, typing, documenting, and organizing changed code.
7. Run the new regression and nearby focused tests. Keep iterating until they pass.
8. Run PlotPickle's deterministic validation gates when the wrapper has not already done so: BEN code-quality evidence when available, focused UAT contracts, and the production build.
9. Finish with a concise summary of root cause, files changed, regression added, BEN findings addressed or remaining, and tests run.

## BEN coding standard

For every repair, keep the resulting code easy for the next coding agent to find and understand:

- use descriptive exported names with stable PlotPickle domain words;
- prefer concept-named files over new generic `utils`, `helpers`, `types`, or `config` buckets;
- keep one authoritative definition per concept and delete stale copies when code moves;
- use precise types rather than weakening constraints to make a repair compile;
- keep important error/log identifiers as searchable literal phrases;
- put short plain-language comments where a search lands when the signature cannot express the key constraint;
- keep orchestration thin and move question-sized implementations into well-named concept modules.

The full BEN procedure is the canonical standard. This summary exists so repair workers preserve the rules even when the host cannot progressively load the companion Skill during a local repair session.

## Boundaries

Do not edit generated dependencies, node_modules, credentials, local runtime secrets, user story data, or UAT evidence to make a failure disappear.

Do not commit, push, merge, open or close pull requests, change GitHub issues, switch branches, or rewrite git history. The deterministic PlotPickle wrapper owns repository and GitHub state.

Do not use paid/cloud fallback or general internet access. The only model endpoint available to this repair job is the local runtime selected by PlotPickle. BEN's external `slop-scan` package resolution, when needed, is owned by the host/CI wrapper rather than the repair model.

Do not merely diagnose the failure. Inspect, edit, and test the repository until the repair is demonstrated or report precisely why it cannot be completed.

## Tool intent

Use repository read/search/edit tools for code changes and local command execution for focused tests and builds. Prefer the narrow PlotPickle MCP tools when the host exposes them: repository status, UAT findings, focused UAT, BEN code-quality review, build, and validate.

## Completion output

Return a short implementation report containing: root cause, changed files, regression coverage, BEN code-quality evidence/findings, validation commands/results, and any remaining risk. Never include hidden reasoning, credentials, full user story text, or unrelated local data.
