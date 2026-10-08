PlotPickle developer brief: consistent provider setup, readiness and capability routing

Prepared for Bryan Harris, October 7, 2026 (America/Toronto).
Engineering issue: https://github.com/BryanHarrisScripts/PlotPickle/issues/2841
Assessment baseline: main, 4077cff202045a42bb6f845c97a150a77ea3dfa1.
Status: specification prepared; implementation and product proof pending.

Purpose

Make Settings describe and control the backend that Storyboard, Previs and Timeline actually use. A provider successfully configured and tested in Local or Cloud must appear with the same readiness in Hybrid. The route selected in Hybrid must remain selected after refresh, project unload/reopen and application restart, and must be the route used for the corresponding generation request. If it cannot run, show the actual reason before submission rather than silently switching provider or displaying a false Ready state.

The immediate workflow is local Writing and Storyboard image generation, text-grounded Storyboard narration, Graphic Novel/Flip Book playback in Previs, and image-to-video motion from a saved, locked Storyboard frame in Timeline. The user wants to establish reliable backend wiring before attempting this workflow again.

Discussion and screenshot evidence

The following screenshots were inspected during this discussion. These are evidence of current presentation and user intent, not proof that a provider completed a job.

image(20261008-001450).png: Local Writing has a Set up status, a Set up button and Use for Writing. The first two appear to be duplicate setup actions.
image(20261008-001540).png: Local Writing setup opens the configured local runtime/model surface. The user wants model configuration here without another activation step. Ollama is the current user's setup; preserve the general runtime abstraction.
image(20261008-001916).png: Hybrid includes image Job Routing with Auto, Local First and Cloud First above the capability grid. The user wants this panel removed because the grid owns route selection.
image(20261008-002029).png: Hybrid repeats cloud billing and video data-sharing acknowledgments already accepted during Cloud setup. The user wants these duplicates removed.
image(20261008-002138).png: Capability overview uses small status squares. The user wants a green circle containing a check mark with a clear Ready label after successful setup and verification.
image(20261008-002724).png: Hybrid lists Local and Ollama under Writing, local ComfyUI image choices, ComfyUI Native / MiniMax-H3 under Video, and MiniMax/OpenAI under Cloud Video. It does not expose the desired local ComfyUI runtime with compatible API-backed video workflows. Video Off is shown as Ready in the summary, which must not imply motion generation is available.

The earlier image-to-video discussion and prepared MiniMax workflow are also in scope. The old missing-attachment messages do not invalidate the screenshots that were subsequently inspected. Never depend on conversation-scoped image paths as durable engineering evidence; attach copies to the implementation evidence when required.

Authority contract

Local and Cloud are setup surfaces. They prepare resources, save credentials/configuration in the authenticated encrypted profile, test individual capabilities, and display readiness. Several providers can be ready simultaneously. Successful setup does not choose a new active generation route.

Hybrid is the single user-facing owner of capability selection. It shows resources prepared through Local and Cloud and selects the resource, provider, model and workflow for Writing, Images and Video. Agents that use Writing should report their dependency on the selected Writing route; do not create a competing Agent routing authority.

Generation consumers use the same authoritative selection and readiness contracts. UI state, browser session storage, legacy provider active flags and per-job preferences must not replace this authority. A status read must be observational, not a route-changing operation. Initial migration may translate legacy state once, with an explicit version and deterministic precedence.

Ready and Active describe different facts. Ready means the exact saved capability configuration has valid verification evidence and its dependencies are available. Active means it is the user's selected route. A selected route that loses readiness remains selected but blocked, with a visible reason. Setup alone means configured/test needed, not Ready. Off is an intentional disabled state, not a verified video resource. An all-local or all-cloud selection in the Hybrid grid is valid; do not require a mixed locality merely to report that usable selected capabilities are ready. Missing Video setup must not prevent unrelated ready Writing or Images work.

Required UI changes

Each provider/resource row has one Setup action. Use Setup needed for the unconfigured status label so it cannot be confused with another button. The single action may open the existing setup surface for editing or testing. Remove Use for Writing and corresponding Use for capability activation buttons from Local and Cloud; activation belongs in Hybrid.

