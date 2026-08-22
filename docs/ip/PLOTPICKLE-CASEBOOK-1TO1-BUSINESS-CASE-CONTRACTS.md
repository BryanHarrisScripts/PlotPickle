# PLOTPICKLE CASEBOOK — 1:1 BUSINESS CASE CONTRACT METHOD

**Recorded:** 2026-08-22  
**Status:** Architecture/IP identification record for later professional review  
**Related registry name:** **PLOTPICKLE CASEBOOK**  
**Related processes:** PLOTPICKLE NAVIGATOR, PLOTPICKLE GATE, PLOTPICKLE EXECUTION, PLOTPICKLE LEDGER, PLOTPICKLE REPAIR

## Purpose

This record captures a specific PlotPickle Casebook method in which product behavior and acceptance verification are organized around independently executable Business Case contracts rather than a monolithic ordered UAT script.

This document is an engineering and invention-identification record. It does **not** assert patentability, inventorship, legal priority, freedom to operate or validity of any potential claim. Those questions require formal legal and prior-art review.

## Core method

A PlotPickle Business Case is treated as a first-class contract describing a Human-facing product outcome.

For each supported Business Case:

1. a discoverable, versioned Business Case contract declares the outcome the product claims to support;
2. production code declares or registers how it fulfills that contract;
3. an independent UAT adapter declares how to prove the same contract;
4. the Business Case establishes its own required state instead of relying on previous test cases in a numbered sequence;
5. semantic actions are executed through a product-owned interaction abstraction such as PLOTPICKLE NAVIGATOR when browser interaction is required;
6. Human-only authority transitions are isolated behind PLOTPICKLE GATE;
7. PASS requires independently observed evidence defined by the Business Case rather than a worker/model assertion;
8. evidence and outcome are recorded with attributable execution context;
9. cleanup prevents the case from leaking state into unrelated Business Cases; and
10. a release run discovers and executes a collection of such independent contracts, optionally filtered by product plugin or capability.

The operative relationship is:

> **one Business Case plugin = one production contract = one independent UAT proof**

## Problem addressed

Traditional long end-to-end acceptance suites often encode a path such as:

`Test 1 → Test 2 → Test 3 → … → Test 100`

Later tests may depend on state created by earlier tests. A failure near the beginning can therefore produce a large cascade of secondary failures or skipped checks, making it difficult to determine which business capabilities are actually broken.

The PlotPickle method treats the independently useful Human outcome as the primary unit instead of the ordinal test number.

A failed identity-connection Business Case can therefore be reported as failed without automatically invalidating an unrelated story-authoring or media-provider Business Case.

## Contract composition

A Business Case contract may include:

- stable identifier and version;
- business purpose;
- capability/provider/plugin prerequisites;
- preconditions;
- isolated fixture/setup definition;
- Human actions;
- Human-only authority checkpoints;
- semantic machine actions;
- expected observable outcomes;
- allowed intermediate states;
- independent evidence requirements;
- negative/fault conditions;
- privacy/secrets policy;
- cleanup/teardown;
- production fulfillment registration;
- UAT proof adapter registration.

The contract is the shared semantic authority. The UI implementation and browser-test implementation are both subordinate implementations of that contract.

## Plugin/discovery composition

The method may be implemented through a reusable plugin or contribution registry.

A product or extension plugin can contribute:

- production capability registrations;
- one or more Business Case contracts for those capabilities;
- UAT adapters for independently proving the contributed contracts;
- case-scoped fixtures where required.

A central Casebook runtime discovers contributions and supplies generic orchestration, selection, evidence handling, Human gates and reporting. The central runtime does not need hard-coded knowledge of the product-specific actor names, room names, UI component names or historical test ordering.

Built-in product modules and optional third-party extensions can use the same contribution mechanism.

## Independence properties

A Business Case may declare a prerequisite capability, but it does not rely on a prior case having run successfully to manufacture undeclared state.

Each Case is independently selectable and executable.

A Case therefore contains or requests sufficient setup to reach its starting condition, and performs sufficient cleanup to avoid contaminating another Case.

The method permits:

- one-case development verification;
- capability-scoped verification;
- plugin-scoped verification;
- retry of a failed Business Case without replaying unrelated earlier cases;
- release certification by running all discoverable cases independently;
- parallel execution when authority, fixtures and shared external state permit it.

## Evidence-bound PASS

Casebook separates execution claims from acceptance evidence.

A model, Agent, worker, UAT script or Human statement alone does not make a Business Case pass when the contract requires independently observable proof.

Evidence may include, according to the Case:

