# Developer brief — Issue #2738

Parent: #2707
Depends on: #2736 / PR #2737

## Outcome

Connect the existing PRE-PRODUCTION Responsibility Run envelope to the first Phase 3 durable checkpoint contracts without creating a second run model or executing an Agent.

This slice adopts only:

- `continuity-review` → Mira Threadmere / `continuity`
- `story-review` → Critics' Circle / `critic`
- `creative-coordination` → Quillan Reedcloak / `creative-director`

`craft-guidance` and `structure-review` remain on their current paths. Story Architect already has its dedicated protected product controller; Sage is not silently pulled into Phase 3.

## Authority chain

The existing PRE-PRODUCTION envelope remains the source of:

- Agent Profile identity;
- Responsibility Run ID and objective revision;
- bounded source references and task identity;
- writer-approval verification mode;
- proposal-only authority.

The host must separately supply:

- Human profile ID;
- current project ID and revision;
- host-selected provider and model;
- Human approval reference;
- stable bounded work-unit IDs.

The adapter derives the context receipt from the existing run context. It derives the exact capability grant snapshot from the already-adopted #2736 role contract. The browser or caller cannot submit widened grants.

## Replay policy

Continuity and Critics' Circle map to replay-safe `review` steps. Creative Coordination maps to replay-safe `proposal` steps. All output remains non-canonical. Publishing, generation, repository mutation, game effects and any other non-replayable operation remain outside this adapter.

Planning performs zero provider/model calls and does not auto-resume. A later host execution slice must still explicitly activate/resume the durable task and re-authorize the current project/context/provider/budget before work.

## Acceptance

- Existing PRE-PRODUCTION envelopes for the three adopted roles produce the shared #2736 checkpoint input.
- Profile ID, role ID, Responsibility Run ID and objective revision cannot be substituted.
- Context receipt is deterministically derived from the existing bounded run context.
- Host project/profile/revision/provider/model/Human-approval values remain identity-significant.
- Caller-supplied grants are not accepted.
- Craft Guidance and Structure Review fail closed in this adapter.
- Planning performs no provider/model request, PPF write or automatic resume.
- Focused regression, convergence and Architecture Verification pass before merge.
