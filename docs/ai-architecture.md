# PlotPickle AI architecture

Status: foundation for the next application increment

PlotPickle treats AI as an optional local-server capability. The canonical story project remains useful with no AI connected and does not become dependent on a provider account, hosted conversation, or proprietary model identifier.

## Product language

The interface may label the primary tested connection as **ChatGPT / OpenAI API** because ChatGPT is the name most writers recognize. The connection itself uses the OpenAI API and the writer's own API key. A ChatGPT subscription and API billing are separate.

Users may instead select MiniMax with their own account and key, an OpenAI-compatible endpoint, a local Ollama server, manual prompt export, or no AI.

## Three creative-compute paths

Collaboration mode and creative-compute path are independent settings. Local Story, Writers' Room and Repository Collaboration projects may each use:

1. **Local AI:** Ollama for writing and planning plus ComfyUI for local image generation. The applications, language models, image checkpoints, custom nodes and workflows remain separate installations. PlotPickle probes only `127.0.0.1:11434` and `127.0.0.1:8188`; it does not silently fall back to cloud services.
2. **Cloud AI:** OpenAI, MiniMax or another reviewed compatible provider using the writer's own account, API key and billing.
3. **No AI:** manual writing, planning and image import with no provider, model or account.

The Windows launcher may offer the Ollama and ComfyUI applications separately with explicit Y/N consent. It never bundles or automatically downloads model weights, checkpoints or custom nodes. macOS and Linux expose official setup guidance until equivalent platform-specific installer flows are validated.

A local service is green only when its loopback API responds and a relevant model or checkpoint is available. A running service without a model is yellow. An unused service is grey. Red requires a previously successful check followed by failure.

ComfyUI installation, endpoint detection and checkpoint discovery are prerequisites, not a finished Graphic Novel connector. A later reviewed adapter must generate one panel at a time, support cancellation, preserve prompt/seed/workflow provenance, use approved references and require human approval before an asset becomes canonical.

## Five separations

1. The PlotPickle project stores creative truth: story, characters, continuity, knowledge references, prompts, approved assets, and provenance.
2. Provider settings store connection details and model choices outside the project.
3. Secrets remain in the local server's private user data or environment, are never written into browser settings, and are never written into a `.plotpickle.json` export.
4. Provider adapters translate PlotPickle requests into OpenAI, MiniMax, compatible-server, or Ollama calls.
5. Generated output is always proposed material. The writer reviews and explicitly applies or approves it.

## Capability model

PlotPickle asks a provider what it can do instead of assuming that every model supports every feature. Capabilities include text, structured output, vision, image generation, image editing, embeddings, knowledge search, and video generation.

The OpenAI adapter is the primary development and test target:

- Responses API for story work, image understanding, and structured output;
- GPT Image for generation and editing;
- provider-hosted file search as an optional knowledge accelerator, never the only copy of project knowledge; and
- no permanent dependency on the current Sora Videos API.

OpenAI's Sora 2 Videos API is scheduled to shut down on September 24, 2026. Video therefore enters PlotPickle only through the replaceable asynchronous video-job contract. The initial OpenAI preset reports video as unavailable and explains why.

MiniMax is the first supported BYOK cloud-video implementation of that contract. A connection check calls the non-generating `/v1/models` endpoint. Still images use `image-01`; H3 video uses the asynchronous `/v2/video_generation` create, query and queued-job cancellation endpoints. Every request uses the current writer's encrypted local key and provider billing. PlotPickle contains no owner key, shared proxy, bundled credit pool or automatic paid fallback.

## Knowledge

Knowledge has two layers:

- **Portable project knowledge** stores writer-approved text, summaries, source labels, hashes, inclusion rules, and citations in or beside the local project.
- **Provider indexes** are disposable accelerators. A vector-store ID or local embedding index can be rebuilt from the portable sources.

Every AI request receives a bounded context pack assembled from the active project, selected story level, chosen characters, continuity locks, and selected knowledge sources. PlotPickle should never upload the entire project by default when a smaller context pack is sufficient.

## Character consistency

Character consistency is an editorial system, not a single magic prompt. Each character can receive:

- an identity lock: age range, face, hair, body, distinguishing features, and non-negotiable traits;
- one or more approved looks: wardrobe, grooming, condition, story phase, and reference images;
- expression and pose references;
- negative constraints describing what must not drift;
- relationship, voice, and performance context; and
- an approval history identifying which outputs became canonical references.

Storyboard and video jobs reference the character ID and look ID. Provider-specific seeds, file IDs, or generation IDs are recorded only as provenance and never become the source of truth.

