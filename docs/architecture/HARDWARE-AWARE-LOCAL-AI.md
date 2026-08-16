# Hardware-Aware Local AI Runtime

PlotPickle treats local AI as a compute-routing problem, not as an Ollama feature and not as a fixed list of model names.

## Stable application boundary

All production local text roles use an OpenAI-compatible API contract. The preferred local runtime is llama.cpp, followed by LM Studio, Ollama, and any future OpenAI-compatible server. Runtime-specific installation and model-lifecycle behavior stays below this boundary.

Existing OpenAI and MiniMax cloud routes remain separate user-selected providers. Existing Ollama configuration remains compatible, but Ollama is optional and is not required by GUIDE, Creative Room, curriculum retrieval, images, or video.

## Capability-first model routing

PlotPickle now detects model capabilities before it applies the fallback model catalog. The automatic slots are:

| Slot | What PlotPickle looks for |
| --- | --- |
| Fast | text generation, low working-set cost, practical everyday hardware fit |
| Quality | stronger model size, reasoning/tool support, useful context, practical hardware fit |
| Deep reasoning | reasoning/thinking, tools, longer context, larger models that may be on demand |
| Vision / Visual QA | explicit vision/image-input capability plus a usable hardware fit |
| Pi / Repair | coding or tool-use capability, agent readiness, useful context and a safe hardware fit |

The Vision slot is for understanding screenshots, reference images and rendered UI. It is separate from image generation, which remains a ComfyUI/media responsibility.

The Pi / Repair slot is a developer-agent role. It does not make a model a Creative Room model and it never adds a cloud fallback.

### Capability sources

PlotPickle prefers runtime-native metadata instead of model-name guesses.

Ollama: PlotPickle reads the installed model list and model detail metadata, including declared capabilities, parameter size, quantization and model context information.

LM Studio: PlotPickle reads the native model inventory, including model type, parameter size, quantization, maximum context, vision support and trained-for-tool-use metadata.

llama.cpp and other OpenAI-compatible servers: when only a model id is available, PlotPickle uses conservative family/name inference. It will not invent vision support from a generic model name. Explicit advanced overrides remain available when a server knows more than it exposes through its model API.

This means a future model does not need a new PlotPickle integration merely because its family name changed. If the runtime reports that the model supports vision, tools, reasoning and a large context, the capability router can evaluate it for the relevant slots automatically.

### Hardware fit

Capability alone is not enough. PlotPickle estimates the model working set from reported file size or parameter/quantization data and compares it with detected RAM/VRAM.

A model can therefore be recognized as more capable while still losing the everyday Fast or Quality slot on a smaller machine. Large models that require CPU/GPU splitting are penalized for latency-sensitive roles and can remain on demand. On larger GPUs, the same model can rise naturally into Quality, Deep, Vision or Pi/Repair without changing application code.

## Fallback starter models

The static catalog remains as an installation and compatibility fallback rather than the primary router. The initial 32 GB RAM / GTX 1080 8 GB starter profile is:

| Role | Starter fallback |
| --- | --- |
| Fast | Qwen3.5-4B GGUF, Q6_K or Q8 |
| Quality | Qwen3.5-9B GGUF, Q4_K_M |
| Deep reasoning | gpt-oss-20b MXFP4, on demand |
| Curriculum embedding | Qwen3-Embedding-0.6B, CPU |
| Curriculum reranking | Qwen3-Reranker-0.6B, CPU |
| Image generation | ComfyUI + SDXL 1.0 |
| Video | ComfyUI + LTX-Video 2B 0.9.8 Distilled |
| Runtime health check only | SmolLM2 135M |

SmolLM2 is deliberately marked non-production. It can verify an installation or basic inference path but cannot satisfy a Fast, Quality, Deep, Vision, Pi/Repair or Creative Room role.

## Hardware profiles

Hardware detection reads CPU, physical RAM, NVIDIA GPU name, VRAM and compute capability. Pascal is detected by compute capability or known GTX 10-series names.

The Pascal 8 GB / 32 GB profile uses a CUDA 12.6-compatible PyTorch channel for ComfyUI, prefers a CUDA 12 llama.cpp build, permits Vulkan fallback and enables CPU/GPU model splitting. The automatic installer does not select CUDA 13-targeted PyTorch packages for Pascal.

The same router has separate modern 8 GB, 16 GB and 24 GB+ profiles. Higher-memory profiles can unlock larger local text and media workflows without changing application contracts.

## Context policy

The default PlotPickle request budget remains 16K tokens. A 32K profile is available as an advanced override. A model may advertise a much larger native context; that is useful evidence for Quality, Deep and Pi/Repair ranking but is not automatically turned into a huge runtime allocation on a constrained machine.

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

Settings shows the detected hardware profile, runtime preference, local endpoint, context budget, automatic Fast/Quality/Deep/Vision/Pi model slots, the detected capability inventory, retrieval models, SDXL, LTX-Video, SmolLM2 health-check status and GPU scheduler state.

Advanced users can override runtime priority, OpenAI-compatible endpoints, role model names, llama.cpp executable/model paths, context size and GPU-layer splits. Automatic capability matching remains the default.

The Windows hardware configuration script creates the CPU curriculum-RAG environment and exposes the Pascal-safe ComfyUI CUDA 12.6 configuration path. Model installation remains role-based: PlotPickle can still present starter model/quantization guidance when no suitable installed model is detected, but it does not require a new release merely to recognize a newer capable model.

## Compatibility

Legacy Ollama, MiniMax H3 and cloud image/video routes remain available as explicit overrides. They do not alter the local compute architecture or the provider-independent project/visual-continuity state.
