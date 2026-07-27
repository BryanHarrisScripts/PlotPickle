# Phase 6 — Reliability and recovery

Phase 6 hardens the merged GitHub collaboration workflow after Phase 5 invitations and roles are complete.

## Scope

- Queue explicit GitHub writes while offline and retry them safely.
- Renew expiring GitHub App user tokens without interrupting local writing.
- Recover from moved or renamed repositories.
- Detect deleted or replaced approved and proposal branches.
- Provide conflict guidance that identifies the exact stale base and affected canonical files.
- Preserve a credential-free collaboration audit history.
- Add end-to-end sandbox collaboration tests.
- Re-run Windows packaging and clean-machine startup validation.

## Safety boundaries

- Local writing remains available when GitHub is unavailable.
- Retries are explicit, idempotent and guarded by expected commit SHAs.
- Credentials never enter projects, invitations, queues, reports, exports or commits.
- Recovery never force-pushes an approved branch.
- A queued proposal never changes the approved story until Project Lead review.

## Dependency

This stacked planning PR depends on Phase 5. It should be retargeted to `main` only after the Phase 5 invitations and collaborator-role PR is merged.
