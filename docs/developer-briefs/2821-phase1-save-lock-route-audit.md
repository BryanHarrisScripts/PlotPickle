# #2821 Phase 1 — Save, Lock, and session route audit

## Baseline and evidence limits

Inspected current main commit `0654ab83a9fe2364ab5b3861b9b3c078d624891b` through the GitHub plugin. The recursive repository tree contains 4,999 entries and is not truncated. All 304 `.tsx` files beneath `app/` and `modules/` were fetched successfully and scanned for Save controls, Lock/Unlock controls, storage writes, and shared persistence calls. Search results alone were not used as file evidence.

This is an investigation delivery, not a product fix. Source/control-flow reproductions use the real fetched implementation with controlled dependencies. They do not establish the actual predicates, cookie state, build, or asynchronous timing in Bryan's Windows session. Phase 2 owns that causal verification. No paid clips were generated; Phase 5 remains Bryan's live acceptance.

## Persistence families and differences

| Surface/domain | Actual route and owner | Completion and reload | Investigation target |
| --- | --- | --- | --- |
| Mind Map fields/notes; current World Map visual versions | `app/skin-v1/discovery-surface.tsx`: `persistCanonicalProject` → active/detached Library write → `persistActiveProfileProject` → `flushProfilePrivateWrites` | Explicit asynchronous acknowledgement; errors displayed; vault hydration restores Library | Snapshot conflict handling and failed-write UI consistency |
| Storyboard Save | `storyboard-readiness-workspace.tsx`: `saveFrameVersion` → `foundations.visual.store` → `saveFoundationProject` | Immediate browser state/marker notice; encrypted write depends on Library change listener | Enabled control can silently return; success precedes encrypted acknowledgement |
| Storyboard Lock/Unlock/Delete | Same file: `reviewFrame` → visual accept/unaccept/delete → same foundation facade | Render-time project mutation; immediate notice; background persistence | Stale project overwrite versus Save's latest-project read; hidden accessibility guard |
| Outline Block/Mini-Block visual Save/Lock | `outline-block-anchor-workspace.tsx`, `outline-mini-block-anchor-workspace.tsx`: marker and visual accept commands → foundation facade | Immediate project callback/status; background durability | Lock disabled on currently locked candidate; no direct Unlock control in these components; verify intended replacement/reversibility |
| Story Card planning lock | `story-card-foundation-board.tsx`: `toggleLock` → `setStoryCardPlanningLock` → `commitStructure` | Protection of planning arrangement, distinct from visual approval | Trace host callback/revision and round trip; do not conflate with profile lock |
| Current World Map Lock | `discovery-surface.tsx`: `lockCharacterVisualVersion` → `lockWorldMapCharacterVisualVersion` → acknowledged canonical persistence | Requires complete eight-view version; approved downstream identity | Confirm unlock/replacement semantics in domain API and preserved saved versions |
| Legacy character identity Lock | `character-image-generator.tsx`: `lockIdentity` / `approveReplacement` → `persist` → parent project callback | Legacy project identity model and callback, separate from World Map version API | Verify runtime reachability and parent backing store before changing it |
| Previs narration / text approval | `previs-readiness-workspace.tsx`, `storyboard-locked-shot-handoff.tsx`: profile check → narration mutation → foundation write | Narration result arrives before browser project save; encrypted durability is separate | Session result classification; downstream saved-frame identity; approval versus persistence |
| Timeline motion/assembly/export metadata | `timeline-assembly-workspace.tsx`: several `saveFoundationProject` writes and latest-project ref | Browser project events; actual generated media files are separate | Ready/failed/stale state ownership; output association; acknowledgement and revision consistency |
| Library Unload/resume | `modules/library/ui/library-workspace.tsx` | Unload persists/flushes, detaches, persists null-active, returns Dashboard; rollback if post-detach failure. Resume restores exact working snapshot and expected assets | Late hydration, handoff/revision boundaries; unload does not explicitly invoke account logout |
| Foundations/World PLAN/LEARN and other PPF writers | foundation facade → `saveActiveLibraryProject` → Library core | Synchronous browser cache + change event; shared background vault listener | Different surface promises despite same adapter |
| Profile encrypted vault | `profile-private-browser.ts` → queued POST `/api/auth/profile-private` | Save individual projects, then index; flush awaits project queue; cache queue failures ignored by flush | Token/authority transitions; recovery-point cache errors; queue release versus in-flight operations |
| H3/cloud provider authority | `cloud-provider-setup-panel.tsx` → `/api/cloud-story-mode/provider` → assistant/media stores | Explicit server response; writes protected credential JSON; preserves unchanged route verification | Config identity, route-specific verification, partial dual-store failure |
| Comfy Cloud and ComfyUI workflow setup | `comfy-cloud-setup-panel.tsx`, `media-routing-panel.tsx` | Server configuration/workflow APIs; media-routing store; explicit status/error | Different verification contracts and credential ownership; not story Save |
| General preferences | `settings-panel-legacy.tsx`, `settings-workspace-panel.tsx` | Browser settings localStorage; provider secrets handled separately | Intended device preferences, not project/vault authority |
| Other connection/profile settings | AI/Gemini setup, BUZZ setup, profile presentation, Studio identity, helper roster | Separate server endpoints or presentation/device settings | Audit exact endpoint errors and authorization per domain; do not unify unrelated identities |
| Legacy project surfaces | Curriculum, Dialogue, Craft, Feedback, Production, Pitch, Work Together and other standalone pages | Several write legacy project JSON directly to localStorage; child editors commonly call parent `onChange` | Confirm reachability/current ownership and bridge behavior; these are not automatically vault-backed |
| Local backup / native Git Save Revision | GitHub collaboration and native-git workspace | Local-project/package/Git endpoints with explicit requests | Distinct backup/revision semantics; not visual approval |
| OpenPencil Save | Desktop GUI file save → `openpencil-design-review-publisher.mjs` | Local design file then independently acknowledged GitHub review publication | Local-save success versus publish failure are deliberately distinct; live implementation remains a proposal |
| Print/download Save | PDF dialog, recovery-secret download, PPF export | User file/download destination | Exports are not canonical project Save; do not count as vault persistence |

