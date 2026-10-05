# Developer brief — Issue #2736

Parent: #2707

## Outcome

Adopt the first three Phase 3 embedded Mastra roles into the existing host-owned durable checkpoint contract:

- Mira Threadmere / `continuity`
- Critics' Circle / `critic`
- Quillan Reedcloak / `creative-director`

This slice extends the proven checkpoint seam only. It does not add a new visible product surface, perform inference, start providers, or claim configured-provider application recovery.

## Existing authority

Keep the authority already established by #2707:

- Mastra remains the application-agent execution owner.
- Agent Profiles remain role/capability owners.
- Responsibility Runs remain lifecycle/budget/approval owners.
- PPF/project transitions remain canon owners.
- Pi Durable remains bounded persistence/recovery behind PlotPickle-owned authorization callbacks.

No checkpoint contract may widen grants, invent a profile identity, change provider/model routing, or turn a proposal into canon.

## Role contracts

### Mira Threadmere

Profile: `mira-threadmere`
Role: `continuity`
Existing requested capabilities:

- `continuity-analysis`
- `project-context-read`
- `proposal-draft`

Durable step class: replay-safe `review` only.
Artifacts remain continuity findings/repair candidates and are non-canonical.

### Critics' Circle

Profile: `critics-circle`
Role: `critic`
Existing requested capabilities:

- `critique`
- `project-context-read`
- `proposal-draft`

Durable step class: replay-safe `review` only.
Artifacts remain advisory critique and are non-canonical.

### Quillan Reedcloak

Profile: `quillan-reedcloak`
Role: `creative-director`
Existing requested capabilities:

- `project-context-read`
- `proposal-draft`
- `specialist-coordination`

Durable step class: replay-safe `proposal` only.
Artifacts remain creative-direction proposals and are non-canonical.

## Scope and replay rules

Every checkpoint input is still scoped by Human profile, project ID, project revision, run ID, context receipt, host-selected provider/model, objective revision and Human approval reference.

Stable input produces stable durable identity. Changing any scoped authority value must change that identity. Wrong profile, wrong role, widened/reduced grant snapshot, unsafe replay policy, wrong step class or unsupported role fails closed.

Only review/proposal work is admitted. Generation, publication, repository mutation, game effects and other external/non-replayable operations are outside this contract and still require independent idempotency or fresh Human authorization.

## Proof boundary

This PR proves source-backed role adoption and checkpoint-envelope validation. It performs zero provider/model calls and creates no startup work. It does not claim that a visible Continuity, Critics' Circle or Creative Director product journey can already close/reopen/resume through the UI.

That later application wiring remains parent #2707 work.

## Acceptance

- Canonical existing Agent Profile data matches all three durable role contracts.
- Each role can produce a normalized checkpoint input through the existing shared seam.
- Stable input has stable identity; scoped authority changes alter identity.
- Wrong profile/role/grants and unsafe/non-role step classes fail closed.
- Returned adoption metadata explicitly says non-canonical and zero provider requests.
- Focused regressions, convergence and exact-head Architecture Verification pass before merge.
