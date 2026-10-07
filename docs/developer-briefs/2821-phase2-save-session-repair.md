# #2821 Phase 2 — Save, Lock and session causal repair

## Outcome and scope

Phase 1 merged in #2826. This delivery establishes reproducible causes in the owning session and persistence boundaries, repairs those causes, and verifies the real Storyboard controls against an isolated local HTTP gateway and encrypted profile vault. It does not close #2821 or certify Bryan's Windows Afterglow/provider acceptance.

The final Human output remains a three-second Shot 1 movie with graphic novel narration bubbles, without spoken narration audio. Bryan confirmed this choice again during Phase 2. Preserve readable text, shot identity and reopening. Provider generation/playback and the final Human confirmation remain later gates.

## Confirmed mechanisms

| Cause and trigger | Owning path and affected surfaces | Repair and behavioral evidence |
| --- | --- | --- |
| Local narration bypasses the module graph that owns login's in-memory sessions/vault. Valid UI login does not confer authority in the separate RSC graph. | `build/local-profile-auth-gateway.ts`; `/api/previs/narration`; Storyboard and Previs callers. The existing Outline gateway already documents this runtime split. | Route narration through the same local node gateway. Actual HTTP login plus CSRF proof reaches narration payload validation (400) instead of session rejection; missing proof and absent cookie remain 403 with distinct codes. No inference is invoked. |
| Storyboard narration POST omits the required CSRF proof. | `storyboard-locked-shot-handoff.tsx`; Create Narration in Storyboard. Previs already acquired a proof. | Read current profile status, require an authenticated session/current proof, send `X-PlotPickle-CSRF`. Failed status verification does not become a sign-in assertion. |
| Normal PPF writes announce a synchronous browser cache change; the encrypted-write observer only existed in the legacy access boundary, which the current Matrix skin does not mount. | Foundation facade → Library cache; `profile-private-browser.ts`; all normal PPF writers hosted by Matrix. Mind Map/World Map explicit writers already await the vault. | Move Human persistence observation into hydrated profile storage, independent of the mounted surface. Actual encrypted server writes are read back after unload/rehydrate; a released authority removes its observer. Legacy guest persistence remains separate. |
| Storyboard success is reported before vault acknowledgement, and repeated Save treats an existing marker as sufficient without retrying durability. | Storyboard `saveFrameVersion`; shared revision-safe browser owner. | Await canonical and encrypted writes, including idempotent retries; display pending/failure feedback. Saved badges require the shared write state to be acknowledged. Actual rendered failed-write injection removes the Saved claim, preserves work and succeeds on retry. |
| Storyboard Lock/Unlock writes start from a stale render-time project while Save starts from the latest Library project. | Storyboard `reviewFrame`; accepted candidate scope. | Load current project/artifact, preserve marker/media, replace accepted candidates only in the same position/scope, and await durable acknowledgement. Save → Lock → Unlock → Save → Lock executes against deliberately stale render input and retains one artifact/approval. |
| Profile GET maps transient authorization/readiness exceptions to `authenticated=false`; legacy heartbeat trusts unsuccessful JSON responses. | `/api/auth/profile` GET; `profile-access-boundary.tsx` heartbeat. | Only `SESSION_REJECTED` produces normal signed-out status. Readiness/transient failures are non-success responses with safe codes; heartbeat checks response.ok before clearing state. Real route-function regression distinguishes successful login, transient 503, readiness 503 and actual rejected-session signed-out status. |
| Logout/profile leave swallow durability failures, then clear the working state. | Browser auth gateway and Profile surface leave/Lock/switch actions. | Propagate write/flush failures before the destructive authority transition. Actual browser auth gateway logout fails on an injected vault error and the HTTP session remains authenticated. |

Earlier fixes addressed marker replacement, recovery metadata or the visible button independently. They did not put encrypted persistence observation into the current Matrix host, unify local narration session ownership, or make control confirmation depend on acknowledgement.

## Authority and race prevention

The durable helper rejects changed project identity or expected revision before mutation. It reads the latest project again after acknowledgement rather than returning an obsolete snapshot to the surface. Repeated Save does not create another artifact or revision.

Profile storage retains its current authority when the same profile/proof is observed again, flushes pending work before replacement, and uses an authority epoch to reject obsolete hydration completions and not-yet-started writes after release. The regression releases authority while a delayed read is pending and proves the response cannot reacquire it. A failed observer reports blocked state; synchronous snapshot errors are caught as well as asynchronous failures.

A browser marker records the intended explicit Save. It is preserved on persistence failure so retry can recover the decision; the UI must not display that marker as acknowledged Saved while the shared write state is pending/blocked.

## Guard investigation: evidence limit