## Shared authority chain

`foundation-project-browser.ts` aliases load/save/event to `project-library-browser.ts`. `saveActiveLibraryProject` normalizes project domains, calls Library core, marks active session project, announces a change, and returns synchronously. It does not await a server write.

`profile-access-boundary.tsx` listens for the change event and invokes `persistActiveProfileProject().catch(() => undefined)` while ready. Thus a successful browser Save and an acknowledged durable vault Save are different events. Mind Map explicitly awaits the latter; Storyboard/Outline do not in their handlers. The vault module can emit blocked save state, but a per-shot success notice does not itself prove vault durability.

## Reproduced control-flow conditions

A temporary Node 24 characterization harness evaluated the actual Save handler and profile GET implementation, stripping TypeScript and injecting controlled boundary dependencies.

1. With a valid selected local artifact, qaOnlyAccess=false, frameBusy=false, and storyboardAccessible=false, the Save button's actual disabled expression evaluates false. The actual handler returns before feedback or persistence. This reproduces an enabled silent no-op for that condition; Bryan's actual accessibility predicate remains to be observed.
2. A successful profile authorization reports authenticated=true. Injecting a transient inner authorization exception instead yields authenticated=false with no cause code. This reproduces loss of diagnostic distinction, not actual server logout.
3. A not-ready server boundary also yields authenticated=false (readiness is separately reported). The heartbeat must interpret readiness/error separately from genuine loss of session.

These characterizations are not permanent tests that endorse broken behavior. Phase 2/3 must add behavioral regressions expecting the repaired contract.

## Lock findings and risk boundaries

- Storyboard Save reads the latest project; its Lock/Unlock path starts from the render-time project. This is an actual implementation difference, not proof that a specific stale write occurred.
- Creative lock selects acceptance; it does not add the explicit Storyboard local-save marker. Lock-before-Save therefore remains pending until Save succeeds.
- Outline visual lock unaccepts the prior matching candidate before accepting the new one, preserving one selected anchor per scope. Direct Unlock affordances differ from Storyboard.
- Current World Map Lock goes through explicitly awaited encrypted persistence, unlike immediate Storyboard Lock.
- Profile-security Lock is intentionally an account/session operation. Its controls must never be confused with creative approval.
- Planning, character identity, production protection, and visual approval have different legitimate domains. Audit consistency of meaning and durability, not identical command names.

## Session transitions to investigate in Phase 2

Profile GET catches all inner readiness/authorization errors. The 30-second profile heartbeat parses JSON without first checking response.ok; authenticated=false then triggers `clearPrivateScreen`. Network rejection is caught separately. Observe actual error/status/cookie/session code to distinguish false presumed lockout from genuine expiry.

Private hydration clears the Library cache and all sessionStorage before restoring profile/project identity. The auth gateway may rehydrate when profile/token no longer match cached authority. Trace callers, token stability, late responses, and write ordering before attributing navigation to session loss.

The browser auth gateway's logout path catches persistence/flush failures before logging out. This differs from Library Unload's surfaced/rollback failure handling. Treat as a separate failure-preservation investigation; ordinary navigation is not established as invoking logout.

## Baseline checks executed

- Existing `issue-2616-library-segmented-profile-persistence.test.mjs` and `issue-2625-library-unload-active-story.test.mjs`: 11/11 pass.
- One #2616 test executes real encrypted-store segmented persistence above the former 8 MiB gateway envelope. Other tests largely assert source contracts; these cannot establish live session continuity.
- Real-handler characterization: three observations reproduced as described above.
- No product code changed and no production build/live Windows/provider test was claimed. Documentation-only CI remains required on the PR's exact final head.

## Reproduction matrix for Phase 2

| Case | Capture first mismatch | Required preserved truth |
| --- | --- | --- |
| Shot 1 Save then Lock | handler guard, artifact ID/revision, marker, write acknowledgement | selected media, save marker, approval |
| Shot 19 Create Narration | GET status/readiness/error, mutation code, proof validity only | authenticated profile and saved/locked artifact |
| Library unload/reopen and delayed jump | active ID/revision before/after hydration/recovery | latest story decisions and valid session |
| World Map/Outline/Settings navigation | mount/unmount, auth gateway calls, background writes | profile/project authority |
| Save → Lock → Unlock → Save → Lock | latest revision versus rendered revision and durable queue | saved content survives approval changes |
| Alternate approved candidate | scope membership before/after | one approved candidate; saved alternatives retained |
| Legacy current-facing panel | active host/callback and actual backing store | no cross-profile/project overwrite |
| Storage or auth failure | pending edit state, exact error, retry outcome | no false Saved/Logged in confirmation |

## Phase handoff

Phase 1 supplies the repository-wide source census, persistence/lock-family map, reproductions of concrete control-flow inconsistencies, baseline checks, and live reproduction matrix. Live causal confirmation is still required in Phase 2; the user's actual Windows state has not been inspected.

Phase 2 starts with enabled-Save guard mismatch, browser-versus-vault acknowledgement, stale Lock writes, and profile-status/heartbeat error classification. Fixes follow verified causes and independent regressions. Parent #2821 remains open through Phases 2–4 and Bryan's Phase 5 confirmation.
