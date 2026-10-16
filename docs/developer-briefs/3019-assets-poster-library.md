# #3019 — ASSETS navigation, first Poster creation and Library image

Parent issue #3019 remains open. This PR is a bounded first product slice, not closure of Characters/World/Collectibles/Sounds/portable-media work.

## Human intent
A Human with Brotherly Love selected in Library can open ASSETS, generate a poster using configured local/cloud image routing and deliberate art direction, Save a draft, explicitly approve it, and see that poster on Brotherly Love's Library load card. Afterglow packaged poster display is unchanged. New Characters links to existing Mind Map character generator; World shows retained project images read-only. Collectibles and new World image creation are plainly deferred. Sounds nests the three existing destination identities and handlers.

## Authorities and data
- The active selected Library project is identified by `sessionActiveProjectId()`, and the exact PPF snapshot is loaded through `loadLibraryProjectSnapshot()`. No implicit startup example or detached project can receive a poster.
- The existing Foundations Marketing Reference artifact owns poster candidates, source decision keys, provider/model, prompt, revision and accepted IDs. Reuse `applyStoryCommand`, `saveActiveLibraryProject`, profile-private persist+flush, exact selected-project read-back. No second poster registry or automatic story canon promotion.
- Cloud poster generation requires explicit billing acknowledgement. The selected image route must report ready; manual/unready route does not permit Generate. Generated asset URLs must be safe local image paths with independently readable image bytes before Save or Approve.
- An approved project poster is derived by `lockedMarketingReference`. Drafts never become the Library poster. Existing Afterglow featured-image resolution and fallback remain separate.
- JSON Library `.ppf.json` keeps asset references; file bytes are local. Do not claim a standalone project JSON contains media. Subsequent #3019 portability phase must verify byte-complete transfer and project registry convergence.

## Acceptance gates and independent limitations
- Static checks: dashboard single ASSETS group and nested legacy Sounds, project identity/no fallback, approved poster selected on saved Library card, Save/Approve/reload/protected artifact semantics.
- Run Layer 1 continuity and #2026 / #2446 historical navigation regressions. Verify actual build and current-head CI; stale pinned input digests must be readmitted to approved WHITE-PAPER-V3 W8/W9 after source changes, not bypassed.
- Profile-private save flush, local media byte verification and Library read-back are implemented but a green static/CI test does **not** prove the Human's specific Brotherly Love image provider or Windows restart. Attended authenticated Windows acceptance is outstanding until performed on that installation.
- Human must be able to inspect the unsaved candidate; no implicit image acceptance or credits spent browsing. Error/missing media must remain visible; no secret, real project art, or private screenplay is submitted to CI/GitHub.
