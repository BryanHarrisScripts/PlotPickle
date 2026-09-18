# #2173 — Production Convergence

## Status

Implementation brief for the Writer-to-Screen convergence parent #2165.

## Objective

Connect approved Storyboard, Previs and Scene Workspace evidence to the existing #2064 provider-neutral Director Specification/compiler path without adding a second production authority.

Production answers:

> What approved result are we generating/rendering?

## Reuse decision

#2173 is a composition layer only.

It reuses:

- PPF / current project revision as canonical story authority;
- Storyboard Editorial Shot as approved visual/shot intent;
- ProductionShotIntent as Previs timing/motion execution intent;
- Scene semantic projection / Scene Workspace source identities;
- #2092 production-intent handoff;
- #2125 Director Spec readiness inspection;
- #2064 Director Specification, provider capability assessment and provider instruction compiler;
- #2106 Story Mode / capability routing for provider selection;
- Sequence Evidence / render-evidence handoff for generated-output verification.

No new production store, router, provider registry, compiler, canon layer or evidence system is introduced.

## Convergence contract

The new production convergence boundary performs this deterministic chain:

```text
approved Storyboard Shot
+ approved Previs ProductionShotIntent
+ current Scene/Beat/Frame semantics
+ current PPF revision
        ↓
#2092 PreproductionProductionIntent
        ↓
#2125 Scene Director Spec readiness
        ↓
#2064 provider-neutral Director Specification
        ↓
already-selected provider integration
        ↓
#2064 capability assessment + disposable provider instructions
```

Missing evidence remains a not-ready result. The convergence layer does not invent a Scene, Shot, timing value, visual reference, transition, audio cue or provider.

## Provider boundary

Production convergence may compile provider-facing instructions only after Story Mode / capability routing has supplied an already-selected provider integration and explicit compilation strategy.

The convergence layer does not:

- read Story Mode routing state;
- choose Local / Cloud / Hybrid;
- select a provider;
- activate a runtime;
- call a provider/model;
- spend credits;
- persist prompt prose.

Provider-facing prose remains disposable and non-canonical.

## Capability truth

The provider-neutral specification asks for core sequence/shot ordering and authored timing as required production capabilities.

Richer filmmaking properties are requested as preferred capabilities when present:

- camera framing;
- lens;
- camera movement;
- blocking;
- lighting;
- approved references;
- continuity locks;
- Shot Information Boundary;
- audio intent;
- transitions.

Unsupported preferred properties remain visible through #2064 warnings/finishing requirements rather than silently becoming guarantees or blocking local-first workflows unnecessarily.

## Provenance

Project id, canonical revision, Scene identity, Storyboard Shot id, Previs Production Shot id, Storyboard artifact/dependency identity and source references remain carried through the existing handoffs.

Generated media remains candidate evidence. Existing render-evidence / Sequence Evidence machinery owns verification and provenance binding after execution.

## Failure behavior

The convergence layer reports not-ready when approved production intent is incomplete, including cases such as:

- no approved Previs Production Shot;
- no approved Storyboard Shot;
- unresolved Storyboard ↔ Previs pairing;
- unresolved production-ready reveal/withhold responsibility;
- missing authored Scene timing;
- other #2125 readiness gaps.

It never creates filler solely to make Production appear complete.

## Acceptance

#2173 is complete when:

1. approved Scene Workspace/Previs state reaches the existing #2064 Director Specification;
2. revision/source provenance survives the handoff;
3. provider prompt prose remains disposable;
4. local/offline compilation remains possible;
5. generated candidate output can retain source/dependency provenance through the existing execution/evidence boundaries;
6. no duplicate compiler/router/canon store exists.
