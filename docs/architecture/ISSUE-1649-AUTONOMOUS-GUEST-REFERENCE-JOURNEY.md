# Issue #1649 Autonomous Guest Reference Journey

Slice E of #1644 does not create a new autonomous demo route. It extends the existing one-command Afterglow reference controller at `scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs` and projects the evidence that controller already earns through the canonical lifecycle.

## Real route

The reference still uses the existing PlotPickle path:

`Afterglow Library bootstrap → registered autonomous routes → Story Decision → Story Workbench → visual/production routes → durable Guest task → real application restart → registered routes again → packaged report/continuation`

The lifecycle projection is implemented in `lib/verification/autonomous-reference-lifecycle.mjs` and uses the shared contracts from #1647, #1646 and #1648.

## Seven-stage proof

A PASS must contain exactly:

`enter-understand → learn-prepare → plan-decide → create-execute → validate-repair → approve-persist → package-present-continue`

The projection fails closed unless the real reference evidence contains a known project/revision, delegated Guest run/operator, operated Story Decision, validated Workbench apply, deterministic route-contract PASS, completed durable Guest task, verified application restart and idempotent post-restart continuation.

## Authority preservation

The integration found and preserved an important pre-existing PlotPickle authority boundary.

Human canonical changes retain the explicit Human writer route. Separately, PlotPickle already has a server-policy-backed `delegated-autonomous-operator` Story Decision route that may continue through validated Story Workbench inside an explicitly enabled autonomous Guest run. The lifecycle gate now composes that route rather than incorrectly forcing it through Human identity.

For delegated canonical persistence the lifecycle requires all of the following:

- Guest actor remains explicitly delegated and has no Human profile ID;
- Story Decision authority is `delegated-autonomous-operator`;
- server run policy was approved for the same autonomous run and project;
- operator, run and project identities match the lifecycle envelope;
- Story Workbench validation completed;
- approval and Workbench evidence references match the lifecycle envelope;
- the result is recorded as autonomous policy approval, never Human approval;
- no broader operational authority is granted by the persistence decision.

A Guest cannot borrow a Human writer approval, and an arbitrary agent cannot fabricate a Workbench approval projection.

## Validation and bounded failure

The successful reference path uses the existing registered route controller and its existing contract suite as the validation authority. The lifecycle validation adapter records the exact project revision and reference-only evidence.

The route runner already executes `tests/issue-1553-autonomous-convergence-restart.test.mjs`. That existing contract proves bounded fail-closed behavior for:

- targeted re-evaluation touching unrelated work (`reevaluation-fanout`);
- convergence retry exhaustion (`convergence-limit`);
- restart/resume state mismatch (`resume-state-mismatch`).

This is the required failure/stop proof. No artificial product defect or second repair engine is introduced for #1649.

## Restart and continuation

The existing controller initializes a durable Guest route task before a real PlotPickle application restart, claims it only after the new process is running, completes it from a real operated route receipt and then reads final durable task state.

The second route pass must recover the already answered Story Decision rather than applying it again. Lifecycle continuation is permitted only with the same Guest actor/authority snapshot. Together these prove restart continuity and idempotent continuation where the existing architecture supports it.

## Privacy

The reference report stores bounded identifiers, revision/state digests, authority classes, route dispositions, validation references, task state and lifecycle projections. It does not store hidden reasoning, credentials, prompts, page text or private Human story content.

## Stopping rule

#1649 ends when the existing reference runner proves the real seven-stage path and exact-head CI is green. Plain-language product status belongs to #1650. Route/status cleanup belongs to #1651.