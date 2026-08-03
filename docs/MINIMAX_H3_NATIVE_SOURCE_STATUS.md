# MiniMax H3 native-source status

Checked August 3, 2026.

PlotPickle treats native MiniMax H3 support as a day-zero adapter, not a claim that public local weights already exist.

Official MiniMax repositories and tooling currently document cloud video generation. The official ComfyUI repository and documentation list supported native video models, but do not currently publish MiniMax H3 native weights or a built-in H3 workflow.

Therefore:

- native H3 remains locked until a manifest cites an official MiniMax or ComfyUI source;
- PlotPickle does not recommend or install community weights or custom nodes automatically;
- users must own and place model files in the official ComfyUI model directories declared by the manifest;
- cloud MiniMax remains a separate BYOK route;
- the status should be rechecked when MiniMax or ComfyUI publishes an official H3 release.

Official source families used for verification:

- https://github.com/MiniMax-AI/
- https://huggingface.co/MiniMaxAI/
- https://github.com/Comfy-Org/ComfyUI/
- https://docs.comfy.org/
