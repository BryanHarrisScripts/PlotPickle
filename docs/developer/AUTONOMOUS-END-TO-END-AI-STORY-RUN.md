# Autonomous End-to-End AI Story Run

## Goal

Prove PlotPickle can create, refine, validate, visualize, persist, reopen, and continue a complete story with zero Human intervention during the run while using the same product routes, workflow contracts, Story Decisions, Story Workbench, PPF revision protections, Storyboard, Production Shots, Previs/Animatic, Write/Edit/Refine surfaces, and provider-routing boundaries built for normal use.

The acceptance question is:

> Can PlotPickle make and refine a complete story by itself, through PlotPickle itself?

## Governing rule

Do not add a test-only shortcut that writes PPF, mutates storage directly, skips Story Decisions, bypasses Story Workbench, or fabricates downstream readiness.

The autonomous operator must travel through supported product/API/domain routes and leave the same provenance, revision, dependency, stale-state, and validation evidence as an interactive operator.

## Existing foundation to reuse

PlotPickle already has:

- `scripts/run-uat-autopilot.mjs`, which exercises registered product routes through Playwright MCP and local APIs;
- `config/uat-autopilot-registry.json`, which owns the current focused route registry;
- Story Decision contracts that are structured, revision-aware, non-canon, and Workbench-bound;
- Story Workbench application that performs revision-safe save/apply and targeted re-evaluation;
- a local-only Pi developer stack where Pi is the configured advisory reviewer and repair worker;
- existing local AI readiness and provider routing.

Extend these boundaries. Do not introduce another autonomous-agent framework.

## Authority change required

Current Story Decision and Story Workbench contracts explicitly require authenticated Human authority for creative decisions and canon application. Autonomous execution therefore needs one new explicit authority class instead of impersonating a Human.

Suggested contract:

`delegated-autonomous-operator`

Properties:

- explicitly enabled by project/run policy before autonomous execution begins;
- identifies the model/runtime/provider/agent responsible for each choice;
- cannot silently elevate itself into owner/admin/system authority;
- remains revision-bound and stale-safe;
- cannot bypass Story Workbench validation;
- cannot directly write PPF outside the canonical apply path;
- cannot silently enable paid/cloud providers beyond existing consent/budget policy;
- records complete machine-readable provenance for every decision and canon mutation;
- can be disabled so normal Human-authority behavior remains unchanged.

The autonomous runner must not claim `authenticated-human` authority.

## Required autonomous journey

A reference run should be able to start from a deterministic Afterglow v9 working copy and complete the following without Human clicks, answers, approvals, terminal input, direct database edits, source edits, or hidden fixture mutation:

1. Launch/readiness
   - verify PlotPickle is ready;
   - resolve configured local AI capability;
   - record exact app, project, runtime, model, provider, and capability identities.

2. Library
   - open the reference story through the normal Library path;
   - create/load a normal working copy without mutating immutable source evidence.

3. LEARN
   - inspect the applicable curriculum/frontier;
   - use Sage/curriculum guidance where needed;
   - identify prerequisites and currently eligible work.

4. PLAN
   - inspect current Foundations/story decisions;
   - fill or refine eligible structured fields through supported PLAN AI routes;
   - preserve Observed/Defined/Emerging/Missing/Locked semantics.

5. BUILD
   - inspect and refine the 24-sequence / 96-scene story structure through supported BUILD/workflow routes;
   - preserve stable canonical IDs and dependency links.

6. Story Workflow / Story Council
   - run bounded eligible Story Work Items;
   - invoke appropriate specialist agents;
   - reduce/group structured findings;
   - retain evidence refs, target refs, severity, confidence, and provenance.

7. Story Decisions
   - receive the same grouped Decisions produced by the normal Decision channel;
   - evaluate alternatives/conflicts using the configured autonomous operator;
   - answer through the Story Decision gateway using the new autonomous authority class;
   - never mutate PPF from the Decision route.

8. Story Workbench
   - open/prepare the same Workbench review package;
   - inspect current versus proposed state and validation axes;
   - modify/reject/accept as needed;
   - apply only through revision-safe Workbench canon application;
   - record changed refs and affected dependencies.

