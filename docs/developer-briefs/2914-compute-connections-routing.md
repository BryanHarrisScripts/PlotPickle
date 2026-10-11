# 2914 — Compute capability connections and route-specific video proof

Related: #2830. Authorized workflow: build, test, fix, open PR, test/fix, merge when green.

## Human intent from October 11 walkthrough

Bryan reports local Writing, Images and Agents working. Local video Setup can produce a playable result but navigation returns to Error/not set up. A MiniMax H3 cloud test also reportedly plays video while Compute retains Configured/test needed. Hybrid diagnostics show Video Off. Screenshots show Local connection entries for Ollama, ComfyUI, LTX-Video and local H3, but Video capability and Hybrid omit LTX. The generic Error labels provide no reason.

Keep Writing, Images and Video as capability rows. Replace visible Hybrid with Connections: a place to choose what connects to what, similar to aligned connections in ComfyUI. Workflow routing includes local language runtimes and ComfyUI local/cloud workflows. Cloud providers includes direct Gemini, MiniMax and OpenAI connections only for supported capabilities. ComfyUI must not be presented as an LLM; an optional Ollama prompt-enhancement route stays explicitly distinct from direct image generation. Local LTX belongs in Video alongside other supported workflows.

These paragraphs preserve the task discussion and observed failures; screenshots are supporting observations, not proof of the exact code defect or successful provider inference.

## Assessment and root causes

Reuse the existing capability routing contract, gateway, profile vault and LTX provider. LTX is missing from CAPABILITY_ROUTES, statusBody, selection and Timeline resolution. Local Video renders only H3 options. The LTX gateway intercepts the shared /api/media-routing/test/video whenever media.videoRoute is none, even when the test explicitly requests MiniMax. This can return LTX output without proving the requested provider. This is a verified code defect; it is not confirmation that Bryan's historical test took this path.

LTX setup was outside the authenticated compute prefix and its store outside account-owned compute settings. LTX jobs were persisted as a shared filesystem JSON. Admit them to existing profile-owned encrypted storage; do not import OS-account secrets or shared historical prompt records into an arbitrary profile. Existing profile-owned LTX records remain readable as migration input.

A ComfyUI MiniMax workflow completion also updated direct MiniMax verification. Remove that conflation: workflow hash proof and direct provider proof are independent.

## Implementation and authority

1. Add stable ltx-video capability route using the existing LTX provider. Require configured workflow, available exact nodes/models and completed saved-output verification before selection.
2. LTX generation dispatch uses the shared explicit selected route; Off, native H3 and direct/API cloud routes do not implicitly dispatch LTX. Provider test endpoint belongs to its explicit provider; dedicated LTX test remains available without changing selection.
3. Persist LTX setup, proof and job history through existing account-owned encrypted stores. Guard setup/test/job boundaries with session/origin/CSRF and test cross-profile isolation and fresh-session readback.
4. Timeline uses selected LTX with its supported text-to-video strategy. Keep approved images as story evidence but do not upload unsupported image inputs to text-only LTX. Existing three-second clip preparation remains canonical; LTX source output duration is not relabelled as three seconds.
5. Connections uses Capability / Workflow routing / Cloud providers. Show inference location, readiness, selected state and blockers. Keep durable hybrid policy IDs/keyboard H compatible. Local and Cloud counts still use actual runtime locality, independently of column grouping. ComfyUI Cloud remains explicitly unavailable until an executable adapter/workflow exists.
6. Local Video shows LTX and specific H3 blockers. Direct image workflow does not gain an LLM prerequisite. No silent route selection, paid fallback, credential disclosure, story mutation or provider generation in CI.

## Acceptance and validation

The authenticated HTTP harness registers LTX before media routing as in startup, exercises explicit ComfyUI and direct MiniMax tests with media projection none, tests LTX, selects it, dispatches local generation, rejects unavailable fallback, restarts the encrypted runtime and verifies selection/proof/jobs with profile isolation. Strategy coverage verifies text-only LTX receives no image input. LTX provider regressions preserve missing-node/model/version, failed render and rejected submission behavior.

Rendered real Settings components must show Connections, both columns, local LTX and remote ComfyUI in workflow routing; select LTX and preserve selection after reload. Existing Windows Product Gate reruns this browser proof and the HTTP harness from the exact PR head. Local browser download was unavailable; visual observation remains pending until the Windows proof passes.

Run focused regressions, all focused UAT contracts, production build, convergence and exact-head GitHub PR/Product gates. Nine legacy source-string assertions failed identically on untouched main (1901/2106/2763/2776); they are outside this repair and not evidence of new regressions. Do not reintroduce off-route fallback to satisfy those stale assertions.

Actual Windows provider execution and Shot 1 three-second motion remain UNPROVEN under #2830. Synthetic saved-output fixtures prove routing/storage, not model inference or playable clip quality. This bounded engineering issue can merge after required exact-head gates without closing the attended #2830 acceptance.
