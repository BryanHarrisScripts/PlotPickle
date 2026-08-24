---
name: plotpickle-architecture-review
description: Scout PlotPickle architecture before non-trivial changes and independently review an exact diff/head against architecture, engineering standards, and the originating spec.
compatibility: PlotPickle repository; read-only Pi/Cline reviewer contexts.
metadata:
  owner: plotpickle
  role: architecture-review
  version: "1"
---

# PlotPickle Architecture Review

Use this skill for architecture scouting before a non-trivial change and independent review after implementation. `AGENTS.md` remains higher authority. This skill is advisory procedure only and never grants edit, shell, GitHub, credential, provider, PPF, or merge authority.

## Progressive architecture context

Do not load the complete repository into every prompt. Start from the compact architecture brain:

- `AGENTS.md`;
- `docs/architecture/MODULAR-FOUNDATION.md`;
- `docs/architecture/developer-agent-stack.md` when developer tooling is involved;
- the originating issue/developer brief when supplied;
- relevant registered Skills from `config/agent-skills.json`;
- exact changed/failing evidence supplied by the host.

Then search and read only the implementation, callers, consumers, contracts, tests, UAT, persistence, packaging/runtime, and user-facing paths needed to understand the task.

## Pre-change impact map

Produce a concise impact map with the fields below where relevant:

- owning domain/module;
- primary implementation files;
- upstream callers;
- downstream consumers;
- PPF/canon/project/state contracts;
- provider/runtime/agent boundaries;
- Human/Agent identity and trust boundaries;
- persistence/storage implications;
- UI/user-journey surfaces;
- packaging/startup/utility implications;
- focused tests/UAT likely to move;
- compatibility/legacy paths that could become stale;
- explicit do-not-touch boundaries;
- smallest expected implementation plan.

The map predicts blast radius. It is not permission to widen scope.

Apply `skill://plotpickle/diagnosis` when the task is a bug or failure and `skill://plotpickle/engineering-discipline` when defining the smallest implementation plan.

## Post-change Architecture axis

A fresh read-only reviewer must inspect the exact host-supplied fixed point, exact reviewed head SHA, exact diff evidence, and the impact map. Check for:

- wrong domain ownership or dependency direction;
- duplicate logic or alternate paths;
- stale compatibility bridges/references;
- accidental product-module coupling;
- provider independence violations;
- Mastra/product-agent versus developer-tool boundary violations;
- Human/Agent identity or signer confusion;
- PPF/canon/provenance authority violations;
- credential/privacy/trust regressions;
- persistence/state inconsistencies;
- packaging/startup/release drift;
- weakened tests;
- unnecessary special cases, abstraction, or complexity;
- predicted blast-radius items that were ignored.

Architecture output is `PASS` or `FINDINGS` with concise evidence-backed findings.

## Independent Standards axis

Run this in a separate review context. Ask only whether the exact diff meets PlotPickle engineering standards.

Use:

- `AGENTS.md`;
- relevant architecture/trust/provider/PPF/UAT rules;
- `skill://plotpickle/ben-code-quality`;
- deterministic BEN evidence when supplied;
- exact changed files/diff;
- the architecture impact map.

Output `PASS` or `FINDINGS`. Generic model taste is not a PlotPickle standard.

## Independent Spec axis

Run this in another separate review context. Ask only whether the exact diff faithfully implements the supplied authoritative issue/developer brief.

Look for:

- missing or partial requirements;
- scope creep;
- behavior contradicting the brief;
- acceptance criteria without evidence/regression coverage.

If the host cannot establish an authoritative spec, the host reports `NO SPEC`. Do not invent requirements and do not convert architecture preferences into product requirements.

## CI correlation

When the host supplies exact failing CI evidence, correlate it with the original impact map and exact reviewed head. Distinguish with evidence between a real regression, stale contract, packaging/release-path regression, architecture violation, unrelated/pre-existing failure, and insufficient evidence.

## Evidence boundary

Final review evidence may contain:

- spec source identifier;
- fixed point / merge base;
- exact reviewed head SHA;
- concise impact-map summary;
- Architecture verdict/findings;
- Standards verdict/findings;
- Spec verdict/findings or `NO SPEC`;
- safe reviewer/runtime metadata;
- explicit advisory/non-authoritative note.

Do not persist hidden reasoning, full prompts/responses, credentials, private story content, or user conversation data.

## Authority

Architecture review, Standards review, and Spec review are independent advisory axes. One may fail while another passes. None can mark a PR green, waive BEN/UAT/build/CI, or merge. Deterministic PlotPickle gates and the exact green GitHub head remain authoritative.