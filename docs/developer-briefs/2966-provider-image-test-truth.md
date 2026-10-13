# Developer brief — #2966: truthful provider-specific image verification

## Human authority and observed failure
On authenticated Windows, Cloud > MiniMax TEST IMAGE claimed a verified cloud image while the persisted MiniMax readiness still required testing. When globally selected SDXL/ComfyUI, registerSdxlLocalImageGateway intercepted POST /api/media-routing/test/image before the canonical router parsed the explicit {route:"minimax"}. The local result was route:comfyui, and the UI ignored that contradiction.

WHITE-PAPER-V3 W8/W9 governs this repair. PP-IMG-PROVIDER-001: an explicit provider test executes only the requested route or reports failure; a claimed success must bind to the actual executed route, saved local asset and persisted readiness for the requested provider. Cloud requests require pre-existing authenticated profile authority and explicit paid-test acknowledgement; no automatic fallback, account setup or paid test is authorized by this issue.

## Bounded implementation
1. Remove the competing SDXL HTTP middleware registration. Keep local ComfyUI SDXL 1.0 execution as a helper called only by the single canonical image test route on explicit/selected comfyui, preserving exact checkpoint, node readiness and model policy. Production Storyboard image routing remains under the existing media router.
2. Read the image-test body once, validate requested route explicitly and keep it separate from the saved global choice. Reject unknown values before any provider call. Execute MiniMax/OpenAI via existing cloud-image authority, and SDXL via the local helper; no body replay and no duplicate intake owner.
3. Write verification for only the route actually executed after local asset storage succeeds. Report authoritative route and provider in successful receipts; do not let generated/provider payloads override identity.
4. In Cloud provider setup, require HTTP success, matching route/provider and a saved asset URL; independently read media status and require provider-specific imageReady plus imageVerifiedAt before displaying verified. Any mismatch remains FAIL/UNPROVEN rather than a false cloud PASS.
5. Replace historical fixture assertions that certified interception order. Add a pure executable contract test with positive local/cloud selection, mismatched receipt, missing asset, invalid route and nonpersisted readiness negative controls. Bind the test to W8/W9, update its ownership and convergence records.

## Engineering proof and limitations
Run focused Node tests, TypeScript/production build, seven-layer architecture verification and scoped BEN/convergence. Observe exact PR SHA and required CI gates before squash merge; inspect and repair red failures. Keep #2943 for independent normal authenticated Windows/real provider observation and restart. No MiniMax key, secret, private story, actual billed generation or cloud credential success is present in CI; #2966 cannot claim real MiniMax acceptance. The separately observed writing and H3 credential failures remain outside this scope.

## Acceptance
An explicit MiniMax image test cannot be answered by SDXL even if the global selected image profile is ComfyUI SDXL. Local SDXL test still validates the fixed model and ComfyUI readiness. Cloud UI never calls its own success verified from a mismatched route, absent asset, absent persisted provider verification, or failed provider execution. Exact-head green permits engineering merge, not product acceptance.
