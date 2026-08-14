# Hardware-Aware Local AI Runtime

PlotPickle treats local AI as a compute-routing problem, not as an Ollama feature.

## Stable application boundary

All production local text roles use an OpenAI-compatible API contract. The preferred local runtime is llama.cpp, followed by LM Studio, Ollama, and any future OpenAI-compatible server. Runtime-specific installation and model-lifecycle behavior stays below this boundary.

Existing OpenAI and MiniMax cloud routes remain separate user-selected providers. Existing Ollama configuration remains compatible, but Ollama is optional and is not required by GUIDE, Creative Room, curriculum retrieval, images, or video.

## Model roles

The initial 32 GB RAM / GTX 1080 8 GB profile assigns:

| Role | Default |
| --- | --- |
| Fast | Qwen3.5-4B GGUF, Q6_K or Q8 |
| Quality | Qwen3.5-9B GGUF, Q4_K_M |
| Deep reasoning | gpt-oss-20b MXFP4, on demand |
| Curriculum embedding | Qwen3-Embedding-0.6B, CPU |
| Curriculum reranking | Qwen3-Reranker-0.6B, CPU |
| Image | ComfyUI + SDXL 1.0 |
| Video | ComfyUI + LTX-Video 2B 0.9.8 Distilled |
| Runtime health check only | SmolLM2 135M |

SmolLM2 is deliberately marked non-production. It can verify an installation or basic inference path but cannot satisfy a Fast, Quality, Deep or Creative Room role.

## Hardware profiles

Hardware detection reads CPU, physical RAM, NVIDIA GPU name, VRAM and compute capability. Pascal is detected by compute capability or known GTX 10-series names.

The Pascal 8 GB / 32 GB profile uses a CUDA 12.6-compatible PyTorch channel for ComfyUI, prefers a CUDA 12 llama.cpp build, permits Vulkan fallback and enables CPU/GPU model splitting. The automatic installer does not select CUDA 13-targeted PyTorch packages for Pascal.

The same router has separate modern 8 GB, 16 GB and 24 GB+ profiles. Higher-memory profiles can unlock larger local text and media workflows without changing application contracts.

## Context policy

The default local context is 16K tokens. A 32K profile is available as an advanced override. Advertised model context limits are not used as the default memory budget on a 32 GB RAM / 8 GB VRAM machine.

PlotPickle continues to assemble bounded project and curriculum context rather than transmitting the complete project on every request.

## Curriculum RAG

GUIDE does not inject all 81 curriculum modules into the language-model prompt.

The local retrieval path is:

1. Build the local curriculum passage inventory.
2. Embed the question with Qwen3-Embedding-0.6B on CPU.
3. Retrieve a bounded candidate set.
4. Rerank those candidates with Qwen3-Reranker-0.6B on CPU.
5. Assemble at most the bounded curriculum context budget.
6. Send only that material to the active Fast local model.

The CPU service caches curriculum passage embeddings by corpus digest. If the semantic service is unavailable while starting, GUIDE retains the existing authority-aware bounded lexical retriever as a safe fallback; it never falls back to injecting the entire curriculum.

## GPU ownership

The local GPU scheduler gives one creative workload ownership of constrained VRAM at a time.

Text -> unload ComfyUI media models -> load the selected local text role.

Image -> release the active text runtime -> free ComfyUI memory -> load/render SDXL -> release -> restore Fast text.

Video -> release text and image resources -> hold a GPU media lease for the entire LTX render -> release -> restore Fast text.

On a GPU with 10 GB VRAM or less, a media task is blocked if PlotPickle cannot prove that the active text runtime released its model. PlotPickle-managed llama.cpp provides the strongest lifecycle guarantee. Ollama uses keep_alive=0; LM Studio uses its unload CLI hook. A generic external compatible server without an unload operation must be released by the user or replaced by the managed runtime before a constrained-GPU media task can start.

Embedding and reranking remain CPU-resident and are outside this GPU residency cycle.

## Visual continuity layer

Character and visual consistency are provider-independent inputs. The media request can carry approved character references, identity locks, wardrobe/look IDs, composition, environment references, negative constraints and continuity metadata before a model or provider is selected.

The local SDXL adapter compiles those controls into a continuity envelope. Identity, wardrobe, composition and negative constraints are applied to the prompt. When an approved local character reference is available, the standard ComfyUI SDXL path uploads the reference and uses an image-conditioned VAE/KSampler path instead of silently dropping it. More sophisticated IP-Adapter/ControlNet workflows can be added as advanced adapters without moving the continuity state into a checkpoint-specific schema.

The LTX video path can use an approved PlotPickle source frame and a reviewed ComfyUI API workflow. Workflow manifests are validated before execution and reject network, installer, authorization and arbitrary code-execution nodes.

## Settings and installation

Settings shows the detected hardware profile, runtime preference, local endpoint, context budget, Fast/Quality/Deep model availability, retrieval models, SDXL, LTX-Video, SmolLM2 health-check status and GPU scheduler state.

Advanced users can override runtime priority, OpenAI-compatible endpoints, role model names, llama.cpp executable/model paths, context size and GPU-layer splits.

The Windows hardware configuration script creates the CPU curriculum-RAG environment and exposes the Pascal-safe ComfyUI CUDA 12.6 configuration path. Model installation is role-based: PlotPickle detects missing roles and presents the recommended model/quantization and configured model directory instead of silently substituting another model.

## Compatibility

Legacy Ollama, MiniMax H3 and cloud image/video routes remain available as explicit overrides. They do not alter the local compute architecture or the provider-independent project/visual-continuity state.