Phase 1 reproduced an enabled Save returning silently when `qaOnlyAccess=false`, `storyboardAccessible=false`. That guard mismatch is removed for existing local images, and QA previews remain read-only. However the current repository has QA workspace access enabled, making `storyboardAccessible` true for a selected target. The characterized false predicate is not established as the cause in Bryan's reported build. It must not be presented as a proven explanation of his click symptom. The acknowledged-write and session ownership defects above are independently exercised.

Project navigation is not established as actually logging out Bryan. A false status response, a rejected narration mutation, and an actual expired/revoked session are distinct. No valid session is bypassed and no blanket re-sign-in workaround is added.

## Verification delivered

- `tests/issue-2821-save-session-continuity.test.mjs`: real local HTTP auth/CSRF boundary and encrypted store; actual browser Library/queue and actual extracted Storyboard handlers; failed-save retry, stale Lock/Unlock, unload/rehydrate, logout preservation and obsolete hydration rejection. Browser storage/event primitives are synthetic. Provider inference is not called.
- `tests/issue-2821-afterglow-load-hydration-authority.test.mjs`: real recovery commands/contracts preserve current saved/locked metadata and explicit Unlock against stale history. Its extensionless TypeScript imports now use an isolated esbuild fixture, so the ordinary Node runner executes it.
- Existing #2817/#2819 contracts follow the new acknowledged helper rather than requiring the old unawaited call. The meaningful idempotence/round trip is covered behaviorally above.
- `scripts/developer-diagnostics/product-proof/2821-save-session.mjs`: actual React Storyboard, Skin V1 CSS/fonts, real local login/vault, isolated synthetic Human, DOM clicks and screenshots. Observed Save, Lock, Unlock, blocked write, truthful badge, retry and browser reload. Browser traffic is restricted to the fixture's own loopback origin. This is surface proof, not full normal-launcher or provider proof.
- Local rendered proof passed and `saved-locked.png`, `save-failed.png`, `reopened.png` were inspected under `.artifacts/2821-save-session/`. No Human story or credentials enter source/evidence.
- Relevant regressions pass; focused UAT contracts pass; the production build compiles and its offline artifact validation passes. GitHub independently reruns architecture, convergence and Windows product checks on the PR head before merge.

Reproduce focused tests:

```text
node --test tests/issue-2821-save-session-continuity.test.mjs tests/issue-2821-afterglow-load-hydration-authority.test.mjs tests/issue-2819-storyboard-idempotent-save.test.mjs tests/issue-2817-uat-persistence-auth-routing.test.mjs tests/issue-2821-build-artifact.test.mjs
node scripts/run-uat-autopilot.mjs --contracts-only --artifact-root .artifacts/uat-focused
npm run build
node scripts/developer-diagnostics/product-proof/2821-save-session.mjs
```

The rendered proof defaults to the existing isolated verification tool installer. An already installed Playwright module/browser may be supplied through `PLOTPICKLE_PRODUCT_PLAYWRIGHT_MODULE` and `PLOTPICKLE_PRODUCT_BROWSER_EXECUTABLE`; these affect tooling only. Windows CI runs the proof with managed verification tooling.

## Validation prerequisites repaired

Focused UAT found #591 asserting a superseded launcher sentence. Update the expected current OpenPencil/optional inventory wording; retain readiness ordering and non-maintenance checks. No launcher behavior changes.

The Linux verified-build wrapper tried to execute a Cloudflare Worker with Node, which rejects `cloudflare:` intrinsics after a successful compilation. Validate syntax/default-fetch shape and the entire JavaScript dependency graph offline instead; keep native Windows's existing syntax/shape contract. The new artifact regression admits Worker intrinsics without executing initializers and rejects malformed JavaScript, absent default/fetch shape and missing graph dependencies. No network request is used for artifact validation.

## Remaining parent work

Phase 3: finish representative surface Save/Lock revisions and reversibility (including Outline/World Map), verified profile display in PlotPickle Score, and narration bubble presentation on Timeline. Trace legacy/current reachability before changing separate domains.

Phase 4: verify the named navigation/load matrix and provider-specific route authorization/retention, plus three-second motion playback/trim and bubble association. A provider job/preflight does not prove playable retained output.

Phase 5: Bryan starts the merged Windows application, restores Afterglow with Your Changes, exercises Shots 1/19, generates and plays Shot 1 with graphic novel narration bubbles, unloads/reopens and confirms readiness to continue. #2821 stays open until that result is reported. No paid clip is generated by the engineering fixture.

### Architecture CI repair

Layers 1 and 5 retained source contracts for the old literal Save label, stale artifact reads and unacknowledged persistence. The updated contracts require the Saving/Save label, current artifact authority, durable acknowledgement and pending-action disabling while retaining approval and position constraints. Layer 7 caught directory fanout; rendered proof now lives under the product-proof owner. Windows exposed CRLF-sensitive import stripping in the status fixture; the fixture accepts both newline forms. No gate or assertion family is disabled. Historical proof-path ownership is retained only to classify its deletion in this PR.