## Image workflow

1. Build a prompt from the block, scene, shot, project visual language, location, character identity locks, selected looks, and continuity locks.
2. Show the complete prompt and references before spending API credits.
3. Generate or export the prompt.
4. Save the returned asset locally with model, provider, prompt, reference, date, and human-edit provenance.
5. Let the writer reject it, keep it as a variation, or approve it as a canonical reference or storyboard frame.

For the automatic comic Pitch, PlotPickle makes one explicitly approved batch across the 96 canonical mini-block positions. OpenAI requests with approved local character references use the image-editing endpoint; MiniMax `image-01` requests may send one writer-approved character reference; requests without usable references use text-to-image. Prompts exclude written words, while screenplay dialogue stays editable as HTML balloons outside generated image pixels.

## Video workflow

Video is a job rather than a synchronous response. A job records prompt, source frame, character looks, duration, aspect ratio, provider, model, status, progress, output asset, and failure details. Provider adapters may implement create, poll, cancel, and download operations. A provider without video capability still supports prompt export.

MiniMax H3 accepts a text prompt or an approved PlotPickle image as the first frame. PlotPickle stores the task ID locally, normalizes queued, running, succeeded, failed, cancelled and expired states, and downloads successful MP4 output into private local asset storage. MiniMax permits cancellation only while a task remains queued; a running task can finish and may still be charged. The gateway returns every completed video as unreviewed. A later Animate Panel and Visual Pitch surface must obtain a separate human approval before associating that asset with a PPF project.

## Security and privacy

- API keys are not project data and are not included in exports, autosaves, logs, prompts, or error messages.
- The official local gateway accepts browser requests only from localhost origins.
- A key saved through AI Setup is written only after a successful provider check, under the current computer account's persistent PlotPickle data with user-only file permissions where the operating system supports them.
- The interface shows **API connected** only after a real provider response, records the last successful check, rechecks a saved connection when PlotPickle opens, and lets the user test or remove it.
- Connections to arbitrary compatible endpoints require an explicit user action and a visible base URL.
- PlotPickle shows what selected project material will leave the computer before the first live call.
- Live API calls are opt-in tests. Automated CI uses mocked provider contracts and never requires a real key.
- Every paid media call carries an explicit one-request billing acknowledgement. The confirmation identifies the selected provider and uploaded prompt or references; a missing acknowledgement is rejected by the local gateway before network use.

## Settings menu

PlotPickle exposes these connections through one grouped Settings menu rather than a separate AI Studio:

- **Workspace:** General; Appearance / Accessibility; Project Defaults.
- **Integrations:** Story & Art; Repository & Collab; Scheduling & Meetings; Media & Film Engines.
- **Data Storage:** Storage & Backups.
- **Security:** Privacy & Permissions; About & Licensing.

Story & Art contains the former **AI Setup** choices: ChatGPT / OpenAI API, MiniMax API, an OpenAI-compatible endpoint, Ollama or another local LLM, manual prompt export, or no AI. Non-secret preferences remain in local browser settings. In the downloaded edition, verified API keys may be saved through the private local gateway, but never enter browser settings or project exports.

**Music** links for Suno or Udio remain bounded references inside Media & Film Engines. PlotPickle stores links only; it does not copy music or claim a direct service integration. Media-engine placeholders cannot be enabled until a real, reviewed connector exists.

Knowledge, character consistency, image, and video capabilities remain part of the provider-independent foundation. They appear as contextual actions inside Characters, Story Planner, Visual Board, Pitch, Voiceprint, PageFlow, and DraftLens when implemented.
## First in-workflow creative actions

Version 0.9.0 moves the first optional AI actions into the places where writers work:

- Screenplay suggestions receive only the current project, Block, mini-block, and character context selected by the writer. The response remains a suggestion until the writer chooses how to insert it.
- Character reference generation builds a reusable identity prompt from the character profile and world visual language. The local gateway saves the generated file under the current PlotPickle user-data folder and returns a loopback asset URL for the character thumbnail.
- Comic Pitch rebuilds all 24 Blocks and 96 mini-blocks as a resumable black-and-white visual deck only after the writer reviews the context, character locks, privacy boundary and possible cost.
- OpenAI uses the Responses and image-generation endpoints. OpenAI-compatible services use chat-completions and image-generation conventions. Ollama/local models support screenplay text when the selected model is capable; they do not falsely advertise image generation.
- The saved API key remains server-side. The browser sends creative context to PlotPickle's loopback gateway and never receives the key.
