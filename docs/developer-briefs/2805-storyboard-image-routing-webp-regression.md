# #2805 Storyboard image routing / WebP normalization regression

## Developer Brief

### Objective

Fix the Storyboard image-generation regression where a valid locally generated image can be returned as PNG, bypass the canonical media-routing WebP normalizer, and then be rejected by Storyboard as:

`0 of 1 Storyboard Image candidate generated as local drafts for recovery... The image route did not return a WebP Storyboard Image.`

Live UAT reproduced the failure on Storyboard Shots 19–21.

This issue restores one production image-generation route and preserves the existing #2413 contract that Storyboard generation requested with `outputFormat: "webp"` must receive a WebP asset.

### Confirmed root cause

Current main has two middleware owners for the same production endpoint:

`/api/local-ai/generate/image`

Registration order in `build/local-ai-gateway.ts` currently places:

1. `registerSdxlLocalImageGateway(server)`
2. later `registerMediaRoutingGateway(server)`

The SDXL-specific gateway handles the shared endpoint first when the configured route/profile matches local SDXL.

That path calls `generateSdxlImage(...)`, which currently persists its generated asset as `.png`.

The later media-routing gateway contains the canonical `outputFormat === "webp"` normalization using `saveWebpFrameCandidate(...)`, but it never receives the request after the earlier SDXL middleware has already answered it.

Storyboard then enforces the intended contract with:

`result.assetUrl?.endsWith(".webp")`

and rejects the otherwise valid PNG result.

Therefore the defect is route ownership/order, not missing Shot evidence and not the Storyboard WebP check itself.

### Existing authority to preserve

Reuse and preserve:

- #2413 — Storyboard 25-position progression and WebP output contract.
- `app/_components/storyboard/storyboard-readiness-workspace.tsx` — current Storyboard generation request and review workflow.
- `build/media-routing-gateway.ts` — provider-neutral image routing and WebP normalization.
- `build/media-provider-common.ts` — `saveWebpFrameCandidate(...)` conversion authority.
- `build/ai/comfyui-sdxl-local-provider.ts` — SDXL renderer implementation.
- existing single-image request boundary, Human consent, provider routing, character-reference/continuity payload, saved local artifact, Lock/Save/Delete review behavior.

Do not create a second normalizer or weaken the Storyboard output contract.

### Product decision

The canonical production flow should be:

```text
Storyboard
→ /api/local-ai/generate/image
→ media-routing gateway
→ selected reviewed image provider
→ requested output normalization
→ Storyboard candidate
```

The provider may internally produce PNG, JPEG or WebP. The canonical media-routing layer is responsible for returning the requested Storyboard format.

Storyboard should continue requesting:

`outputFormat: "webp"`

and may continue rejecting a response that violates that contract.

### Required implementation

#### Phase 1 — single route ownership

Make `registerMediaRoutingGateway` the single production owner of:

`POST /api/local-ai/generate/image`

The SDXL-specific gateway must not intercept that production path before the media router.

Keep any SDXL-specific diagnostics/test endpoint needed for direct local verification, but production Storyboard requests must resolve through the provider-neutral media router.

Do not change Storyboard's request shape merely to work around middleware order.

#### Phase 2 — WebP normalization guarantee

Preserve the existing media-router behavior:

- provider returns its native local/cloud asset;
- when `outputFormat === "webp"`, route the returned image through `saveWebpFrameCandidate(...)`;
- return the normalized local `.webp` asset URL;
- surface a clear conversion error if normalization fails.

Do not silently accept an unnormalized PNG as successful Storyboard output.

#### Phase 3 — regression coverage

Add focused tests proving:

1. a local ComfyUI/SDXL provider may return a PNG;
2. a Storyboard-style request uses the media-routing owner rather than the direct SDXL interception path;
3. `outputFormat: "webp"` converts the provider result to a local `.webp`;
4. Storyboard receives a successful WebP candidate rather than `0 of 1`;
5. the 1 / 5 / 25 Storyboard generation scopes continue to use one request at a time;
6. approved character references, identity locks and continuity metadata still cross the routing boundary;
7. a conversion failure reports the real stage-specific error and does not create a false-success artifact.

Include a regression fixture equivalent to the live Shot 19 symptom.

#### Phase 4 — live UAT proof

On the current Storyboard surface:

- use the same project/address that exposed missing Shots 19–21;
- generate Shot 19;
- verify the returned candidate URL is `.webp`;
- verify the candidate appears in the Shot 19 image/version controls;
- Save/Lock it successfully;
- repeat for Shots 20 and 21 or prove the same path through a bounded group generation;
- reload the story and verify persistence;
- confirm no Storyboard regression for earlier populated positions.

### Scope boundaries

In scope:

- duplicate production image-route ownership;
- route ordering/ownership cleanup;
- provider-neutral WebP normalization;
- Storyboard generation regression coverage;
- live proof for the missing positions.

Out of scope:

- changing Storyboard's 25-Shot structure;
- changing prompt/evidence generation;
- changing image providers/models;
- weakening the WebP requirement;
- Timeline video generation;
- redesigning Storyboard review controls;
- silently regenerating missing Shots on load.

### Acceptance criteria

- [ ] Exactly one production owner handles `POST /api/local-ai/generate/image`.
- [ ] Storyboard requests flow through the canonical media-routing gateway.
- [ ] Local SDXL may render PNG internally without leaking PNG across a Storyboard `outputFormat: "webp"` contract.
- [ ] Storyboard receives a local `.webp` asset when generation succeeds.
- [ ] The existing Storyboard `.webp` validation remains intact.
- [ ] The live `0 of 1 ... did not return a WebP Storyboard Image` regression is eliminated.
- [ ] Shot 19 can generate, display, Save and Lock successfully.
- [ ] The same path works for Shots 20 and 21.
- [ ] 1 / 5 / 25 generation scopes remain sequential and bounded.
- [ ] Character/reference/identity/continuity payloads are preserved.
- [ ] Provider selection and consent remain owned by existing routing policy.
- [ ] Failed conversion produces an actionable error with no false-success artifact.
- [ ] Reload preserves the generated/locked Storyboard candidate.
- [ ] Focused tests pass.
- [ ] Required exact-head architecture/build verification is green before merge.

### Definition of done

Storyboard no longer depends on middleware registration order to obtain the correct image format. Every production Storyboard image request passes through the provider-neutral media-routing authority, any provider-native image is normalized to the requested WebP format, and the previously failing Shots 19–21 can generate and persist normally.

### Delivery rule

Build → focused test → fix → PR → required exact-head verification → fix until green → merge when green.

Keep this as a bounded regression repair. Do not duplicate the image router or replace the established #2413 Storyboard/WebP contract.