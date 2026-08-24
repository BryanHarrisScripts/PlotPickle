---
name: diagnosis
description: Diagnose non-trivial PlotPickle bugs from the narrowest exact, red-capable feedback loop before speculative source changes.
compatibility: PlotPickle repository; Pi, Cline, and developer repair workers.
metadata:
  owner: plotpickle
  role: diagnosis
  version: "1"
---

# PlotPickle Diagnosis

Use this skill for non-trivial bugs, failed UAT, failed CI, and ambiguous product defects before implementation begins. `AGENTS.md` remains the repository constitution. This skill supplies a repeatable diagnosis procedure only; it grants no repository, shell, GitHub, credential, provider, network, PPF, or merge authority.

## Exact feedback loop first

1. Reproduce the user's exact symptom through the narrowest correct seam.
2. Prefer an already-red focused test, compiler/build failure, UAT assertion, or exact CI assertion when it precisely proves the defect.
3. Prove the feedback loop can go red for the reported problem and green after repair.
4. Tighten or minimise the reproduction before broad theorising.
5. If the existing failure already proves the cause, use that evidence instead of manufacturing extra diagnostic ceremony.

## Root-cause order

Before assuming a capability is missing, check in this order whether the symptom comes from:

1. an existing implementation being bypassed;
2. a duplicate or legacy path;
3. an ownership or dependency-direction violation;
4. a stale compatibility or reference contract;
5. a state or persistence mismatch;
6. a provider/runtime abstraction break;
7. a UI symptom of a lower-level failure;
8. a genuinely missing capability.

For genuinely ambiguous failures, rank a small set of falsifiable hypotheses. Instrument only boundaries that distinguish those hypotheses. Do not produce a long hypothesis list when one assertion or trace already isolates the cause.

## Regression seam

Create or strengthen the nearest focused regression when a correct seam exists. The regression must represent the reported behavior rather than implementation trivia.

If no valid regression seam exists, report that architectural gap explicitly. Do not invent an implementation-coupled test merely to claim coverage.

## Repair handoff

Before implementation, record a concise handoff containing:

- exact symptom and reproduction;
- strongest root-cause evidence;
- files/contracts expected to change;
- focused regression expected to change;
- user-visible behavior that must remain unchanged;
- architectural do-not-touch boundaries.

Then apply `skill://plotpickle/engineering-discipline` for the smallest sufficient implementation and `skill://plotpickle/ben-code-quality` for discoverable code.

## CI failure classification

When the failure is from GitHub CI, keep the exact reviewed head SHA and exact failing assertion/log. Classify with evidence where possible as:

- real behavioral regression;
- stale test/contract after an intentional canonical-path change;
- packaging/release-path regression;
- architecture/ownership violation;
- unrelated/pre-existing failure;
- insufficient evidence.

Never weaken a red test merely because it appears stale. Prove why the contract is stale before changing it.

## Boundaries

Do not edit tests, baselines, logs, evidence, or product code merely to make the signal green. Do not broaden the issue while diagnosing it. Do not store hidden reasoning, full prompts/responses, credentials, or user story text in diagnostic evidence.

## Completion output

Return only the concise reproducible diagnosis, the smallest change boundary, the regression seam, and remaining uncertainty. Deterministic tests, BEN, UAT, build, Full Verification, and GitHub CI remain the authority.