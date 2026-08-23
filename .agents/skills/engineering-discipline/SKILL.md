---
name: engineering-discipline
description: Keep PlotPickle coding and repair work assumption-aware, minimal, task-scoped, and driven by explicit verification criteria before implementation begins.
license: MIT
metadata:
  author: PlotPickle
  version: "1.0.0"
  compatibility: PlotPickle coding and repair workers
  uri: skill://plotpickle/engineering-discipline
  progressiveDisclosure: true
  source-attribution: "Adapted from multica-ai/andrej-karpathy-skills at 2c606141936f1eeef17fa3043a72095b4765b9c2 (MIT)"
---

# Engineering Discipline

Use this skill before and during non-trivial PlotPickle coding or repair work. It is a procedure for keeping implementation bounded and verifiable. It does not grant repository, shell, GitHub, credential, provider, network, or PPF authority.

AGENTS.md, host policy, task scope, accepted architecture, deterministic tests, BEN Code Quality, and explicit Human instructions remain authoritative. If this procedure conflicts with any of them, follow the higher authority and report the conflict.

## 1. Resolve material uncertainty before editing

Do not silently turn an important unknown into an implementation decision.

- Identify assumptions that could materially change behavior, compatibility, data ownership, security, UX, or scope.
- Check repository evidence first when the answer can be discovered locally.
- When two materially different interpretations remain plausible, state the alternatives and obtain direction unless the task already defines a safe deterministic choice.
- Do not ask for clarification about trivial details that existing code, tests, conventions, or the requested outcome already settle.
- Record a meaningful constraint in the implementation or regression when forgetting it later would recreate the defect.

## 2. Choose the smallest sufficient solution

Solve the requested problem without building speculative flexibility around it.

- Prefer an existing extension point over a new framework.
- Prefer one direct implementation over an abstraction that has only one consumer.
- Do not add configuration, fallback paths, generalized helpers, or future-facing APIs unless the task requires them.
- Reuse the repository's stable vocabulary and ownership boundaries instead of inventing a parallel concept.
- If the change is becoming much larger than the behavior being repaired, re-check the root cause and simplify before continuing.

## 3. Keep every changed line task-scoped

A focused task is not permission for adjacent cleanup.

- Change only files and behavior required by the task, its regression coverage, and cleanup created by your own edit.
- Match the local style rather than reformatting or rewriting neighboring code.
- Do not remove unrelated dead code or rename unrelated concepts while passing through a file.
- When your change makes an import, variable, helper, test fixture, or branch obsolete, remove that new orphan in the same change.
- Mention unrelated defects separately instead of quietly folding them into the repair.

Before handoff, be able to connect each meaningful diff hunk to one acceptance criterion.

## 4. Define proof before relying on implementation

Turn the request into observable success criteria before declaring the work complete.

For a bug repair:
1. identify or add a focused regression that represents the failure;
2. make the smallest root-cause change;
3. prove the regression passes;
4. run the nearest compatibility checks;
5. run broader authoritative gates required by the host.

For a behavior change:
1. describe the observable outcome;
2. identify the existing contract that must remain unchanged;
3. add or update deterministic coverage for both;
4. implement;
5. verify the requested outcome and preserved contract.

For a refactor:
1. establish current passing behavior;
2. define the structural improvement being sought;
3. make the minimum structural change;
4. prove behavior remains equivalent with the same authoritative checks.

Do not substitute "looks right" or a worker's own claim for required evidence.

## 5. Loop on evidence, not on scope expansion

When verification fails, use the evidence to correct the same bounded task.

- Inspect the exact failure before editing again.
- Repair the root cause rather than weakening tests, suppressing errors, or adding broad fallbacks.
- Keep retry loops bounded by the task's existing success criteria.
- If evidence shows the original assumption was wrong, update the plan explicitly before continuing.
- If success requires a new product decision or materially larger scope, stop and surface that boundary rather than silently expanding the task.

## Companion PlotPickle standards

Use `skill://plotpickle/ben-code-quality` for naming, discoverability, types, traceable errors, concept ownership, and thin orchestration.

Use `skill://plotpickle/uat-repair` when the task originates from a concrete UAT finding and needs the isolated reproduce → regression → repair → verification workflow.

This Engineering Discipline Skill governs how a coding worker chooses and bounds the implementation. BEN remains the deterministic reviewer and cannot become developer or merge authority.

## Completion check

Before handoff, confirm:

- material assumptions were resolved from evidence or surfaced rather than guessed;
- the solution is the smallest sufficient implementation;
- no unrelated cleanup or speculative abstraction was introduced;
- each changed area traces to the requested outcome, regression, or cleanup caused by the change;
- success criteria were defined in observable terms;
- focused tests and required broader gates were run;
- failures were repaired without weakening authoritative evidence;
- no Skill was treated as permission to access credentials, network services, providers, GitHub, shell, or PPF state.

## Attribution

This PlotPickle procedure adapts the four engineering-behavior themes published by `multica-ai/andrej-karpathy-skills`: managing assumptions, favoring simple implementations, keeping edits surgical, and working toward explicit success criteria. The reviewed source revision is `2c606141936f1eeef17fa3043a72095b4765b9c2`, and the source declares the Skill under the MIT license. PlotPickle rewrites and narrows the guidance to its own agent authority, verification, BEN, and repository boundaries.