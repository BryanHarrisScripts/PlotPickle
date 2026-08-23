# AI routing, models and live diagnostics

Issue: #353  
Follow-up to: #347 / #348  
Parent UI/UX programme: #336

## Purpose

PlotPickle keeps Text, Images and Video independent. Each capability has exactly one active route, and the **Active now** summary states the provider, model or workflow, location, test result and cost at the moment the screen is viewed.

PlotPickle never silently substitutes a paid provider when a selected local route is unavailable.

## Provider matrix

| Capability | Local choices | Cloud choices | Off or manual |
| --- | --- | --- | --- |
| Text | Ollama | OpenAI, MiniMax Text | Off |
| Images | ComfyUI, Ollama + ComfyUI | OpenAI Images, MiniMax Images | Manual Import |
| Video | ComfyUI native MiniMax H3 | OpenAI Video, MiniMax H3 | Off |

“Ollama + ComfyUI” does not claim that Ollama itself renders pixels. The selected Ollama LLM improves the visual prompt, then the selected ComfyUI checkpoint performs local image generation.

“MiniMax Text” is the text model configured under the user’s MiniMax account. MiniMax H3 remains the image/video model family selected separately for those capabilities.

## Ollama Settings

The Ollama Settings surface now separates two checks:

1. **Connection check** — verifies the endpoint, reports the Ollama version, discovers installed models and records latency.
2. **Model inference check** — saves the chosen installed LLM and sends a real PlotPickle test prompt. Ollama becomes green only after a model returns a valid response.

The endpoint and selected model are stored in local application credentials, outside PPF story projects. The model can be changed and retested at any time.

## ComfyUI Settings

ComfyUI diagnostics separate service reachability from generation readiness:

- **Red — Not connected:** the service did not answer on the local port.
- **Yellow — Running, setup needed:** ComfyUI answered, but a checkpoint, required image node or configured workflow node is missing.
- **Green — Ready:** the selected capability has its required nodes/checkpoint or workflow and has completed the appropriate verification test.

The interface accepts local loopback forms such as `localhost:8188` and canonicalizes them to the local PlotPickle endpoint. It reports the exact missing nodes, checkpoint state, last check and response latency.

## Presets and paid-provider boundaries

- **Local-first setup:** Ollama text, Ollama + ComfyUI images, and local ComfyUI H3 video.
- **Cloud setup:** OpenAI text and images, and MiniMax H3 video.

Cloud selection requires explicit cost acknowledgement. Cloud video additionally requires data-sharing acknowledgement. Selecting a route does not run a paid generation or delete another provider’s credentials, models or workflows.

## Status contract

A selected route is:

- **Green** only after the selected model or workflow has passed its real capability test.
- **Yellow** when configuration exists but setup or testing is incomplete.
- **Red** when the selected service or provider has a current actionable error.

Dashboard remains status-only. All endpoints, models, keys, workflows and tests remain in the responsible Settings screens.
