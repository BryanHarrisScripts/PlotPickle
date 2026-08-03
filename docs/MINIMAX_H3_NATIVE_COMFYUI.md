# MiniMax H3 native ComfyUI routing

PlotPickle supports a separate local MiniMax H3 route for user-owned model files running through ComfyUI. This route is intentionally independent from the MiniMax cloud API route.

## Current release state

MiniMax announced H3 on July 31, 2026 and said downloadable weights would follow. PlotPickle does not treat news coverage, mirrors, repacks or community custom nodes as an official local release. Native H3 remains locked until the user imports a manifest derived from an official MiniMax or ComfyUI source and the live ComfyUI service verifies the declared version, nodes and model files.

Official source roots accepted by PlotPickle:

- https://www.minimax.io/
- https://github.com/MiniMax-AI/
- https://huggingface.co/MiniMaxAI/
- https://github.com/Comfy-Org/ComfyUI/
- https://docs.comfy.org/

## What PlotPickle does

- Connects only to `http://127.0.0.1:8188`.
- Validates an API-format ComfyUI workflow before storing it.
- Supports text-to-video, image-to-video, first/last-frame control, reference-to-video and in-place editing manifests.
- Checks the manifest's minimum ComfyUI version.
- Checks every workflow `class_type` against the running ComfyUI instance.
- Checks expected model filenames through the declared ComfyUI loader inputs.
- Sends the PlotPickle scene or storyboard prompt and selected local reference assets into the reviewed workflow.
- Polls ComfyUI history and returns completed MP4 or WebM output to the original PlotPickle asset identifier.
- Presents setup status and actions with semantic text elements, a visibly labelled readiness list and native button-state accessibility.
- Stores no MiniMax cloud key in the native H3 configuration.

## What PlotPickle never does

- It does not bundle or redistribute H3 weights.
- It does not download model files automatically.
- It does not install custom nodes.
- It does not execute downloaded Python, shell, Git or installer code.
- It does not activate a workflow containing cloud API keys, authorization fields, network nodes or installer nodes.
- It does not fall back to the MiniMax cloud API automatically.

## Manifest contract

The schema is stored at `config/minimax-h3-native.manifest.schema.json`.

Every manifest must provide:

- `schemaVersion: 1`
- `model: "MiniMax-H3"`
- one supported `workflowFamily`
- an accepted `officialSource`
- `minimumComfyUIVersion`
- an API-format `workflow`
- one or more `requiredModels` entries identifying the ComfyUI model directory, loader node, loader input and accepted official filenames

Every workflow must contain `{{PLOTPICKLE_PROMPT}}` and the family-specific placeholder:

| Workflow family | Required asset placeholder |
| --- | --- |
| text-to-video | none |
| image-to-video | `{{PLOTPICKLE_SOURCE_IMAGE}}` |
| first-last-frame | `{{PLOTPICKLE_FIRST_FRAME}}` and `{{PLOTPICKLE_LAST_FRAME}}` |
| reference-to-video | `{{PLOTPICKLE_REFERENCE_ASSET}}` |
| in-place-edit | `{{PLOTPICKLE_SOURCE_VIDEO}}` |

Optional shared placeholders are `{{PLOTPICKLE_DURATION}}` and `{{PLOTPICKLE_ASPECT_RATIO}}`.

## 8 GB VRAM profile

PlotPickle labels 8 GB VRAM as **constrained**, not supported or recommended. The user must explicitly acknowledge that generation may fail, be extremely slow or require a smaller official workflow. PlotPickle does not promise local 2K output, 15-second duration or any speed target. Systems reporting less than 8 GB VRAM are blocked from native H3 activation.

## Setup sequence

1. Install or update ComfyUI from an official ComfyUI source.
2. Obtain H3 weights and the workflow only from an official MiniMax or ComfyUI source.
3. Place each model file in the official directory named by the manifest.
4. Start ComfyUI on `127.0.0.1:8188`.
5. Open PlotPickle Settings → Images & Video → MiniMax H3 · Native ComfyUI.
6. Save and inspect the ComfyUI connection.
7. Paste the official manifest JSON.
8. Resolve every missing version, node and model-file requirement.
9. Review the VRAM warning and activate the native route.
10. Run a local test or generate from a storyboard/scene asset context.

Cloud MiniMax remains available as a separate BYOK route. Its API key continues to use PlotPickle's encrypted local credential storage and is never inserted into a native H3 workflow.
