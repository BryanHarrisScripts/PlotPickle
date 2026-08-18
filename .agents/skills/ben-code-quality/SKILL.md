---
name: ben-code-quality
description: Apply PlotPickle's coding-agent discoverability standard and review deterministic BEN code-quality evidence. Use whenever an agent writes, renames, moves, or reviews JavaScript/TypeScript code for PlotPickle.
compatibility: PlotPickle repository; coding and repair workers; BEN deterministic code-quality observer.
metadata:
  owner: plotpickle
  role: code-quality-review
  version: "1"
  source-attribution: "Adapted from modem-dev/skills write-discoverable-code (MIT)"
---

# BEN Code Quality

BEN is PlotPickle's code-quality reviewer. This Skill is the standard procedure coding agents should follow while changing code so future agents and humans can find the right implementation quickly. It does not grant repository, shell, GitHub, credential, provider, or PPF authority.

The host owns permissions, repository isolation, deterministic tests, `slop-scan`, CI, Full Verification, and merge decisions. BEN and this Skill may report findings; they cannot waive a failing gate or certify their own repair.

## 1. Make exported names searchable

Treat every exported identifier as a search handle.

- Prefer descriptive 2–4 word exported names containing a domain word when the shorter name would be ambiguous.
- Give generic verbs their object: prefer `validateAgentProfileRegistry` over `validate`, and `recordResponsibilityToolCall` over `record`.
- Use the repository's existing domain vocabulary. Do not introduce near-synonyms for a concept that already has a stable PlotPickle name.
- If behavior or audience changes materially, rename the symbol in the same change so its name remains truthful.

## 2. Give each concept one obvious home

- Prefer concept-named files such as `responsibility-run-interrupts.ts` or `adaptive-context-strategies.ts` over generic new files named `utils.ts`, `helpers.ts`, `types.ts`, `config.ts`, or `misc.ts`.
- Keep one authoritative definition for a concept. When moving code, remove the old definition in the same change rather than leaving duplicate implementations behind.
- A file should answer one coherent repository question. Do not fragment tiny helpers into separate files when they only make sense inside one concept.

## 3. Use types to carry constraints

- Prefer precise domain types, discriminated unions, and bounded literal unions over broad strings, nullable flag clusters, or `any`.
- Use capability-oriented parameter types where a privileged operation needs an explicit scoped capability rather than a raw general-purpose handle.
- Make important units, ownership, ordering, and authority constraints visible in the type or immediately adjacent documentation.
- Do not weaken a type merely to make generated or agent-authored code compile.

## 4. Put plain-language documentation where search lands

- Add a short doc comment to an exported concept when the sharpest constraint is not obvious from its signature.
- Include the ordinary-language phrase a maintainer is likely to search for, not only camelCase terminology.
- Keep comments factual and current. Delete stale commentary when behavior moves.
- Do not use comments to substitute for enforceable trust, permission, or validation boundaries.

## 5. Make errors and logs traceable

- Start important errors with a stable, distinctive literal phrase that can be searched verbatim in the repository.
- Keep event names, error codes, and diagnostic identifiers as complete searchable literals when practical instead of assembling the important part dynamically.
- Do not swallow an error, log-and-continue without justification, or replace useful failure context with a generic fallback simply to keep a workflow moving.

## 6. Keep orchestrators thin

- Coordinators, gateways, graphs, and runners should read as a sequence of well-named calls into concept-owned modules.
- If one orchestrator accumulates several unrelated implementations, move each question-sized concept to one named home and leave the orchestration visible.
- Do not add pass-through wrappers that contribute no policy, translation, lifecycle, validation, or abstraction value.

## 7. Respect existing PlotPickle architecture

Discoverability never overrides architecture.

- PPF/canon, trust, connector/egress, credentials, deterministic evals, Full Verification, and Harness Improvement promotion boundaries stay protected.
- Follow existing repository conventions before importing a convention from another project.
- Keep creative/product agents separate from developer authority.
- A Skill is procedure only; the host decides which tools and scopes a worker actually receives.

## BEN deterministic review

After an agent-authored code change, use the host-provided BEN scan when available. The host pins and invokes `slop-scan`; the coding agent must not install an unpinned replacement or broaden network access to obtain one.

BEN's preferred CI comparison is delta-based: existing repository debt is baseline evidence, while newly added or worsened findings are the actionable signal. Treat the scan as a deterministic code-quality input alongside tests, type/build checks, focused UAT, and Full Verification.

When BEN reports a finding:

1. identify the exact file/rule/evidence;
2. decide whether the finding reflects a real maintainability defect in the current change;
3. repair the smallest root cause when appropriate;
4. rerun the focused test and BEN scan;
5. never edit the BEN baseline, test, or scan configuration merely to hide a valid new finding.

## Completion checklist

Before handing off agent-authored code, confirm:

- new exported names are specific enough to search directly;
- new files have concept names;
- one concept has one authoritative implementation;
- types express meaningful constraints instead of erasing them;
- important errors/logs are searchable literals;
- doc comments state non-obvious constraints in plain language;
- orchestrators remain thin;
- moved code has no stale duplicate definition;
- BEN/slop-scan evidence has been run when the host provides it;
- tests, build and other authoritative gates remain green.

## Attribution

The discoverability ideas in this PlotPickle procedure are adapted from Modem's `write-discoverable-code` Agent Skill in `modem-dev/skills`, licensed MIT. PlotPickle has rewritten and narrowed the guidance to its own architecture and conventions.