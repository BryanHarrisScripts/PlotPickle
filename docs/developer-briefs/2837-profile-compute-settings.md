# Profile-owned compute setup and one readiness contract — #2837

## Human intent
After signing in, a Human may open the example or configure Local, Cloud or Hybrid. Writing, images, video and agents must reuse the selected defaults and encrypted local keys after restart. Settings must report the same readiness that execution uses. Startup must probe local availability without repeating paid tests.

## Observed gaps
Compute authority/settings use OS-account storage rather than the signed-in profile. The Settings overview treats configured media as ready while execution requires successful tests. Image failures preserve previous success stamps. First-use concurrent private reads also race when creating a profile directory.

## Implementation boundary
A versioned compute-setup record lives in the existing encrypted profile vault. Existing typed stores project named sections of that record; writes serialize by storage/profile to retain independent simultaneous updates. Provider jobs remain separate encrypted profile records. Legacy OS-account credentials are preserved and never silently imported. Existing profile-owned credential records remain readable. Existing OS-scope keys require deliberate re-entry for the intended profile; no destructive automatic migration is performed.

Local runtime preferences and model roles belong to the profile; installed software, hardware and benchmark inventory remain Node-owned. Anonymous runtime reads expose only default setup and Node availability, never saved private setup. Compute API mutations use the existing session/CSRF boundary and client fetch helper. Direct narration/cloud-authority routes and protected Outline task resolution establish the same profile scope.

The shared readiness contract requires saved authority plus a successful capability test; local readiness also checks current service availability. The overview reads routing readiness instead of deriving readiness from configuration. Writing/agent execution requires verified provider authority. A failed image test clears image verification, including experimental local workflow evidence, while preserving unrelated video proof. Saved setup loading makes no cloud request.

## Acceptance evidence
- Actual auth/vault regression uses isolated synthetic profiles and a real HTTP media gateway; save authority and restart make no paid request.
- Concurrent writing/media/routing/agent saves survive and remain encrypted; another profile sees no key or default provider.
- Real synthetic image failure invalidates the previous image stamp while retaining independent video verification.
- Shared readiness rejects configured-only/unavailable routes; UI reads the same selected route result.
- Locked/missing profile writes are denied; plaintext OS remnant is not imported.
- Storage directory concurrency retains symlink/redirect protections.

## Limits
Bryan's actual local vault, Windows encryption round-trip and real paid providers remain untested here. No real credentials or account data are collected or uploaded. This PR does not recover data damaged before #2836 or automatically claim a legacy OS key belongs to a particular Human.