Local Writing Setup opens the configured local runtime setup directly, currently Ollama for this user. Saving a model configures that resource. If its generation-affecting configuration changes, invalidate the affected verification and show Test needed. If it is already selected in Hybrid, retain the selection and require a successful retest before the new configuration can run. Do not mark a newly changed model Ready merely because the old model was tested.

Apply the same setup semantics to Cloud Writing: OpenAI, Gemini and MiniMax can all be prepared and ready concurrently without forcing one to become active during setup. Capability support must be provider-specific.

Use the same green circle/check mark and Ready text in Local, Cloud and Hybrid. Include accessible text; color alone is insufficient. Keep Active selection distinct. Provide configured/test needed, unavailable, failed, unsupported and disabled states with actionable reasons. Refresh all three surfaces from authoritative status after save, test, selection and profile changes.

Remove the complete Hybrid image Job Routing panel and its Auto/Local First/Cloud First controls, request dependencies and obsolete instructions. Removing the visible controls alone is insufficient: migrate or retire persisted job preferences so they cannot override the selected Images route. Keep image request attributes for quality/edit/reference compatibility; reject incompatible work on the selected route with a useful explanation rather than using those attributes as hidden provider selection.

Remove the repeated Hybrid cloud billing/video-sharing checkboxes. Reuse the existing saved, provider-scoped setup acknowledgments through authenticated backend reads. Missing required acknowledgment should point to the provider's Setup surface. Never manufacture consent by sending true from the client. A local ComfyUI workflow calling a cloud API still has paid usage and external prompt/image transmission; those facts cannot be bypassed because the runtime is local. Preserve bounded, action-specific paid-generation authorization at the actual generation action.

Video runtime and provider choices

Expose ComfyUI in Local Video as the local runtime. Within it expose configured, compatible workflow/provider/model combinations, beginning with the existing MiniMax H3 API workflow. This uses local ComfyUI to call the user's MiniMax API account, then downloads the result. It must not require a ComfyUI Cloud account or Comfy credits.

Expose ComfyUI Cloud in Cloud resources using that exact label. The current remote setup already stores Comfy Cloud authority; wire it into the shared capability status and selection only for executable, verified workflows. A successful object-info connection probe is connection evidence, not an image/video generation verification. A manual/browser-only connection is not an automated generation route.

Keep native local H3 inference separate, explicitly labeled ComfyUI — Native local inference if retained. The current ComfyUI Native / MiniMax-H3 backend represents local weights and must not simply be renamed ComfyUI Cloud. Native model/workflow/hardware readiness cannot be reused as verification of the API-backed MiniMax route, or vice versa.

Keep direct MiniMax API video distinguishable from MiniMax through local ComfyUI and from ComfyUI Cloud. Use explicit internal route identities and readable labels; do not collapse these routes to a generic minimax string during refresh or restore.

The user also requests OpenAI as a provider choice within local ComfyUI. Assess and verify a supported installed workflow/node and current provider/model availability before enabling it. Existing direct OpenAI video code is not proof of a compatible local ComfyUI workflow. If unavailable, show Unsupported / workflow required with a concrete reason, rather than Ready or a selectable route that cannot run. Consult current primary provider/Comfy documentation during implementation; current repository UI already contains an OpenAI video sunset notice, so historical compatibility must not be assumed. Do not add a speculative video adapter solely to populate a dropdown.

Represent runtime location, inference location, provider/account owner and cost/data transfer separately. Local ComfyUI plus MiniMax belongs under Local Resources as a runtime selection, but must visibly identify Cloud generation through MiniMax API. Policy and consent checks use effective execution facts, not the display column alone.

Image-to-video contract

For Timeline motion, carry the selected shot's saved, approved/locked Storyboard image as the first-frame source and combine it with grounded screenplay/shot motion information. Do not substitute a poster, an unrelated shot or text-only input when the action requests image-to-video. Test installed custom-node classes and input/output schemas, workflow placeholders, image transport, provider authentication, submission, polling, download and local asset persistence.

The prepared MiniMax workflow bundle is an input to review, not an installation or generation proof. It includes an API workflow and UI workflow and uses the direct MiniMax endpoint. Validate compatibility with the user's actual Windows ComfyUI version and installed nodes before calling it usable. Use profile-held credentials at execution; never embed them in exported workflows or evidence.

