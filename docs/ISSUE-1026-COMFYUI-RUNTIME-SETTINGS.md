# Issue #1026 — ComfyUI runtime and AI setup synchronization

PlotPickle treats ComfyUI Desktop and the ComfyUI API as separate concerns.

- Product readiness comes from the loopback API, the reviewed PlotPickle workflow nodes, checkpoint/model readiness and a successful PlotPickle test.
- A reviewed Comfy Desktop managed instance is started headlessly from its managed Python and `main.py` when the user explicitly selects/starts local ComfyUI.
- The managed start preserves Comfy Desktop's shared model-path configuration and does not require the Desktop Launch button.
- Desktop remains an inspection/first-run fallback only; the visible Desktop canvas is not a PlotPickle readiness signal.
- Normal Windows startup brings the PlotPickle server up before optional companion inventory/maintenance runs. The deferred maintenance process is non-interactive and cannot block core readiness.
- AI Routing setup actions resolve to the exact in-place Settings owner: Ollama, OpenAI, MiniMax or ComfyUI. The Ollama + ComfyUI hybrid route exposes both owners.
- Cloud provider credentials continue to use PlotPickle's existing protected local AI connection gateway. No provider key is stored in a PPF project or rendered back into Settings.

The focused regression is `tests/issue-1026-comfyui-runtime-settings.test.mjs` and remains part of LEARN Validation.