9. Targeted re-evaluation
   - rerun only dependency-backed affected work by default;
   - prove unrelated completed work remains current;
   - detect stale decisions/projections and reconcile them truthfully.

10. Visual story progression
   - advance through canonical visual readiness;
   - inspect character/location/relationship/story visual state;
   - maintain provenance and stale states.

11. Storyboard
   - enter through the real Storyboard route when prerequisites are actually met;
   - create/review frame intent and candidate/approved assets using normal contracts;
   - do not fabricate a Storyboard-ready state merely to advance the test.

12. Production Shots
   - create/use supported shot execution targets tied to canonical story/frame IDs;
   - preserve provider/candidate/approval provenance.

13. Previs / Animatic
   - sequence approved targets through the real Previs/Animatic workflow;
   - use honest placeholders where media is unavailable;
   - preserve timing/shot identity and upstream stale propagation.

14. Write / Edit / Refine
   - inspect and update the story/script projection through supported routes;
   - preserve source text versus generated/derived versus accepted Human-owned or autonomous-provenance text distinctions;
   - never rewrite unrelated text merely because one upstream field changed.

15. Convergence
   - continue bounded audit/refinement rounds;
   - resolve material Decisions where possible;
   - stop only at an evidence-based autonomous completion state or a truthful blocker.

16. Persistence/restart
   - save/close;
   - restart PlotPickle;
   - reopen the same project through normal UI/product paths;
   - prove PPF revision, decisions, provenance, workflow state, Storyboard, Production Shots, Previs, visual state, and script/text state survived;
   - resume without Human recovery steps.

## Route coverage requirement

Extend the UAT/autopilot registry so every applicable top-level creative surface has a canonical route and machine-verifiable readiness contract.

At minimum cover current equivalents of:

- Library
- LEARN
- PLAN
- BUILD
- Story Decisions
- Story Workbench
- visual story / readiness
- Storyboard
- Production Shots
- Previs / Animatic
- Write
- Edit
- Refine
- Reports / final evidence where applicable

The runner must produce route coverage evidence and identify any registered route it could not enter or operate.

## Autonomous operator decision policy

The operator should use bounded deterministic rules before model judgment where possible.

Suggested order:

1. stale/revision/security/integrity failure -> fail closed or refresh;
2. deterministic prerequisite missing -> remain Locked/blocked;
3. one clearly valid repair with no material creative divergence -> accept if policy permits;
4. multiple creative alternatives/conflict -> model evaluates evidence, curriculum, dependencies, and downstream impact;
5. low confidence or unresolved contradiction -> request another specialist pass or alternative within bounded retry limits;
6. repeated unresolved material conflict -> record truthful blocker rather than looping forever.

No unbounded autonomous loop.

## Provenance requirement

Every autonomous choice must preserve at least:

- authority class;
- autonomous run ID;
- operator/agent ID;
- model role and model ID;
- provider/runtime;
- base/current/resulting revision;
- source Decision/work item IDs;
- evidence refs and target refs;
- chosen response class;
- rationale summary suitable for audit without hidden chain-of-thought;
- affected refs;
- timestamp;
- validation result;
- whether canon changed;
- whether downstream projections became stale.

Do not store hidden chain-of-thought.

## Pi analysis and developer review

Pi is already configured as PlotPickle's local advisory reviewer and repair worker. Use that existing boundary rather than adding a new reviewer.

Required Pi review targets before promotion:

- authority-boundary regression: prove autonomous mode cannot masquerade as Human;
- no-direct-PPF-write review;
- stale/revision fail-closed behavior;
- route coverage completeness;
- bounded retry/loop behavior;
- provider consent/cost boundary;
- persistence/restart integrity;
- missing test or architecture boundary analysis.

Use the repository-configured Pi paths (`scripts/run-pi-code-quality-review.mjs` and the configured local UAT repair worker) when a local developer runtime is available. Pi remains advisory; deterministic tests/BEN/build/CI are authoritative.

## Implementation slices

### Slice A — autonomous authority contract

- add explicit delegated autonomous authority type/policy;
- update Story Decision response validation;
- update Workbench completion/apply authority handling;
- preserve normal Human authority unchanged;
- add deterministic tests for both authority modes and impersonation rejection.

### Slice B — autonomous decision/workbench operator