The target shot length remains approximately three seconds. The prepared workflow currently requests five seconds. Do not promise the provider accepts three seconds: validate provider limits, explicitly record source duration and use the existing supported Timeline trim/assembly path for the shot target when needed. Downloaded playable source video and a playable three-second Timeline shot are separate evidence items.

Storyboard narration remains the already-merged text-only contract: screenplay, dialogue and shot facts feed concise captions and grounded dialogue bubbles. It must not require an image-capable Writing model. Previs playback of saved frames and approved text must not require a video provider. Only features that actually generate motion should require Video readiness.

Persistence, verification and dispatch

Reuse core/contracts/compute/compute-readiness.mjs and the encrypted profile-compute storage. Extend existing contracts instead of adding a second readiness store. Bind verification to capability, provider/model, runtime endpoint, workflow/version and generation-affecting settings. Configuration changes invalidate only affected proof. Reachability and capability verification are separate evidence.

Persist the selected route and existing image/video verification through authenticated profile unlock, close/restart, project unload/reopen and saved changes restoration. If a fresh dependency probe fails, preserve the saved choice and verification history but mark execution unavailable with the observed reason. Keep profiles isolated and never expose keys in response bodies, diagnostics, workflow files or issues.

Route selection must validate capability support, valid saved consent and readiness on the server as well as in the UI. A rejected or partially failed update must not leave underlying media/provider stores pointing somewhere different from Hybrid. Writes require an atomic update or deterministic recovery in the existing storage boundary. Profile switch/unlock failure must clear stale client status without leaking or selecting another profile's resource.

Storyboard image generation, Storyboard narration, Previs and Timeline preflight must resolve the same selected capability route. Timeline must see the same video verification as Settings. If a selected route goes unavailable between preflight and submission, stop before a paid job is sent and show the reason. No silent paid/cloud fallback, fake completed asset or optimistic success.

Provide bounded diagnostics recording selected route, runtime/provider/model/workflow identifiers, capability, configuration identity, verification timestamp, dispatch destination class, job status, asset-save outcome and timing. Exclude keys, private prompts/story text and complete model responses. Retain readable progress history through submitted/polling/downloaded/saved/failed so test messages do not overwrite all evidence.

Source assessment and likely owners

app/skin-v1/story-mode-capability-connections.tsx: shared status/setup/use controls.
app/skin-v1/local-ai-skin-host.tsx and cloud-story-mode-host.tsx: connection rows, setup navigation, Use for actions and active/readiness presentation.
app/skin-v1/hybrid-story-mode-panel.tsx: capability matrix, duplicate consent, job preferences, route labels and mixed-locality readiness summary.
app/skin-v1/cloud-provider-setup-panel.tsx, local-h3-setup-panel.tsx, comfy-cloud-setup-panel.tsx: existing setup/test behavior.
build/ai-routing-gateway.ts: canonical selection/status candidate; current readRoutingChoice reconciles underlying active stores by mutating selection, and video selection maps multiple cases through minimax/direct/none. This requires a focused repair and migration, not a label-only change.
build/media-routing-gateway.ts and build/story-mode-policy-gateway.ts: image per-job resolution and generation policy currently permit a route differing from global selection; local/API-backed video classification needs explicit execution facts.
build/media-routing-store.ts: provider capability proof and video-route persistence.
build/ai/comfyui-media-provider.ts: existing minimax-comfyui workflow execution.
build/ai/h3/comfyui-h3-native-provider.ts: distinct native inference route and requirements.
app/api/cloud-story-mode/comfy-cloud/route.ts: encrypted Comfy Cloud settings and non-generative object-info probe; not sufficient proof of automated generation.
core/contracts/compute/compute-readiness.mjs and core/storage/profile-private/profile-compute-settings.mjs: shared readiness and encrypted profile owners.
lib/video-production.mjs and actual Storyboard/Previs/Timeline generation handlers: inspect consumer-specific readiness and route resolution; do not leave a configured-only check where verified capability is required.

