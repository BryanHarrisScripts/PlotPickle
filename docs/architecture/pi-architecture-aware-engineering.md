# Pi architecture-aware engineering

Status: bounded developer-tool extension. Pi remains outside the PlotPickle product runtime and has no merge authority.

## Purpose

PlotPickle uses Pi as an optional repository-aware scout and independent reviewer around the normal engineering loop:

```text
issue / developer brief
  -> Pi impact map
  -> exact red-capable diagnosis when applicable
  -> smallest implementation
  -> focused regression
  -> independent Pi Architecture review
  -> independent Pi Standards review
  -> independent Pi Spec review
  -> deterministic BEN / UAT / build / GitHub CI
  -> Human merge
```

The model review is advisory. Deterministic gates remain authoritative.

## Existing boundary reused

`scripts/run-pi-architecture-review.mjs` reuses the existing PlotPickle-managed Pi installation and `runPiReadOnly()` path. Every Pi invocation is headless, sessionless, local-runtime only, and restricted to:

```text
read, grep, find, ls
```

Pi cannot edit files, run shell commands, commit, push, change GitHub state, or merge through this workflow.

No new Pi extension, orchestration framework, cloud provider, credential path, or product-runtime dependency is introduced.

## Skills

Two portable Skills define procedure:

- `skill://plotpickle/diagnosis` — exact symptom, red-capable feedback loop, minimised reproduction, falsifiable hypotheses only when needed, and correct-seam regression discipline.
- `skill://plotpickle/plotpickle-architecture-review` — progressive architecture context, pre-change impact mapping, and independent Architecture / Standards / Spec review.

`uat-repair` reuses the Diagnosis Skill while retaining its existing worktree, repair, and deterministic handoff responsibilities.

## Progressive architecture context

Pi starts from a small architecture brain instead of ingesting the entire repository:

1. `AGENTS.md`;
2. `docs/architecture/MODULAR-FOUNDATION.md`;
3. this developer-agent architecture documentation;
4. the supplied authoritative issue/developer brief;
5. relevant registered Skills;
6. exact host-prepared diff, BEN evidence, impact map, or CI failure evidence.

Pi then searches/reads only the relevant implementation, callers, contracts, tests/UAT, persistence, runtime/packaging, and user-facing paths.

## Fixed point and exact head

The host resolves review identity before Pi runs:

```text
git rev-parse <head>
git merge-base <base> <reviewed-head>
git diff --name-only <fixed-point>..<reviewed-head>
```

The exact fixed point and exact reviewed head SHA are recorded in review evidence. Pi receives a host-prepared diff file and does not execute git itself.

## Pre-change impact map

Store the authoritative issue or developer brief in the repository, then run:

```powershell
node scripts/run-pi-architecture-review.mjs impact --base main --head HEAD --spec docs/path/to/developer-brief.md
```

The impact map covers, where relevant:

- canonical owning domain/module;
- implementation files;
- upstream callers and downstream consumers;
- PPF/canon/project/state contracts;
- provider/runtime/agent and Human/Agent trust boundaries;
- persistence/storage;
- UI/user journey;
- packaging/startup/utilities;
- focused tests/UAT;
- stale compatibility or legacy paths;
- explicit do-not-touch boundaries;
- smallest expected implementation plan.

The output is local evidence under the user's PlotPickle application-data directory. It does not grant permission to widen the change.

## Post-change independent review

After implementation, pass the prior impact JSON back to the reviewer:

```powershell
node scripts/run-pi-architecture-review.mjs review `
  --base main `
  --head HEAD `
  --spec docs/path/to/developer-brief.md `
  --impact-map <path-to-pi-impact-json>
```

The host prepares the exact diff and runs deterministic BEN evidence before model review.

Three separate `runPiReadOnly()` invocations are used:

1. **Architecture** — ownership, dependency direction, duplicate/stale paths, trust/provider/runtime/PPF boundaries, persistence, packaging, weakened tests, and unnecessary complexity.
2. **Standards** — `AGENTS.md`, BEN Code Quality, deterministic BEN evidence, and explicit PlotPickle engineering rules.
3. **Spec** — only the supplied authoritative issue/developer brief and exact diff.

These contexts are independent. Architecture may find a problem while Standards passes; Standards may fail while Spec passes; Spec may report missing requirements while Architecture passes.

If `--spec` is omitted during post-change review, the host records **NO SPEC** and does not invoke a model to invent requirements.

## CI failure classification

Place the exact failing CI log or extracted job evidence inside the repository, preferably under `.artifacts/`, then run:

```powershell
node scripts/run-pi-architecture-review.mjs ci `
  --base main `
  --head HEAD `
  --impact-map <path-to-pi-impact-json> `
  --ci-log .artifacts/exact-failure.log
```

The host records the exact head/diff and redacts lines that visibly contain authorization, bearer tokens, API keys, access/refresh tokens, passwords, or secrets before Pi can read the copied failure evidence.

Pi must choose one bounded classification:

- real behavioral regression;
- stale contract after an intentional canonical change;
- packaging/release regression;
- architecture/ownership violation;
- unrelated/pre-existing failure;
- insufficient evidence.

A stale-contract hypothesis is not permission to weaken a red test. Evidence must support the classification.

## Evidence boundary

Final JSON/Markdown evidence contains only:

- fixed point;
- exact reviewed head;
- changed-file list;
- spec source identifier when present;
- concise impact map;
- Architecture verdict/findings;
- Standards verdict/findings;
- Spec verdict/findings or `NO SPEC`;
- optional CI classification;
- safe Pi runtime metadata;
- an explicit advisory/non-authoritative note.

The runner does not persist full prompts or full raw model responses in the final evidence. It must never persist credentials, private story content, user conversation data, or hidden reasoning.

## Authority and stop condition

Pi review cannot mark a PR green, override BEN/UAT/build/CI, or merge. `AGENTS.md`, host permissions, credentials, git policy, provider boundaries, privacy rules, deterministic tests, BEN, focused UAT, production build, Full Verification, and GitHub CI remain higher authority.

If architecture-aware review ever requires a new orchestration framework, new authority model, broad developer-platform rewrite, or required cloud model, stop and reassess instead of expanding this system.