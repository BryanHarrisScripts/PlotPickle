# Govern CI, DSDD and Casebook claims by approved truth

Issue: #2932. Implementation branch: `feat/approved-truth-claims`.

## Human request and outcome

“Evolve the existing seven-layer PlotPickle CI and DSDD/Casebook system so that its claims are governed by the truths we have already approved. The outcome we want is not simply more green tests. It is fewer occasions where PlotPickle tells you something works and you discover that it doesn't.”

Create this brief and begin implementation. Notify the Human when ready to create the PR. PR creation and merge are outside this execution's authority.

## Governing authority

Use white paper v3.0, `docs/white-papers/AI_Programming_Evolution_White_Paper.md` (PR #2844), and the existing approved contracts. Preserve human intent → confirmed interpretation → versioned contract → constraints → implementation → independent observation. Implementation, tests and an agent's confidence cannot redefine success.

PP-SAVE-001 v1.0.0 is the first obligation mapping: T1–T8, exact selected media Save before Lock, same-profile/device restart, independent recovered identity, protected unrelated work and Previs handoff. PP-NARR-001 v1.0.0 and PP-COMP-002 retain their existing authority; discovery is not real execution, synthetic evidence is not Windows proof, subjective storytelling quality requires Human judgment. PP-NARR-SEQ-001 is explicitly proposed and must not silently amend approved PP-NARR-001.

## Assessment and existing owners

GO: extend `lib/verification/verification-core.mjs`, `lib/verification/verification-contracts.mjs`, `lib/verification/development/proof-routing.mjs`, the existing typed catalogue, DSDD evidence contract/gateway and Casebook evaluator/manifest. Keep all seven architecture layers, ownership/impact selection, existing tests, secret/spend boundaries, exact-head CI and canonical stores. No parallel Product Truth engine or second canonical state.

Observed source defects: a typed runner's absent/unknown result defaults to pass; evidence emission can invent pass when selected tests have no execution record; Casebook blockers can mask a contradiction; DSDD accepts generic supporting evidence without requirement/action/scope binding. These are source observations, not newly reproduced Windows outcomes.

## Delivery phases

1. Close false-green paths throughout existing seven-layer execution and evidence. Require explicit results for every selected test; missing/unknown results are UNPROVEN, dependency prevention is BLOCKED, contradiction takes precedence. Skipped checks and an unaffected layer do not prove a product obligation. Retain successful engineering checks and describe precisely what their runner established. Expose execution versus product claims in artifacts and CI summaries; local/CI exits cannot turn a blocked or unproven selected execution green.
2. Strengthen DSDD evidence through its current owner: bind to locked requirement, intent version/digest, exact evaluated revision, declared environment/configuration, promised outcome, action, independent observation and proof scope. Test/build evidence cannot claim observed product success. Surface BLOCKED and UNPROVEN; contradictions resolve FAIL even if the submitted status says PASS. Old insufficient records remain visible as insufficient, never grandfathered PASS.
3. Map PP-SAVE-001 in the existing Casebook definition to contract version and T1–T8. Evaluate every required obligation using independent scoped evidence; a mock, stale revision, wrong version, unrelated obligation or self-report cannot satisfy required product proof. Preserve legacy Casebook `uncertain` compatibility while emitting canonical PASS/FAIL/BLOCKED/UNPROVEN claims. Do not label proposed contracts approved. Broader contract-by-contract mapping follows separately; unmapped engineering tests receive bounded execution-only claims.
4. Verify governance adversarially, preserve exact limitations and establish a comparison record. Retain baseline and post-change results for false-PASS attempts; reuse Casebook adequacy metrics for escaped defects/repeat runs. Real Windows workflow recovery and reduction of escaped user failures stay UNPROVEN until actual observations exist.

## Evidence rules and acceptance

- PASS is scoped conformance, not whole-app success. FAIL is an observed contradiction. BLOCKED identifies a necessary condition preventing evaluation. UNPROVEN identifies missing, stale or inadequate evidence.
- A build or test result remains useful engineering evidence. Without independent product observation it cannot say Save/Lock survived process restart, inference ran on Bryan's machine, generated media plays, or captions tell a compelling story.
- Selection is not execution. Every selected test requires one explicit result. Duplicate, absent and unknown outcomes cannot become PASS; denied or skipped dependencies remain disclosed.
- A claim names contract ID/version/obligation (or locked DSDD requirement), exact revision, environment/configuration, expected promise, performed action, independently observed result, artifact reference and scope. Changed versions/revisions/configurations invalidate applicability.
- An observed contradiction cannot be hidden by a claimed PASS, incomplete evidence or a simultaneous blocker.
- Trusted artifact references are supplied by the verification owner, not inferred from an agent's `independent: true` flag. Authenticated evidence submission remains under the existing authority boundary; the evaluator checks applicability, not the authenticity of arbitrary prose.
- Do not weaken assertions, remove tests, change approved outcomes, activate providers, perform paid generation or change user story data.
- Brief, focused negative/positive regressions, catalogue registration, schema consistency, ownership routing, convergence and required UAT/build validation must pass before reporting local PR preparation ready. Exact-head GitHub results are pending until the authorized PR is created.

## Validation and explicit limits

First record reproducible false-PASS inputs against the existing evaluators. Then prove the same inputs yield UNPROVEN/BLOCKED/FAIL as appropriate; positive independently scoped observations still pass. Exercise CI core and shadow/CLI consumers, DSDD gateway delegation, Casebook manifest propagation and existing evidence/privacy tests. Run focused UAT contracts and production build. Do not infer Human Windows recovery or provider success from these checks.

Convergence proves this diff fulfils the declared governance scope; it does not prove the application outcomes protected by PP-SAVE-001. Notify the Human with exact validation results and remaining limits before creating the PR.

## First implementation boundary

The first delivery closes the reproduced false-PASS paths, gives every selected/skipped catalogue runner a bounded execution claim, and maps PP-SAVE-001 T1–T8 through the existing Casebook evaluator. Other approved product contracts remain authoritative but have not yet received individual machine-readable obligation mappings. Their runner results cannot establish product conformance.

DSDD's public evidence intake has no independently admitted verifier receipt. It retains submitted evidence and reports UNPROVEN, including downgrading historical unsupported PASS records on read. Its evaluator can accept an independently validated observation supplied by a verification owner; connecting such a receipt to the live intake is follow-up work. A request body cannot grant itself trusted references or verifier identity. This is an explicit proof gap, not an assertion that no real operation worked.

`docs/verification/2932-approved-truth-baseline.json` preserves three observed governance defects and their regression comparison. Actual Windows restart/Save/Lock, provider execution, subjective narration quality and fewer escaped user failures remain unproven by this delivery. Five historical #1941 assertions fail identically on pristine main and this branch; the current catalogue no longer selects that historical test. Do not rewrite those unrelated expectations to inflate this change's pass count.