Existing root gateways are current consumers, not permission to add new flat-root helpers. Place any new implementation under the existing domain owner in accordance with AGENTS.md. Preserve legacy endpoint compatibility only where needed, name its canonical owner and removal condition, and retire the obsolete AI Routing product surface without deleting endpoints still used by the new Settings flow.

Acceptance criteria and proof requirements

AC01. Every Local/Cloud row has one Setup action, no Use for capability button, and an unambiguous Setup needed status. Prove with rendered interaction evidence.
AC02. Setting up provider B while A is selected leaves A selected; A and B can both be Ready. Prove actual save/test/status handlers, not a static fixture alone.
AC03. Changing a selected model retains its selection, invalidates affected proof, blocks generation until retest, then restores readiness across all surfaces.
AC04. Local, Cloud and Hybrid share Ready/Active/error meanings and accessible readiness markers. Configured-only and unreachable resources never render Ready.
AC05. Hybrid alone changes active capability selection; repeated status reads, setup navigation and refresh never overwrite it.
AC06. The image Job Routing panel is gone and saved legacy preferences cannot change actual image dispatch. Prove conflicting legacy preferences against a selected route.
AC07. Duplicate Hybrid consent controls are gone. Stored provider acknowledgments are checked server-side; missing consent blocks selection/dispatch with a Setup target. A local runtime calling cloud still requires the appropriate saved consent.
AC08. Local ComfyUI, ComfyUI Cloud, direct MiniMax and native local inference have distinct labels and internal route identities; API-backed local ComfyUI has truthful paid/cloud disclosure.
AC09. MiniMax through local ComfyUI accepts the locked shot image, calls the MiniMax account endpoint, polls and saves a playable local video. It does not use Comfy Cloud credentials/credits.
AC10. OpenAI/local-ComfyUI is selectable only when an installed compatible workflow and current provider capability are proven; otherwise show the exact unsupported reason.
AC11. Comfy Cloud connection success alone never marks Images/Video generation verified; each supported workflow needs capability proof and actual dispatch support.
AC12. Selection, credentials and valid proof survive authenticated restart and project restore; different profiles never share them. Tamper/unlock failure is observable and does not produce Ready.
AC13. A changed endpoint, workflow, node schema, key or model invalidates the affected verification. A failed dependency probe preserves the chosen route but blocks execution.
AC14. Server rejection, interrupted selection writes and stale clients cannot leave Hybrid and the execution store disagreeing; prove failure recovery and unsupported/not-ready route rejection.
AC15. Storyboard image request reaches the selected Images route and returns a saved usable asset; narration reaches the selected Writing route using text only and keeps approved text after reopen.
AC16. Previs can play saved locked frames plus approved bubbles without a Video provider. Video Off appears Disabled and cannot be counted as motion-ready.
AC17. Timeline uses the selected saved image-to-video route and verification after restart, obtains and plays a saved clip, and reports genuine preflight failures before submission.
AC18. An unavailable selected route never silently falls back or sends a paid request; diagnostics show the intended route and precise blocker without private content.
AC19. Supported all-local/all-cloud/mixed selections work without artificial mixed-locality requirements; one missing capability does not block another ready capability.
AC20. Save/test/selection failures leave truthful status and readable progress history; successful verification records are attributable to the exact configuration and evidence.

Delivery phases

Phase 1: reconcile route authority, identity, persistence, legacy migration, consent and readiness using existing owners; remove read-side selection mutations and hidden image-provider preferences. Add handler-level regressions for these contracts.
Phase 2: simplify Local/Cloud/Hybrid controls and labels, wire status refresh and capability-scoped setup. Add rendered interaction proof for the screenshot requirements.
Phase 3: connect supported local ComfyUI API-backed video and Comfy Cloud capabilities to the same selection/preflight/dispatch contract. Validate the prepared MiniMax workflow and classify OpenAI support. Prove image payload transport and saved asset handling.
Phase 4: run the real Storyboard-to-Previs-to-Timeline path, restart/reopen it, and record Windows product observations. Fix failures before claiming convergence.

Validation and completion boundary

Resolve verification classes using config/development-verification-routing.json and scripts/verification-core.mjs. Exercise real authenticated endpoints, encrypted profile save/reopen and dispatch adapters with bounded deterministic provider fixtures for regressions. Fixtures prove wiring and failure behavior; they do not establish live provider compatibility or the user's installed Windows readiness.

