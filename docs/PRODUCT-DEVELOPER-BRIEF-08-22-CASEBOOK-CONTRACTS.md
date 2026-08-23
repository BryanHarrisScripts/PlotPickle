# PlotPickle Product Developer Brief — 08-22 Casebook Contracts

## Status

**Date:** 2026-08-22  
**Relationship to existing brief:** This is a focused addendum to `docs/PRODUCT-DEVELOPER-BRIEF-07-26.md`. It does not replace the existing product direction.

## Decision

PlotPickle UAT is organized around **independent Business Cases**, not one long sequential 1→100 test journey.

The canonical unit is:

> **one Business Case plugin = one production contract = one independent UAT proof**

A Business Case declares the user-visible outcome PlotPickle claims to support. Production code fulfills that contract. UAT independently proves that same contract through PlotPickle Casebook, using Playwright through PlotPickle Navigator where browser interaction is required.

The contract is authoritative. Neither the React implementation nor the Playwright script becomes the definition of the business behavior.

## Why

Long sequential UAT chains create false cascades. If step 18 fails, tests 19–100 can become meaningless even when those later business capabilities are healthy. They also make failures difficult to attribute to a specific product promise.

Business Case isolation gives PlotPickle:

- one red result for the business behavior that actually failed;
- independent setup and teardown;
- targeted development feedback;
- selective UAT for changed product areas;
- full-release certification by discovering and running all installed cases independently;
- reusable contracts that can ship with modular product plugins;
- a direct relationship between product claims, production implementation and acceptance evidence.

## Business Case plugin contract

Each meaningful user journey should be expressible as a discoverable Business Case contribution with a stable ID and version.

A Business Case should define, as applicable:

- stable business-case ID;
- human-readable purpose;
- version;
- required product/plugin capabilities;
- preconditions;
- isolated fixture/setup requirements;
- Human actions and Human-only authority gates;
- automatable semantic actions;
- expected observable outcomes;
- allowed intermediate states;
- required independent evidence;
- fault/failure conditions;
- cleanup/teardown;
- privacy/secrets policy;
- production implementation registration;
- UAT adapter registration.

The exact storage format may evolve. The architectural boundary does not.

## Production/UAT relationship

The production implementation and UAT adapter are sibling implementations of the same Business Case contract.

```text
Business requirement
        ↓
Business Case contract
      ↙       ↘
Production    UAT adapter
fulfillment   independent proof
      ↘       ↙
       Casebook result
```

Production must not call a UAT assertion to decide that a feature works. UAT must not mutate production contracts merely to make a test green.

Playwright is an implementation detail beneath PlotPickle Navigator. A Business Case should prefer semantic actions and stable business identifiers over DOM structure, CSS selectors or component filenames.

## Independence rule

Business Cases must not form an implicit sequential dependency chain.

A Case may require a declared prerequisite capability, but it must establish or request the state it needs rather than assuming an earlier numbered test already ran successfully.

For example:

- `BC-BUZZ-CONNECT-EXISTING` verifies connecting an existing Human BUZZ identity.
- `BC-COMMUNITY-ENTER-GREAT-HALL` verifies entering and reading Great Hall.
- `BC-AGENT-VIEW-SAGE` verifies Sage's public presentation.
- `BC-STORY-AUTOCOMPLETE-FOUNDATIONS` verifies creating a new story and completing Foundations.
- `BC-COMFYUI-CONNECT` verifies configuration and connection to a supported ComfyUI runtime.

Each is independently runnable.

A failure in `BC-BUZZ-CONNECT-EXISTING` must not automatically make the Story or ComfyUI cases red merely because they appeared later in a numbered test plan.

## Plugin rule

Business Cases should be contributed through a reusable registry/plugin seam rather than hard-coded into one central UAT runner.

A product plugin may contribute:

1. production capabilities;
2. Business Case contracts for those capabilities;
3. a UAT adapter that knows how to prove those contracts;
4. optional fixtures scoped to those cases.

The central Casebook runner is responsible for discovery, selection, orchestration, Human gates, evidence handling and reporting. It should not need product-specific knowledge such as Sage IDs, room names or a particular React component.

The built-in PlotPickle product may use the same plugin/contribution mechanism as optional extensions. Built-in status does not justify a second hard-coded path.

## Reporting

Release UAT should report business outcomes, for example:

```text
BC-BUZZ-CONNECT-EXISTING          PASS
BC-COMMUNITY-ENTER-GREAT-HALL     PASS
BC-AGENT-VIEW-SAGE                FAIL
BC-STORY-AUTOCOMPLETE-FOUNDATIONS PASS
BC-COMFYUI-CONNECT                PASS
```

A full release run is therefore a **collection of independent 1:1 Business Case proofs**, not one monolithic journey.

Casebook may still support attended batches, filtering by plugin/capability, retry of a single case, and release-level summary reporting.

## Evidence and authority

Existing PlotPickle trust boundaries remain in force:

- a worker/model assertion is not proof of PASS;
- Human-only credentials, consent and irreversible authority remain protected by PlotPickle Gate;
- evidence must be observed independently where the contract requires it;
- secrets must not be captured in screenshots, fixtures, logs or exported Casebook evidence;
- PPF/canonical project authority remains above test fixtures and generated content;
- a UAT adapter receives no additional product authority merely because it is testing the product.

## Migration rule

Do not rewrite the entire historical UAT suite at once.

Migration is business-case-first:

1. identify a real user journey;
2. define its canonical Business Case contract;
3. isolate setup and cleanup;
4. adapt existing production code to declare/fulfill the contract without unnecessary rewrites;
5. move or replace the relevant UAT assertions behind the Business Case adapter;
6. prove that the Case runs independently;
7. retire only the superseded sequential test coverage.

The migration is complete when the central runner does not need to know product-specific test order.

## Definition of success

PlotPickle can answer two separate questions deterministically:

1. **What business capabilities does this build claim to support?** — discovered from installed Business Case contracts.
2. **Which of those business capabilities have been independently proven on this build?** — reported by Casebook/UAT results.

A developer can run one Business Case in isolation, a related group by plugin/capability, or the complete release set without relying on the success or execution order of unrelated cases.
