# #2938 — bounded safety, progress and implementation correspondence

## Human intent and assessment — GO
Finish the remaining white-paper CI work, merge #2938 when exact-head gates are green, then proceed to #2939 and #2940. The final comprehensive Human audit is #2943. Approved white paper v3.0 section 6 and PP-SAVE-001 v1.0.0 remain unchanged: model safety is insufficient without progress, and a model is not proof of its implementation.

## Existing owners and findings
Reuse lib/verification/development, the Layer 7 verification catalogue and existing encrypted Save/restart proofs. No new truth store, persistence engine, paid inference or user data mutation.

core/storage/profile-private-browser.ts persistActiveProfileProject performs save-project and sync-library-index as separate awaited HTTP mutations. queueWriteOperation fences authority and acknowledgements but privateMutation has no finite request deadline/reconciliation protocol. core/storage/project-library/revision-safe-browser.ts checks profile/project/revision and awaits persistence/flush; this is correspondence evidence, not an atomic transaction or whole-path progress proof. Record these gaps; do not silently fix or certify old product work deferred to #2943.

## Smallest delivery
1. Exhaustively explore a bounded approved Save model with explicit project/index writes, lost acknowledgement, rejection, finite abstract response policy, recovery and approval. Test T1/T2 safety and T8 progress on every reachable state/path; report reproducible counterexample traces. Abstract clock steps do not choose a new product timeout.
2. Reject reachable nonterminal dead ends and cycles even when a completion path exists. Interruption may yield UNKNOWN while retaining work; reconciliation under restored dependencies must end committed/rejected. UNKNOWN is not successful save.
3. Store an edition/digest-bound assurance record with exact implementation excerpts/digests, per-transition correspondence, concrete gaps and existing integration targets. Reject unsupported atomic abstraction, source drift, missing mappings and fixture/model promotion. Keep correspondence PARTIAL and product UNPROVEN.
4. Independent negative controls: false Saved/Locked, atomic collapse, pending forever, alternate nonterminating branch, interrupted lost acknowledgement, stale code and unsupported product claim.
5. Admit the new test and all inputs against already-approved PP-SAVE-001 T1/T2/T8 and white-paper W8/W9. Section 6 provenance is recorded unchanged; do not amend existing indexed oracle descriptors.

## Validation and completion
Run truth admission before new tests, focused regressions, focused UAT, production build, verification routing/BEN/convergence and exact-head GitHub gates. Maintain the PR development ledger. Merge authority is granted for this task. A valid assurance record proves its bounded model/integrity checks, not normal Windows launcher, real provider, interrupted storage semantics or all application mathematics. #2943 retains Human interpretation, normal workflow and implementation-gap confirmation; #2939 owns broader composition/migration and #2940 owns measured benefit.