- browser-observed state;
- persisted application state;
- provider/service response;
- identity/pubkey verification;
- canonical project-state change;
- local filesystem artifact;
- independent API/readback result;
- Human-approved state followed by independent observation.

The exact evidence type is Business Case-specific while the evidence requirement is Casebook-owned.

## Human authority boundary

Where a Business Case requires a password, private identity key, provider consent, native application approval or irreversible Human decision, automation pauses at PLOTPICKLE GATE.

The secret or authority is not granted to the testing Agent merely because it is needed to complete the Case.

The Human performs the protected action in the authorized surface, after which Casebook independently observes the allowed result.

## Provider-neutral browser boundary

Playwright is presently an implementation engine beneath PLOTPICKLE NAVIGATOR rather than the business contract itself.

A Case is expressed in semantic product actions and observable outcomes so that replacing the underlying browser driver does not require redefining the Business Case.

Selectors, component filenames and page implementation details are adapter details rather than the product promise.

## Example embodiment

A Business Case for connecting an existing BUZZ Human identity may declare:

- precondition: PlotPickle Human profile exists and no verified BUZZ signer is bound;
- action: Human chooses Connect Existing Identity;
- gate: Human supplies the private BUZZ credential through the protected native/profile path;
- production outcome: the verified public key is bound to the Human profile;
- negative requirement: no PlotPickle Agent inherits or reuses the Human signer;
- persistence requirement: the verified connection survives restart according to profile policy;
- independent proof: Casebook reads back the active public signer and role binding without exposing the private key;
- cleanup: test-only profile state is removed or isolated.

A Story or ComfyUI Business Case can run independently of this Case unless it explicitly declares BUZZ identity as a prerequisite capability.

## Candidate distinguishing elements for later claim review

The following combination may warrant prior-art and professional claim review:

1. treating an independently useful Human business outcome as a discoverable executable contract shared by production fulfillment and UAT proof;
2. plugin-based contribution of production capability, Business Case semantics and independent proof adapter through a common registry;
3. rejecting implicit ordinal dependency between acceptance cases and requiring case-owned setup/cleanup;
4. separating worker/model assertions from independently observed PASS evidence defined by the same Business Case;
5. preserving Human-only secrets/authority through an attended gate inside otherwise automatable Business Case execution;
6. abstracting browser-control implementation beneath a product-owned semantic interaction boundary while retaining the Business Case unchanged;
7. producing release certification from the discovered set of independently proven Business Case contracts rather than from completion of one stateful scripted journey; and
8. allowing selective one-case, capability, plugin and complete-release execution from the same contract inventory.

No single element above is asserted to be novel by itself. Review should consider the claimed combination, ordering, trust boundaries and evidence composition against existing software testing, behavior-driven development, contract testing, model-based testing, plugin testing and agentic-evaluation prior art.

## Variations and embodiments

The method is not limited to browser UAT.

A Business Case adapter may use:

- browser automation;
- desktop automation;
- service/API calls;
- local runtime inspection;
- filesystem evidence;
- hardware/provider integration;
- Human-attended steps;
- combinations of the above.

The contract may be represented in TypeScript, JSON, schema-backed manifests or another deterministic representation without changing the method.

The UAT engine may execute cases serially or in parallel. Independence refers to undeclared state dependence, not mandatory concurrency.

## Engineering lineage

Related implemented or existing PlotPickle lineage includes:

- PLOTPICKLE CASEBOOK Business Cases and attended execution;
- `scripts/run-casebook-attended.mjs`;
- `scripts/casebook-attended-runtime.mjs`;
- `scripts/creative-uat/casebook-phase3b3-live.mjs`;
- PLOTPICKLE NAVIGATOR browser-action abstraction;
- Playwright-backed local/browser UAT runners;
- evidence-driven UAT and responsibility-run records;
- 2026-08-22 product decision to modularize production/UAT around independent 1:1 Business Case plugins.

Future implementation commits/issues should be added here or to `PLOTPICKLE-PROCESS-REGISTRY.md` as concrete lineage anchors.

## Review questions for patent counsel

A later formal review should ask:

- Which portions are already disclosed by BDD/Cucumber-style scenarios, consumer/provider contract testing, model-based testing or test-plugin systems?
- Is the production-contract/UAT-proof/plugin composition materially distinguishable from conventional test registration?
- Does evidence-bound PASS plus Human authority gating provide a stronger differentiating combination?
- Does discovery of the product's claimed business capabilities from the same plugin contract inventory create a useful system-level distinction?
- Which claim scope would avoid attempting to claim Playwright, generic plugins, generic test isolation or generic acceptance testing themselves?
