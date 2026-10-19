# #3118 authenticated Windows browser UAT — read-only Story Factory journey

## Decision

Extend PlotPickle's existing WebMCP acceptance sidecar and isolated synthetic-Human runtime. Do not create a second browser authority, attach to the owner's ordinary browser profile, or automate credentials.

This first bounded #3118 slice adds one named rendered acceptance journey:

`Library → Mind Map → World Map → Outline → Write → Storyboard → Previs → Timeline`

The journey uses the real PlotPickle browser/application handlers. It opens the packaged Afterglow example only inside the disposable synthetic profile, verifies one stable selected-project identity through every surface, records browser checkpoints, returns through the visible Dashboard control, and fails when a rendered checkpoint, application alert, identity, or browser diagnostic contradicts the expected result.

## Authority and privacy

- The verification server remains loopback-only and uses `verificationSyntheticRuntime`; no owner cookie, passphrase, project home or private story is inherited.
- The verifier explicitly posts Story Mode `local` before the journey. Server network is disabled and the journey never clicks Generate, Ask Agent, Save, Save & Lock, Approve, Unload or Delete.
- Browser evidence contains surface/checkpoint and bounded diagnostics, not story text, credentials, hidden reasoning, prompts or provider responses.
- Loading packaged Afterglow mutates only the disposable synthetic profile. It is not a Human approval or canon promotion.

## Implementation

- `core/sidecars/webmcp-acceptance-sidecar.mjs` registers `story-factory-read-only-journey` and operates the visible application in the approved order.
- The existing Library/Mind Map/World Map rendered path is reused; the downstream stage checks use current Dashboard controls and registered surface boundaries.
- `scripts/verification-webmcp-live.mjs` enforces LOCAL, runs the named journey, fails closed on any non-PASS report, and writes the report path into the live summary.
- `tests/issue-3118-story-factory-browser-journey.test.mjs` protects named admission, route order, project continuity, no mutation/provider action and red-on-missing-checkpoint behavior.

## Evidence limits

Green Linux or Windows CI proves only an isolated rendered test profile at the tested exact head. It does not prove the owner's normal authenticated profile, Brotherly Love data, provider readiness, paid generation, creative quality, Save/Lock persistence, browser restart recovery, the production UAT worker's descendant termination, independent Human visual acceptance, Chat/Work remote dispatch or autonomous merge authority.

After exact-head CI is green and merged, the owner runs the live verifier on Windows. A clean PASS supplies the browser-journey half of #3118. A separate bounded follow-up must integrate explicit start/status/STOP with the actual owned browser-UAT process tree and independently prove descendant exit plus unrelated-sentinel survival before #3118 can close.