Run the nearest relevant regression checks, focused UAT contracts and production build. Maintain a convergence manifest matching AC01–AC20, plus the persistent Development Run ledger on the implementation PR. Independent GitHub Architecture and Windows Product gates must succeed on the exact current head before a separately authorized merge. Preserve story content and approved assets.

For actual Windows proof, use the existing PowerShell startup, authenticated encrypted profile, saved Afterglow frame and installed ComfyUI. Record non-generative node/schema/connectivity checks separately from any authorized bounded live generation. Do not spend credits merely to populate a green status. When live proof is not available, leave that item UNPROVEN and state the dependency.

Completion requires observed route identity, correct input, actual dispatch, playable saved output and successful reopen, not merely a green build or readiness label. This brief does not claim that the current user's local ComfyUI installation is compatible or that a paid provider job has succeeded.

Related issues and scope boundaries

#2821 remains the parent for encrypted persistence and end-to-end saved-story acceptance. Link this Settings work as a focused prerequisite; do not close the parent from UI evidence alone.
#2830 remains the comic-to-motion proof owner. Its actual video/playback/reopen acceptance must use the corrected selected route.
#2835 remains the clean-startup/existing-account observation owner. Reuse the existing authentication contract; do not reopen solved startup engineering without evidence.
#2825 remains the separate OpenPencil experiment/review workflow; it is not part of this routing repair.
Merged #2837 / PR #2838 is the profile-compute persistence baseline; merged #2839 / PR #2840 is the text-only Storyboard narration baseline. Extend and verify these contracts rather than undoing them.

This task prepares the developer brief and engineering issue. It does not implement, launch private local software, perform paid generation or merge code. The next implementation run must be bounded to this brief and collect evidence before calling the setup consistent and working.

Implementation discovery, October 7, 2026

The Human clarified that Hybrid is a deterministic connectivity harness, not an autonomous routing agent. It resolves the saved capability route, validates dependencies/readiness/consent, dispatches through the existing adapter and relays operational outcomes. Local/Cloud setup navigation must not change the global execution policy. Existing Story Mode navigation did change that policy; remove this side effect as part of AC05.

AC21. Relay per-profile bounded diagnostics showing selection, preflight, submission, polling, downloaded/saved output and failures. Keep readable history, exclude credentials/private prompts/story text, and expose refresh in Hybrid. A test must prove metadata isolation and that inspecting diagnostics causes no provider request.

Primary-source discovery: https://developers.openai.com/api/docs/deprecations confirms Videos/Sora removal on September 24, 2026. Existing OpenAI video routes must be unsupported. https://docs.comfy.org/development/cloud/overview describes the existing v1 Comfy Cloud API as deprecated, with v2 recommended for job execution. Current PlotPickle Comfy Cloud stores only a connection/catalog probe, with no imported generation workflow or execution adapter. Therefore represent it truthfully as connection configured / generation workflow required, never generation Ready. This is a registered setup dependency, not a fabricated executable route. API/MCP/CLI transport status is separate from capability proof; existing transport adapters remain the integration boundaries.

Live Windows provider execution remains an external product observation. Deterministic fixtures and local rendering cannot certify the user's installation or spend API credits on the user's behalf.

Engineering verification boundary

Hybrid relays profile-owned operational events for selection, preflight, submission, polling, saved output and failure. The relay accepts metadata only; it does not persist story text, provider responses or keys. Opening setup and completing tests do not select a route. Importing a replacement workflow invalidates its proof while retaining the selected route so Hybrid can report it as blocked.

Automated handler tests exercise actual authenticated gateways, encrypted storage and asset saving against bounded synthetic provider responses. Rendered proof exercises actual Settings components against synthetic readiness. These prove software dispatch and state contracts; they do not certify installed Windows custom-node compatibility, paid provider inference, or playable real video. Those remain UNPROVEN until the Human configures their resources and explicitly runs a generation test. Hosted ComfyUI Cloud generation remains unsupported until an executable workflow adapter is supplied and tested; a non-generative connection probe must never become a green generation badge.