- add bounded evaluator that consumes one Decision + evidence + project revision;
- emits one existing structured response class;
- sends that response through the existing Decision gateway;
- prepares/applies through existing Workbench workflow;
- records provenance and retry evidence.

### Slice C — end-to-end route orchestrator

- extend `run-uat-autopilot.mjs` or create a narrowly owned autonomous-story runner that reuses its Playwright MCP/runtime helpers;
- navigate registered real product routes;
- avoid direct state mutation;
- record route entry/action/results.

### Slice D — downstream visual production

- connect canonical readiness -> Storyboard -> Production Shots -> Previs through existing routes/contracts;
- preserve Locked/Missing and stale behavior;
- use configured providers only under existing capability/cost policy.

### Slice E — convergence and restart

- bounded full audits plus targeted re-evaluation;
- evidence-based stop condition;
- save/restart/reopen/resume proof;
- final machine-readable report.

## Tests

Add focused deterministic coverage for:

- Human authority remains unchanged in normal mode;
- autonomous authority must be explicitly enabled;
- autonomous operator cannot send `authenticated-human` authority;
- Decision responses remain non-canon;
- Workbench remains the only autonomous canon application path;
- stale Decision/revision rejects autonomous apply;
- direct PPF/storage mutation by runner is absent;
- route registry contains required creative surfaces;
- every registered autonomous route can be entered or reports a truthful prerequisite blocker;
- bounded retry limit stops churn;
- provider/cost consent is preserved;
- targeted re-evaluation remains bounded;
- persistence/restart resumes correctly;
- Afterglow source fixture remains immutable;
- final report records route coverage and provenance.

## Acceptance criteria

1. One autonomous command/run can start from a deterministic Afterglow working-copy state and complete the supported PlotPickle story pipeline without Human intervention during the run.
2. The autonomous runner uses supported PlotPickle product/API/domain routes rather than direct database/PPF/test-fixture mutation.
3. LEARN, PLAN, BUILD, Story Workflow, Story Council, Story Decisions, Story Workbench, visual readiness, Storyboard, Production Shots, Previs/Animatic, Write/Edit/Refine and persistence/restart are exercised when eligible.
4. Autonomous Story Decisions use an explicit non-Human delegated authority class and cannot impersonate an authenticated Human.
5. Story Decision responses remain non-canon and revision-safe.
6. Canon changes still pass through Story Workbench validation/application and preserve revision/provenance boundaries.
7. Stale state fails closed rather than overwriting newer story state.
8. The autonomous operator uses bounded retries and stops truthfully on an unresolved blocker.
9. Provider routing respects existing local/private/cloud capability, consent, and budget rules with no silent paid-cloud fallback.
10. Storyboard/Production Shot/Previs readiness is earned through real prerequisites; Locked/Missing states are not bypassed.
11. Targeted re-evaluation reruns only dependency-backed affected work by default.
12. Save/restart/reopen/resume succeeds without Human repair.
13. A machine-readable final report contains route coverage, revisions, decisions, provenance, affected work, stale projections, provider/model identities, timing, retries, blockers, and final readiness state.
14. No hidden chain-of-thought, credentials, private keys, or unnecessary private story text is stored in evidence.
15. Pi advisory review reports no unresolved authority/route/boundary blocker when the local Pi environment is available.
16. Focused tests, UAT/autopilot contracts, BEN, production build and required exact-head CI are green before merge.

## Relationship to #1421

This requirement changes the flagship #1421 proof from a Human-driven convergence journey to an autonomous integration examination.

#1421 should remain the editorial/convergence reference, but its primary proof should become:

`Can PlotPickle autonomously travel through the real product workflow, make bounded decisions, apply validated changes, produce visual/story artifacts, converge, restart, and resume without Human intervention?`

Human-interactive UAT remains useful separately, but it is not the primary acceptance path for this autonomous reference run.

## Non-goals

- no second agent/orchestration framework;
- no direct autonomous PPF writer;
- no fake Human identity;
- no bypass of revision or Workbench validation;
- no unbounded self-improvement loop;
- no silent paid/cloud fallback;
- no fabricated Storyboard/Previs readiness;
- no requirement to generate a fully rendered feature film merely to prove the logical end-to-end pipeline;
- no weakening of immutable Afterglow source evidence.
