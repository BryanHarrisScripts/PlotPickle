# Deterministic Specification-Driven Development (DSDD)

Status: Foundational PlotPickle development framework  
Initial implementation issue: #2331  
Related development loop: `docs/architecture/PLOTPICKLE-DEVELOPMENT-LOOP.md`

## Mission

DSDD uses conversation to establish an authoritative, traceable definition of what software is supposed to do, and then uses deterministic engineering machinery to prove whether the software does it.

Architectural shorthand:

> **Deterministic connective tissue around autonomous agents.**

DSDD connects Human intent, agents, artifacts, checkpoints, evidence, testing and software-delivery systems into a controlled development chain without micromanaging every agent step. GitHub is one current software-delivery implementation beneath that architecture-level category, not part of the definition itself.

The Human is allowed to speak naturally.

The system is responsible for turning that natural language into progressively more explicit, constrained and testable software behavior without losing the meaning of the original Human intent.

The structured specification is derived from the Human's language. It does not replace the Human's language.

## Why DSDD exists

Large language models are built to interpret language. Humans also reason about software in language: business rules, user journeys, expectations, exceptions, corrections and examples.

The problem is not that natural language is unusable for software development. The problem is that conventional AI-assisted development often treats natural language as a disposable prompt.

A typical loose flow is:

```text
Human says what they want
-> model interprets it
-> model writes code
-> Human inspects result
-> Human re-explains what they meant
-> model changes code
-> repeat until it feels right
```

The original intent is weakly preserved. Each generation, test and repair step may reinterpret the request.

PlotPickle already has strong downstream engineering machinery: developer agents, Agent Skills, MCP/CLI boundaries, repository rules, controlled build loops, deterministic tests, WebMCP, browser verification, visual verification, convergence evidence, GitHub CI and exact-head merge discipline.

That machinery cannot produce a deterministic product outcome when the meaning entering BUILD is incomplete, ambiguous or silently changed.

DSDD exists to preserve the semantic chain from Human intent to observed outcome.

## The foundational chain

The primary DSDD artifact is not a JSON file, wireframe, issue, test or screenshot by itself.

The primary artifact is the traceable chain:

```text
WHAT THE HUMAN SAID
        |
        v
WHAT DSDD UNDERSTOOD THAT TO MEAN
        |
        v
WHAT THE BUILD WAS INSTRUCTED TO DO
        |
        v
WHAT THE IMPLEMENTATION ACTUALLY DID
        |
        v
WHAT THE VERIFICATION SYSTEM OBSERVED
        |
        v
WHETHER THE EVIDENCE SATISFIES THE ORIGINAL HUMAN STATEMENT
```

Every structured artifact exists to preserve or prove part of that chain.

A build is not deterministic merely because tests are green.

A DSDD outcome is deterministic when the evidence can be traced back to the approved meaning of the Human's original intent.

## DSDD versus vibe coding

Vibe coding uses conversation to generate software.

DSDD uses conversation to establish an authoritative, traceable definition of what the software is supposed to do, and then uses deterministic engineering machinery to prove whether the software does it.

The distinction is not that DSDD rejects conversational development. DSDD makes conversation more important.

Conversation is the semantic source.

Structured requirements, surface models, state transitions, build instructions, tests and evidence are compiled representations of that source.

## The role of the LLM

The LLM is a semantic compiler, not the final authority.

Its job is to help transform Human language into increasingly constrained representations while preserving provenance.

Conceptually:

```text
raw Human language
-> interpreted intent
-> business/user workflow
-> expected observable behavior
-> surface/state/transition model where applicable
-> constraints and invariants
-> build requirements
-> verification obligations
```

At each stage, ambiguity should decrease.

The LLM may:

- identify implicit assumptions;
- ask or infer which existing PlotPickle context is relevant;
- distinguish an example from a requirement;
- identify contradictions or missing transitions;
- derive observable behavior from business language;
- map one Human statement to several implementation requirements;
- challenge whether a competent developer could satisfy the current spec while still disappointing the Human;
- explain its interpretation back to the Human in concise language.

The LLM may not:

- silently replace the Human's intent with a technically convenient interpretation;
- silently weaken a requirement because implementation is difficult;
- redefine the desired outcome during the repair loop merely to obtain green tests;
- treat its own interpretation as approved without Human confirmation where the change is materially interpretive.

## Natural language remains authoritative

Deterministic does not mean the Human must speak deterministically.

The Human may say:

> When I leave this screen and come back, I expect to be exactly where I was.

DSDD may interpret that into explicit obligations such as:

- preserve the active document identity;
- preserve the relevant selection;
- preserve cursor or focus position where the owning architecture supports it;
- preserve scroll or viewport state where required by the workflow;
- return to the correct parent/working surface;
- do not create a second owner for the preserved state.

Those derived obligations do not replace the original sentence.

They remain linked to it.

Verification can therefore report:

```text
Human intent:
"When I leave this screen and come back, I expect to be exactly where I was."

Derived obligations:
R1 active document identity preserved      PASS
R2 selection restored                     PASS
R3 working position restored              FAIL
R4 correct parent surface restored         PASS

Overall:
Original Human intent is NOT YET PROVEN.
```

This is semantic traceability.

## Conversation as an engineering artifact

The whole conversation is not automatically a contract.

DSDD should distinguish at least:

- idea;
- intent;
- business rule;
- workflow description;
- observation;
- example;
- constraint;
- correction;
- acceptance;
- rejection;
- intent revision.

Only accepted intent and its approved derived meaning become authoritative build inputs.

The system should preserve enough source language to explain where each requirement came from without exposing hidden model reasoning or turning every conversational fragment into permanent specification noise.

The goal is provenance, not transcript bureaucracy.

## The confirmation boundary

Before BUILD, DSDD must be able to show the Human a compact statement of understanding.

The Human experience should resemble a capable developer or UAT team listening to the user and responding:

> We understand the workflow you intended. Here is what we believe must happen.

The Human can correct that interpretation.

When the Human explicitly accepts the interpretation with **Pi Draft**, DSDD creates a versioned locked interpretation.

After lock:

- Pi may inspect the repository only through the bounded read-only brief tools;
- Pi converts the approved meaning into implementation-grade developer guidance;
- the Human may explicitly choose **Publish Brief** to create the durable GitHub Issue handoff;
- DSDD itself does not edit source, create a branch, commit, open a pull request or merge;
- downstream implementation and verification workers may later act against the published Issue, but no worker may silently change what success means.

A changed meaning requires a new specification revision and a new Human confirmation.

## The build loop must not redesign the intent

PlotPickle's downstream loop remains valuable:

```text
plan
-> build
-> verify
-> review
-> fix
-> rerun
-> merge
```

But that loop must operate against a locked semantic target.

The build loop can solve technical questions.

It should not continue deciding fundamental product questions such as:

- what opens;
- what closes;
- what stays visible;
- what the parent or child relationship is;
- which state must survive a transition;
- what the Human expects after an action;
- which business rule is authoritative.

If those questions remain genuinely unresolved when BUILD begins, the upstream DSDD interpretation is incomplete.

## Ambiguity reduction

A useful DSDD measure is whether each stage reduces the number of reasonable interpretations.

```text
raw idea
  many plausible interpretations

clarified intent
  fewer

business/user workflow
  fewer

observable behavior
  fewer

surface/state/transition model
  fewer

constraints and proof obligations
  very few

BUILD
  implementation freedom remains,
  product-meaning freedom should be minimal
```

A good specification is not necessarily long.

A good specification substantially reduces the number of legitimate ways a competent coding agent could misunderstand the desired outcome.

## Surface and interaction modeling

For UI and workflow changes, the Human often communicates by using the product:

- "this should open here";
- "this should close when I choose that";
- "I should come back to where I was";
- "this belongs under System";
- "that should behave like Learn";
- "do not change the rest of this surface."

DSDD should ground those statements in the actual running application where possible.

The derived model may include:

- governed surface;
- parent/child relationship;
- active state;
- user action/event;
- expected transition;
- preserved state;
- visible regions;
- permitted and forbidden changes;
- return/back behavior.

A compact ASCII or visual wireframe can be useful, but it is a projection of the interpreted intent, not the fundamental authority.

The authority remains the approved semantic chain.

## Proof obligations

Each material approved requirement must eventually be one of:

- PASS — evidence proves the requirement;
- FAIL — observed behavior contradicts it;
- UNPROVEN — sufficient evidence does not yet exist.

UNPROVEN is not PASS.

A green production build does not by itself prove Human intent.

Evidence may include:

- deterministic tests;
- WebMCP observations;
- Browser Verification Broker evidence;
- surface/state transitions;
- rendered geometry;
- visual conformance;
- state persistence checks;
- focused UAT;
- CI results;
- repository evidence.

The correct evidence type depends on the requirement.

## Failure classification

When the final result is wrong, DSDD must identify what kind of wrong occurred.

### Implementation mismatch

The approved interpretation is still correct, but the implementation does not satisfy it.

```text
locked intent remains unchanged
-> repair implementation
-> rerun relevant proof
```

### Specification ambiguity

The Human's source intent was not sufficiently captured in the approved interpretation.

```text
reopen interpretation
-> add or correct missing meaning
-> Human confirms a new spec version
-> rebuild
```

### Intent revision

The result accurately represents the prior approved interpretation, but after seeing it the Human decides they want different behavior.

```text
preserve prior history
-> record revised Human intent
-> compile new interpretation
-> Human confirms
-> build new version
```

These are different events and must not be collapsed into one endless "fix until green" loop.

## Semantic provenance invariants

The DSDD framework should preserve these invariants:

1. An approved derived requirement can be traced to Human intent.
2. The Human source meaning is preserved when requirements are decomposed.
3. A repair cannot silently weaken or replace an approved requirement.
4. A revised intent creates a new version; it does not rewrite history.
5. Tests and evidence prove requirements; they do not become the source of the requirement after the fact.
6. A passing implementation test is not sufficient when the Human-level requirement remains unproven.
7. The model's interpretation is visible enough for the Human to correct before substantial implementation.
8. Existing PlotPickle architecture remains authoritative for ownership, permissions, storage, provider routing and merge policy.
9. Hidden chain-of-thought is never required for provenance; observable source statements, interpretations, requirements, decisions and evidence are sufficient.
10. The semantic chain survives handoff across agents, tools, Skills, MCP/CLI adapters, GitHub and verification systems.

## The intended Human experience

The sophistication of DSDD should be mostly invisible.

A local developer/UAT experience should feel like having an experienced development team beside the Human while they use the product.

The Human:

1. enters PlotPickle;
2. uses the real software;
3. explains the business use case and expected behavior naturally;
4. points out where actual behavior differs;
5. sees a concise confirmation of what DSDD understood;
6. corrects that understanding if required;
7. chooses "Pi Draft" and reviews repository-aware technical guidance;
8. chooses "Publish Brief" to create the GitHub Issue handoff;
9. later receives the implemented result through the normal development loop;
10. exercises the workflow again and receives evidence tied back to the approved intent.

The Human should not need to author JSON, YAML, test code or architecture schemas to obtain deterministic behavior.

Those may exist underneath as compiled engineering artifacts.

## Relationship to the PlotPickle Development Loop

The existing development loop remains:

```text
IDEA
-> ASSESS
-> DEVELOPER BRIEF
-> ISSUE
-> PLAN
-> BUILD
-> TEST / FIX
-> CONVERGE
-> PR GATES
-> MERGE
```

DSDD strengthens the semantic boundary before implementation.

For interpretive work, the conceptual flow becomes:

```text
IDEA / HUMAN LANGUAGE
-> CAPTURE INTENT
-> INTERPRET
-> CHALLENGE AMBIGUITY
-> HUMAN CONFIRMATION
-> LOCKED SEMANTIC CONTRACT
-> PI READ-ONLY TECHNICAL DRAFT
-> PUBLISH BRIEF / GITHUB ISSUE
-> PLAN
-> BUILD
-> VERIFY
-> EVIDENCE
-> COMPARE TO APPROVED INTENT
-> REPAIR OR REVISE
-> CONVERGE
-> PR GATES
-> MERGE
```

This is not a second development system.

It is the semantic foundation that makes the existing system meaningful.

## Relationship to existing PlotPickle systems

DSDD does not replace:

- `AGENTS.md`;
- GitHub Issues and pull requests;
- Developer Workbench;
- Pi, Cline or future coding agents;
- Agent Skills;
- MCP/CLI tool boundaries;
- Surface Registry / Surface Grammar;
- WebMCP;
- Browser Verification Broker;
- Visual Director / UI Continuity;
- deterministic tests;
- development convergence;
- PR Gate / Product Gate;
- exact-head merge discipline.

Their roles remain distinct.

DSDD provides the intent provenance they consume or prove.

WebMCP and browser verification answer:

> What did the software actually do?

DSDD preserves:

> What did the Human actually mean, what interpretation was approved, and what must therefore be proven?

## Phase 1

Issue #2331 is the first bounded implementation of this framework.

It should prove one vertical slice:

```text
Human conversational instruction
-> current application context
-> interpreted intent
-> ambiguity challenge
-> Human confirmation
-> locked semantic contract
-> read-only Pi technical brief
-> explicit GitHub Issue publication
-> existing coding loop
-> existing verification
-> requirement/evidence mapping
-> comparison to original approved Human intent
```

Phase 1 should stay small.

The purpose is not to build a giant new Workbench.

The purpose is to prove that preserving Human language and semantic provenance reduces interpretation drift and improves first-pass outcome quality.

## North-star test

For any meaningful DSDD change, a reviewer should be able to answer all of these questions:

1. What did the Human say they wanted?
2. What did DSDD understand that statement to mean?
3. What did the Human approve?
4. What exactly was the build instructed to implement?
5. What did the resulting software actually do?
6. What evidence was collected?
7. Does that evidence prove the original approved Human intent?
8. If not, is the problem implementation, specification ambiguity or revised intent?

If those questions cannot be answered from the development record, semantic traceability has been lost.

## Core statement

DSDD is not an attempt to make Human language behave like code.

DSDD uses the strengths of language and large language models to capture meaning, then progressively constrains that meaning into testable software behavior.

The Human supplies intent.

The LLM preserves and compiles meaning.

The engineering system builds and observes.

Deterministic evidence proves whether the finished software satisfies the approved intent.
