# #2817 UAT persistence/auth/routing repair

## Objective

Repair the three live-UAT failures found on October 6, 2026 across Storyboard, Previs, Settings and Timeline so that previously established user authority and saved visual state behave durably across navigation, reload and login.

## UAT findings

### 1. Storyboard save confirmation does not complete

Observed:
- Lock/unlock works.
- An unlocked Shot can report `Save confirmation pending`.
- Pressing Save does not visibly or durably complete the save.
- Downstream Previs narration can then report that the Shot needs a saved local Storyboard image even though the visual is present and can be locked.

Expected:
- Save must materialize or confirm the currently selected Storyboard image as a durable local artifact.
- Save must produce an observable state change.
- The saved-local marker and asset identity must survive reload/project restoration.
- Existing lock state must be preserved rather than silently reset.
- Downstream Previs must recognize the same saved artifact without requiring a second save path.

### 2. Previs narration incorrectly reports sign-in required

Observed:
- A Shot can be saved and locked.
- Create narration can still return `Sign in to authorize narration generation` while the Human is already authenticated.

Root contract:
- Narration is a profile-authorized mutation.
- The authenticated profile already exposes a CSRF token.
- The client request must include the current profile mutation proof rather than translating a missing token into a false sign-in diagnosis.

Expected:
- Previs obtains/uses the current profile CSRF token for narration generation.
- Missing/expired proof is refreshed or reported accurately.
- An authenticated Human is not told to sign in when the real problem is missing mutation proof.
- Existing cloud-writing authority and Human confirmation boundaries remain intact.

### 3. MiniMax H3 authority and verification do not persist into Timeline

Observed:
- The Human saves MiniMax provider authority and successfully runs the H3 video test.
- After profile reload/login, the API key/authority appears to require setup again.
- The Human has to re-enter the key, save authority and rerun the H3 test.
- Timeline then reports `PREFLIGHT FAILED · No verified video generation route is ready for this Shot` even after H3 has just been successfully tested.

Current Timeline authority check:
- selected ready video route from `/api/ai-routing/status`; or
- MiniMax media profile with `configured && videoVerifiedAt`.

Expected:
- Provider secret remains in protected profile-owned storage and is never rendered back to the UI.
- Provider authority is restored automatically for the authenticated profile.
- Successful H3 verification persists `videoVerifiedAt` and remains discoverable after reload/login.
- Timeline preflight sees the restored MiniMax H3 readiness without requiring a second paid verification test.
- No silent provider activation and no silent cloud fallback.
- Paid/data-sharing acknowledgement remains required only when an actual chargeable request is made, not merely to restore already-saved authority.

## Build order

### Phase 1 — Storyboard durable Save

Trace the current Save handler and local-asset contract.

Implement:
- durable local materialization/confirmation for the current image;
- stable saved-local state;
- lock preservation;
- reload restoration;
- downstream recognition by Previs.

Regression proof:
1. unlock → Save changes state from pending to saved;
2. reload restores saved status;
3. lock remains as intended;
4. Previs accepts the saved Shot as narration-eligible.

### Phase 2 — Previs narration CSRF/auth

Trace the existing narration client call and `/api/previs/narration` authorization boundary.

Implement:
- fetch/use current authenticated profile CSRF token;
- send `X-PlotPickle-CSRF` on narration mutation;
- distinguish unauthenticated from missing/expired mutation proof;
- preserve provider authority and writing-model selection.

Regression proof:
1. authenticated + saved+locked Shot can create narration;
2. request contains CSRF proof;
3. unauthenticated remains blocked;
4. stale token reports authorization refresh/problem rather than false login state.

### Phase 3 — MiniMax authority + H3 verification persistence

Trace:
- `/api/cloud-story-mode/provider`;
- protected provider storage;
- media-routing store;
- H3 test completion path;
- profile restore/startup hydration;
- `/api/ai-routing/status` and `/api/media-routing/status`.

Implement:
- restore saved MiniMax authority for the authenticated profile on startup/login;
- preserve secret outside the PPF and never echo it back;
- retain successful H3 `videoVerifiedAt`;
- keep route readiness coherent between media-routing and ai-routing status;
- ensure Timeline can resolve MiniMax after restore.

Regression proof:
1. save authority once;
2. successful H3 test stamps verification;
3. reload/profile restore keeps configured state;
4. secret is not rendered;
5. `videoVerifiedAt` survives;
6. Timeline Generate motion preflight resolves MiniMax;
7. no extra paid test is required merely to restore authority;
8. Human confirmation remains required before actual generation.

## Cross-surface acceptance

- Storyboard Save is durable and observable.
- Previs narration works from a saved+locked Shot for an authenticated Human.
- MiniMax authority survives profile reload/login.
- H3 verification survives reload/login.
- Timeline does not falsely fail preflight after successful H3 verification.
- Existing source/provenance, lock, Human authority, billing acknowledgement, data-sharing acknowledgement and no-silent-cloud-fallback rules remain intact.

## Delivery

Build → focused tests → fix → open PR → exact-head required verification → fix until green → merge when green.
