# Developer Brief — stable-diffusion.cpp Optional Local Runtime

Issue: #2460

## Objective

Prototype stable-diffusion.cpp as an optional PlotPickle local image-generation runtime without replacing Managed ComfyUI, changing current defaults, downloading models automatically, or hard-coding one model into the product.

Source reviewed:
- https://github.com/leejet/stable-diffusion.cpp

## Why it matters

stable-diffusion.cpp provides a comparatively small native C/C++ inference surface for diffusion workloads and supports Windows/CUDA, GGUF-oriented deployment, Qwen Image 2.1, SDXL and other image/video families. That makes it a credible low-overhead runtime candidate for PlotPickle's local-first direction, especially on constrained GPUs.

The opportunity is not to replace ComfyUI. PlotPickle already has a working Managed ComfyUI service with workflow ownership and image/video routing. The useful adaptation is to make sd.cpp another capability implementation behind the same host-owned runtime/provider boundary.

## Current PlotPickle authority

REUSE:
- config/runtime-manifest.json remains the runtime supervisor authority.
- Managed ComfyUI remains the enabled local image/video engine.
- PlotPickle provider/capability routing remains the selection authority.
- Human-approved visual contracts and Storyboard/Previs state remain upstream creative authority.
- Existing generated-media persistence remains the asset authority.

ADAPT:
- Add one disabled runtime component for stable-diffusion.cpp.
- Record source/license and supported candidate model families as declarative capability metadata.
- Treat the runtime as loopback/local and explicit-enable only.

NEW:
- A minimal sd.cpp runtime descriptor/adapter contract only where needed to prevent future ad-hoc integration.

## Required behavior

1. sd.cpp is disabled by default.
2. Enabling sd.cpp never disables or rewrites ComfyUI configuration.
3. No model weights, absolute user paths, credentials or private story data are committed.
4. The runtime advertises image-generation first. Video remains future work unless separately proven.
5. Candidate compatibility may name Qwen Image 2.1 and SDXL, but model choice remains runtime/provider policy rather than Storyboard code.
6. Health/readiness remains host-owned until a concrete supported server contract is selected and tested.
7. The runtime cannot become PlotPickle's active default merely because it exists in the manifest.
8. A future live benchmark must compare memory use, latency, quality, cancellation and recovery on the target hardware before default promotion.

## Initial target profile

The first future benchmark target is the existing Pascal/8 GB class local hardware profile.

Benchmark questions:
- Can a reviewed Qwen Image 2.1 quantized configuration complete a useful 768–1024px Storyboard frame?
- What VRAM/RAM does CPU offload require?
- How does latency compare with the current ComfyUI path?
- Can output be cancelled and recovered cleanly?
- Does the engine preserve reference-image inputs needed by PlotPickle's visual-continuity contracts?
- Is SDXL a practical fallback when Qwen Image 2.1 is too heavy?

The benchmark is deliberately outside this implementation phase because adding a disabled runtime contract must not require downloading or executing third-party model weights.

## Security and trust

- Bind only to loopback when PlotPickle later manages the service.
- Never expose an unauthenticated generation endpoint to the LAN by default.
- Treat downloaded binaries and weights as external runtime assets with provenance and checksum policy.
- Generated output is candidate evidence, not canon.
- Runtime/model metadata may be logged; prompts, hidden reasoning, private story text and credentials may not be copied into developer telemetry.

## Verification

Deterministic:
- manifest has a unique sd.cpp component;
- component is disabled;
- Managed ComfyUI remains enabled;
- sd.cpp advertises image-generation without becoming the default;
- source is stable-diffusion.cpp and license is MIT;
- no committed model path/download instruction is required for ordinary startup;
- architecture audit remains healthy.

Future product proof before promotion:
- actual provider execution;
- visible generated image;
- cancellation/recovery;
- constrained-GPU benchmark;
- restart behavior.

## Non-goals

- replacing ComfyUI;
- shipping model weights;
- choosing a permanent default model;
- adding a second asset store;
- implementing an NLE/video workflow;
- changing Storyboard prompts or visual canon;
- exposing a network service beyond loopback;
- claiming GTX 1080 suitability before a live benchmark.

## Acceptance

- [ ] Optional runtime component exists and is disabled.
- [ ] ComfyUI remains the enabled current local image/video runtime.
- [ ] Source/license/capability metadata is explicit.
- [ ] No model install or download side effect is introduced.
- [ ] Focused regression proves default isolation.
