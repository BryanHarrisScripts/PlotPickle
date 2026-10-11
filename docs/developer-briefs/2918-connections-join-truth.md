# #2918 — Connections V2: provider catalog, ComfyUI Join, and verified routing

Date: October 11, 2026. Status: implementation candidate and governed test plan. Human acceptance is **not** inferred from synthetic CI.

## Human truth — preserved from October 11 walkthrough
The user confirmed: left = Writing/Images/Video capability, middle = **only ComfyUI Local / ComfyUI Cloud workflows**, right = **Local and Cloud Providers**. Ollama belongs on the right. A direct Writing route can go straight to Ollama. The user chooses one workflow and one provider/model and **Join** is a simple part of setup. Each entry says Setup Needed until ready; unsupported choices explain why the route is not capable; selected connections visually change color, with explicit text for Verified vs still Setup/Test Needed. The user named Ollama, ComfyUI, LTX video, MiniMax H3 locally; OpenAI, ComfyUI Cloud, Gemini, MiniMax in cloud; then additionally **Qwen-Image-2.1** and **SDXL Base** locally.

See [issue #2918](https://github.com/BryanHarrisScripts/PlotPickle/issues/2918) for the successive transcript interpretations, including the clarification that **Join does not itself mean Verified**. The user approved build → test → fix → PR → test → merge when green.

## Authoritative architecture
The [AI Programming Evolution white paper v3](../white-papers/AI_Programming_Evolution_White_Paper.md) is the governing framework: human behavior → versioned contract → math constraints → implementation → independent evidence. Existing product truths PP-AI-001–006, PP-VIS-003–004, PP-SETTINGS-002–003 and PP-UAT-001–007 remain locked. Formalization belongs to `core/contracts/compute/connection-join-contract.mjs`, not a new renderer-owned policy.

Existing #2914 / PR #2915 gave local LTX a verified route, separated direct MiniMax from ComfyUI API workflow evidence and protected encrypted profile ownership; preserve all of it. #1879 / #1881 provide ComfyUI Cloud design intent but do **not** demonstrate a runnable current remote workflow. #2830 remains the attended Windows motion acceptance owner. #2917 is the separate Autonomous QA drift and must not be hidden or weakened.

## Provider and executable-combination census
| Capability | Provider or model (right) | Engine (middle) | Existing route | Truth |
|---|---|---|---|---|
| Writing | Local Writing Runtime | Direct (no engine) | local | Requires exact-model response test |
| Writing | Ollama | Direct | ollama | Text generation; ComfyUI not required |
| Writing | OpenAI / Gemini / MiniMax | Direct | openai / gemini / minimax | Distinct cloud text profiles and consent |
| Images | SDXL Base 1.0 | ComfyUI Local | comfyui | Default local image profile, actual output proof |
| Images | Qwen-Image-2.1 | ComfyUI Local | comfyui | Experimental, user-supplied GGUF workflow, Research License acknowledgement, exact profile proof; never bundled/downloaded |
| Images | Ollama prompt enhancement | ComfyUI Local | ollama-comfyui | Ollama only improves the prompt; ComfyUI generates images |
| Images | OpenAI / MiniMax | Direct | openai / minimax | Remote still generation with per-provider proof |
| Video | LTX-Video | ComfyUI Local | ltx-video | Local text-to-video, reviewed nodes/models, saved output proof |
| Video | MiniMax H3 Local | ComfyUI Local | comfyui-native | Native local inference; hardware/nodes/manifest constraints |
| Video | MiniMax H3 API Workflow | ComfyUI Local | minimax-comfyui | ComfyUI orchestrates MiniMax cloud API; separate workflow proof and consent |
| Video | MiniMax Direct API | Direct | minimax | Direct API proof; not interchangeable with above |
| Video | OpenAI | None executable today | unsupported | Current source says video adapter unavailable; do not invent a Join |
| Images/Video | ComfyUI Cloud | ComfyUI Cloud | none executable | Connection setup present but no reviewed executable remote adapter; show blocker and never claim verified |
| Video | ComfyUI Local + OpenAI | No registered adapter | unsupported | Explain 'This route is not capable' |

ComfyUI is a workflow engine and LTX/SDXL/Qwen are local model resources, not additional LLM providers. Inference location is independent from workflow engine location (e.g., MiniMax API through local ComfyUI runs paid inference remotely).

## Behavioral state machine and mathematical constraints
Configured = user has saved a valid supported combination (Join). Verified = exact required capability test passed against the current profile/workflow identity. Active = verified Join selected through the one canonical capability router.

- `JoinAccepted(c,e,p) => Supports(c,e,p) && Authorized(account)`.
- `Ready(c,e,p) => JoinAccepted(c,e,p) && CurrentProof(c,e,p,configHash,modelHash,workflowHash)`.
- `!Supports(c,e,p) => JoinRejected(exactReason) && !Active(c,e,p)`.
- `JoinAccepted && !CurrentProof => SETUP_NEEDED || TEST_NEEDED`; no green/Verified indication.
- `ActiveRoutesPerCapability <= 1`; direct text routes have engine `direct`.
- `Join => Δ(paidJobs,remoteGeneration,storyCanon)=0`.
- `ReportedJoined(account,version) => DurableCommit(account,version)`.
- Proof changes to provider, model, endpoint or reviewed workflow invalidate Ready.
- Generation/Storyboard/Previs/Timeline use only currently selected verified route; never choose by UI visual state or silently fall back locally/remotely.

Keep historic compound route IDs as internal backward-compatibility mappings. Never silently migrate account credentials or mutate project PPF. A selected/unverified Join may be saved but not dispatched.

## Implementation
1. One capability+provider+engine catalog in `core/contracts/compute/connection-join-contract.mjs`, with server-side validation and proof based on existing `/api/ai-routing/status`. Explicit unsupported pairs are visible but not executable.
2. `/api/ai-routing/join` records a compatible Join in authenticated, encrypted account-owned compute settings. An exact verified Join can activate via current `selectRoute` and consent/authority protections; unverified Join persists without active-dispatch change. Store Join and route selection consistently and compare current proof on read.
3. Connections shows three columns and corresponding capability-specific model/provider choices. ComfyUI Local and ComfyUI Cloud are the middle engine choices. Direct-provider support clears workflow explicitly. Individual items retain Setup Needed/Test Needed/Verified or Not Capable reason. The color of selection is distinct from green verified health and accompanied by text/ARIA state.
4. Qwen and SDXL share an existing ComfyUI execution route but must not inherit each other's proof. Qwen setup requires license/workflow review, and activating a model must be a separate explicit setup operation, not a Join side effect.
5. Diagnostic and immutable requirement IDs must flow into source and rendered UAT, not be replaced by source-string assertions.

## Test and merge evidence
- Pure deterministic contract: provider/engine matrix, positive direct Writing+Ollama, positive SDXL/Qwen/LTX/H3, rejected OpenAI video+ComfyUI Local / unsupported ComfyUI Cloud, experimental profile mismatch, valid ready vs configured states.
- Authenticated HTTP: Join with no inference, rejection with no credential changes, unverified profile retention/restart, actual exact route proof activation, unique persisted selected execution, consent refusal, cross-account isolation, failure and stale-proof revocation.
- Rendered browser: three columns, all named resources, workflow selection, Join, status text and link color, keyboard and screen reader semantics, reload/readback, measured console errors.
- Storyboard/Previs/Timeline: selected route only, no unexpected paid or local fallback; real output and 3-second clip await attended Windows #2830.
- Test focused Node contracts, existing source/UI ownership checks, production build and exact-head CI Product/Architecture/Windows gates. Repair failures and merge only when all relevant checks are green and no contract is weakened.
