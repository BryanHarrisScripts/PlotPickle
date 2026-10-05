# Developer brief — Issue #2740

Parent: #2707

## Outcome

Implement Phase 4's owner-preserving durable handoff boundary for Agent Profiles whose execution deliberately remains outside the embedded Mastra/Pi checkpoint path.

The canonical Agent Profile registry currently contains these non-embedded execution kinds:

- `buzz-managed`
- `plotpickle-uat`
- `deterministic-observer`
- `deterministic-gate`
- `repository-handoff`

The handoff record may preserve authorized task, run and evidence references. It does not become a new execution owner.

## Ownership rules

### BUZZ-managed

BUZZ remains the execution/workspace owner. PlotPickle may keep a bounded handoff reference, but must not clone a BUZZ workspace into Pi, persist private-room content in the durable checkpoint store, or auto-subscribe a private room.

### PlotPickle UAT

The existing PlotPickle UAT runtime remains the execution owner. A durable handoff can identify a UAT task/result reference only; it does not convert Avery or UAT work into a Pi Agent.

### Deterministic observer / deterministic gate

The deterministic system remains execution and evaluation authority. Persist deterministic evidence references when useful. Do not invoke a model merely to make the record durable.

### Repository handoff

The repository/DSDD/developer workflow remains execution authority. A durable handoff does not grant repository mutation, merge, shell, credential or publication authority.

## Data boundary

A Phase 4 handoff stores only:

- canonical Agent Profile ID;
- canonical runtime role ID;
- canonical execution kind;
- bounded task/run references;
- bounded evidence references;
- a short non-sensitive summary;
- deterministic handoff identity;
- explicit authority flags.

It rejects private payload/context, prompts, conversation text, workspace state, credentials/secrets, hidden reasoning and private-room content. The builder issues no provider request, model request, external action, subscription, repository mutation or canon write.

## Validation

The caller must supply the canonical Agent Profile record. The handoff adapter validates the profile's execution kind and role against the supported owner policy. `embedded-mastra` fails closed because those roles use the Phase 1–3 checkpoint seam.

## Acceptance

- Every current non-embedded execution kind is explicitly classified.
- Handoff identity is deterministic over owner/profile/role/task/run/evidence references.
- Canonical profile/role/execution-kind mismatches fail closed.
- Forbidden private payload fields fail closed rather than being silently copied.
- BUZZ workspace migration/private auto-subscription remain false.
- Deterministic owners retain no-model planning.
- Repository handoff gains no repository authority.
- Focused regression, convergence and Architecture Verification pass before merge.
