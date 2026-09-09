# Bundled local LTX proof workflow

## Scope and provenance

`build/ai/comfyui-ltx-default.ts` is PlotPickle's single-stage API-format adaptation of the official Lightricks distilled workflow:

- https://github.com/Lightricks/ComfyUI-LTXVideo/blob/36fdaf500b3cd6f7fa8b2dfec36e984746e630a2/example_workflows/low_level/ltxvideo-i2v-distilled.json
- The original graph targets 0.9.6. PlotPickle changes the checkpoint to 0.9.8, removes the image-conditioning path, and uses EmptyLTXVLatentVideo as in Comfy's official text-to-video example: https://github.com/Comfy-Org/workflow_templates/blob/main/templates/ltxv_text_to_video.json
- The eight-step sigma schedule, Euler ancestral sampler, and CFG 1 come from the pinned Lightricks distilled example. The 0.9.8 upstream configuration also uses these timestep values: https://github.com/Lightricks/LTX-Video/blob/main/configs/ltxv-2b-0.9.8-distilled.yaml . Its default is multi-stage; this intentionally conservative proof variant omits the second upscale pass.
- Native node signatures and video history output were reviewed against ComfyUI v0.3.50 (`comfy_extras/nodes_lt.py`, `nodes_custom_sampler.py`, `nodes_video.py`). The minimum checked API version is 0.3.50. Missing nodes remain explicit even on newer versions.
- The fixed distilled sigma list now uses ComfyUI core `ManualSigmas`. PlotPickle no longer requires ComfyUI-KJNodes, `StringToFloatList`, `FloatToSigmas`, or any downloaded custom-node Python code for this proof graph.

This is a reviewed graph adaptation, not a claim of a measured GTX 1080 render. Automated tests mock ComfyUI transport and output bytes; they do not run the model or prove GPU compatibility, image quality, or memory consumption.

## First run

Opening VIDEO or LTX-VIDEO ensures that a bundled manifest is saved when none exists. SET UP LTX repeats that operation idempotently. An existing reviewed Advanced Setup manifest is preserved, including its verification state. No cloud route changes occur.

The bundled Windows setup can install the two reviewed model files after one explicit approval:

- `models/checkpoints/ltxv-2b-0.9.8-distilled.safetensors` — Lightricks/LTX-Video, 6.34 GB, SHA-256 `76aa8c4786af752fa6f951947129d5290c3c6c0b2fadcadea6b5e114ae2cad8f`.
- `models/text_encoders/t5xxl_fp16.safetensors` — comfyanonymous/flux_text_encoders, 9.79 GB, SHA-256 `6e480b09fae049a72d2a8c5fbccb8d3e92febeb233bbe9dfe7256958a9167635`.

The maximum reviewed download is 16.13 GB. `scripts/install-comfyui-ltx-2b-starter.ps1` resolves the same Comfy Desktop shared model library used by PlotPickle's managed runtime, downloads only those fixed HTTPS sources, writes to partial files, verifies exact byte size and SHA-256, and only then activates the files. Existing conflicting files are never overwritten. The gateway starts the PowerShell installer with `shell: false`; caller-supplied URLs, paths and commands are not accepted.

All workflow nodes are ComfyUI core nodes. If a core node is missing, PlotPickle reports the exact node and asks for the managed ComfyUI runtime to be updated rather than downloading arbitrary custom-node code. Each missing model is checked against the specific loader's available file choices, not a substring anywhere in the runtime inventory. No spatial upscaler is required by this graph.

The proof preset is 640 × 352 (dimensions divisible by 32), 25 frames at 24 fps, one batch, eight distilled steps, guidance 1. T5 runs on CPU to leave GPU memory for video. No FP8, image input, prompt enhancer, upscaling, or extra model is used. The saved clip is approximately one second, deliberately shorter than a future production clip. Production duration/aspect requests currently use this fixed proof preset; future render scheduling must respect the advertised preset rather than assume a three-second output.

## Stable plug-in contract

`GET /api/local-ai/plugins/video` continues to select via the hardware registry. The selected adapter returns `ready`, `active`, `configured`, `runtimeReady`, `error`, and typed `LocalVideoSetupDetails` under `details`:

- `supportedModes`: currently text-to-video.
- `defaultPreset`: id, dimensions, frame count/rate, steps, mode and upscaling flag.
- `blockers`: exact workflow, runtime version, model and node messages.
- `setupPath`: POST endpoint for idempotent setup and, on Windows with explicit approval, the reviewed model installation.
- `testPath`: POST endpoint for a local proof render with optional prompt; returns succeeded status and outputAssetUrl only after the saved output is retrieved.
- `setupTarget`: engine navigation identifier for the host skin.

For this adapter, setup/test paths are `/api/local-ai/ltx-video/setup` and `/api/local-ai/ltx-video/test`. The setup endpoint never downloads without `approved: true`; the Skin V1 engine screen asks the user before the 16.13 GB transfer. Installation runs asynchronously and the screen polls the local gateway while it is in progress. The engine test bypasses route selection deliberately: it can only call the loopback LTX provider and cannot fall through to a cloud override. Normal generation routing retains existing user choices. Tests reserve/release the existing GPU lease.

`ready` means requirements are present and the test can run. `active`/green additionally requires a saved successful render for the current manifest and no later render error. VIDEO and LTX use the same provider probe. A late job cannot verify or overwrite a newly imported manifest. Native ComfyUI SaveVideo returns video files under `images`; only mp4/webm entries count as video, never a PNG or GIF.

PLAN, STORYBOARD and PREVIS retain the provider-neutral Sequence Director boundary. They can consume this selected plug-in contract without importing LTX or ComfyUI graph code. Production clip scheduling and those future UI surfaces are not implemented by this setup patch.

## Verification

Run `node --test tests/ltx-bundled-default.test.mjs tests/local-ai-plugin-registry.test.mjs tests/issue-1754-skin-v1-logon.test.mjs` locally. Both GitHub gates execute the regression suite and the production build.

On the target Windows installation: start managed ComfyUI; open VIDEO; follow SET UP / TEST to the selected engine; press SET UP LTX; approve the reviewed model download if the two files are absent; leave PlotPickle and ComfyUI open until installation completes; CHECK AGAIN; then TEST LOCAL VIDEO with “A short black-and-white cinematic shot of a person walking slowly through a dim room, subtle motion, steady camera.” Confirm the saved clip opens and VIDEO is green after returning. This physical GPU proof remains a separate acceptance step until performed on that machine.
