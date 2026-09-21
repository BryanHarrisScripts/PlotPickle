# Developer Brief #2329 — Experimental Qwen-Image-2.1 Local ComfyUI Profile

Date: 2026-09-21
Status: Implementation / PR validation
Issue: #2329
PR: #2330

## Decision

PlotPickle keeps ComfyUI + SDXL 1.0 as the production-safe default local image path.

Qwen-Image-2.1 is added only as an opt-in Experimental profile inside the existing local ComfyUI route. It is not a new provider and does not replace SDXL.

The first hardware qualification target is the existing NVIDIA GTX 1080 8 GB / 32 GB RAM Pascal profile.

## Research basis

Qwen-Image-2.1 launched with native ComfyUI support and adds capabilities that are strategically useful to PlotPickle: unified generation/editing, multi-reference conditioning, improved character continuity workflows and transparent/RGBA asset production.

Current community GGUF packages demonstrate a practical Q4_K_M image transformer around the 4–5 GB range, with separate Qwen3-VL 8B text encoder and Qwen Image 2.1 VAE assets. ComfyUI-GGUF exposes Qwen image architecture support through its GGUF loader.

The model is governed by the Qwen Research License. The standard grant is non-commercial and commercial use requires separate licensing. PlotPickle therefore must not bundle, auto-download, silently activate or describe the model as an Apache-2.0 bundled dependency.

## Runtime boundary

- Runtime remains local ComfyUI at 127.0.0.1:8188.
- Provider-level imageRoute remains "comfyui".
- Local imageProfile selects either:
  - sdxl-1.0
  - qwen-image-2.1-experimental
- SDXL starter install behavior is unchanged.
- Qwen model assets are user-supplied through ComfyUI.
- Qwen workflow import is API-format JSON and must contain {{PLOTPICKLE_PROMPT}}.
- Qwen workflow import must use ComfyUI-GGUF UnetLoaderGGUF.
- Remote URLs in the imported Experimental workflow are rejected.
- Changing the Qwen workflow automatically returns the active image profile to SDXL until the writer explicitly reactivates Qwen.

## GTX 1080 policy

Do not assume an INT8 ConvRot encoder or newer-GPU acceleration path is safe on Pascal.

The working encoder/offload combination is deliberately not hard-coded. PlotPickle exposes the Experimental workflow boundary and requires real GTX 1080 qualification before any promotion decision.

Generation constraints for the first qualification pass:

- one image per request;
- 768/1024 working dimensions, not native 2048;
- local dynamic/low-VRAM ComfyUI behavior;
- up to ten approved reference inputs;
- existing PlotPickle text/media GPU residency transition remains authoritative;
- render duration is returned as benchmark evidence.

## License boundary

Activation requires an explicit acknowledgement of the Qwen Research License.

PlotPickle records only the local acknowledgement timestamp. It does not:
- accept the license automatically;
- transmit the acknowledgement;
- grant or represent commercial-use rights;
- download Qwen weights;
- ship Qwen weights in source, installers or releases.

## UX

Local AI / Images keeps PLOTPICKLE IMAGE DEFAULT as ComfyUI + SDXL 1.0.

An Advanced/Experimental section exposes:
- expected local Qwen stack;
- workflow JSON import;
- ComfyUI node readiness;
- missing node diagnostics;
- explicit license acknowledgement;
- Activate Experimental Profile;
- Switch Back to SDXL;
- one-image Qwen verification;
- last successful Qwen verification time.

## Verification

Focused deterministic contract:
tests/issue-2329-qwen-image-21-experimental.test.mjs

The test is registered under the Provider Runtime verification catalog and the manual Hardware-Aware Local AI workflow.

PR acceptance:
- exact-head Architecture Verification green;
- focused #2329 provider contract green;
- production build green in the Hardware-Aware Local AI workflow when dispatched;
- no regression to SDXL default/fallback behavior;
- no Qwen managed-download path introduced.

## Production rule

Merge when repository CI is green.

After merge, the code can ship as an Experimental capability, but Qwen-Image-2.1 must remain Experimental until a real GTX 1080 run demonstrates acceptable render time, memory stability and continuity/editing value and the licensing decision matches PlotPickle's intended use/distribution model.
