# Developer Brief — #1901 Local / Cloud Story Mode Capabilities & Connections

## Summary

Rebuild the Local Story Mode and Cloud Story Mode setup experience as deliberate twins. They should use the same mental model, same capability order, same connection-row geometry, same readiness vocabulary, and equivalent connection positions. They fork only where local versus remote/cloud behavior actually differs.

This brief captures the product discussion that led to #1901. The problem is not merely typography or labels: the current capability pages expose too much duplicated setup/routing UI, mix local and cloud context, and use category names (`Providers`, `Engines`, `Cloud Resources`) that are not truthful for a mixed list of API providers, runtimes, workflows and model plug-ins.

## User expectation

When a Human enters **Options & Settings → Local Story Mode** or **Cloud Story Mode**, they should immediately understand two questions:

1. **CAPABILITIES — What do you want PlotPickle to do?**
2. **CONNECTIONS — What system should PlotPickle use to do it?**

The Human should not need to understand PlotPickle's internal routing architecture, distinguish a runtime from a provider, or scroll through repeated cards to discover whether a connection is set up.

## Canonical twin structure

Both Story Modes expose the same capability list in the same order:

1. Writing
2. Images
3. Video
4. Agents

Both Story Modes then expose a `CONNECTIONS` group. Do not use `Providers`, `Engines`, `Cloud Resources`, or `Tasks` for this navigation contract.

Comparable entries occupy the same visual position so the two menus can be scanned as twins:

| Position | Local Story Mode | Cloud Story Mode |
| ---: | --- | --- |
| 1 | Ollama | OpenAI |
| 2 | ComfyUI | ComfyUI |
| 3 | LTX-Video | Gemini |
| 4 | MiniMax H3 | MiniMax |

The ordering is intentional:

- ComfyUI is slot 2 on both screens.
- The MiniMax family is slot 4 on both screens.
- Local uses the model/workflow name **MiniMax H3** because it is the reviewed local video plug-in.
- Cloud uses **MiniMax** because the connection is the user's MiniMax API account.

## Naming rule

Visible navigation uses the actual service/runtime/workflow name the Human is connecting to:

### Local
- Ollama
- ComfyUI
- LTX-Video
- MiniMax H3

### Cloud
- OpenAI
- ComfyUI
- Gemini
- MiniMax

`OpenAI` must remain **OpenAI**, not `ChatGPT`, because this surface configures an OpenAI API connection. A ChatGPT subscription and an OpenAI API account are separate relationships.

Visible navigation uses **Gemini**. Detailed setup/help copy may explain that this is the **Google Gemini API** / **Google AI connection**.

## Clear connection explanations

The capability surface must explain each compatible connection in plain language. Do not reuse Gemini wording for unrelated products.

### Local Story Mode

**Ollama — Local writing and Agent models**

Runs AI text models on this computer. Used for Writing, PLAN, Sage and supported Agents. No cloud API account or per-request provider charge is required.

**ComfyUI — Local image and video workflow engine**

Runs visual-generation workflows on this computer using the available GPU. PlotPickle uses ComfyUI underneath supported local image and video tools.

**LTX-Video — Local video-generation workflow**

Used for local motion, Previs and video generation. LTX-Video runs through the local ComfyUI workflow and does not contact a cloud video provider.

**MiniMax H3 — Advanced local text-to-video workflow**

PlotPickle uses H3 locally for its constrained text-to-video path with ComfyUI as the runtime underneath. It is separate from the MiniMax cloud API.

### Cloud Story Mode

**OpenAI — OpenAI API connection**

Uses the Human's OpenAI API credential for supported cloud Writing, Images and Agent work. API requests may incur provider charges. Do not describe the connection as ChatGPT.

**ComfyUI — Remote ComfyUI workflow connection**

Connects to supported ComfyUI workflows running away from this computer for compatible remote/cloud image and video production.

**Gemini — Google Gemini API connection**

Uses the Human's Google Gemini API credential for supported cloud Writing and Agent text work.

**MiniMax — MiniMax cloud API connection**

Uses the Human's MiniMax API credential for supported cloud Writing, Images, Video and Agent text work. This is intentionally distinct from local MiniMax H3.

## Capability-page interaction contract

A capability page is a **single compact setup surface**. It must not stack a model-catalog surface on top of a full routing surface and then repeat setup links again below.

Each compatible connection row shows:

- connection name;
- one-line/plain-language role;
- readiness state;
- current model/workflow when the existing status contract exposes one;
- whether this connection is currently active for the capability;
- one setup/model action;
- one `Use for <Capability>` action only when the existing routing authority supports direct selection and the connection is ready.

The capability surface consumes existing status/routing APIs. It does not create a second provider registry or store credentials itself.

### Canonical readiness language

- **Ready** — configured and successfully tested/verified.
- **Needs test** — configured but verification is missing/stale.
- **Set up** — not configured.
- **Error** — configured but the existing status contract reports failure.

`Active` is a separate small state on a ready row; do not build another `Active source: LOCAL/CLOUD` card.

## Cloud capability fork

The first actionable item on a Cloud capability page is the acknowledgement:

> I understand remote provider API requests may incur charges.

A cloud route cannot become active without the existing billing acknowledgement. This change must preserve the existing no-silent-paid-work boundary.

For cloud Video, preserve the existing extra data-sharing acknowledgement where a prompt/reference may leave this computer.

The Cloud capability page must not display `Active source: LOCAL`, local routing cards, local engines, or any opposite-locality status summary.

## Local capability fork

The Local capability page starts with the boundary:

> Runs on this computer · no cloud provider charges.

It contains no paid-provider consent and no cloud/opposite-locality summary.

Local video selection remains hardware-aware. The compact Video capability view may report ComfyUI runtime status plus LTX-Video / MiniMax H3 plug-in status, but must not invent a manual model-selection authority that the current local plug-in registry does not provide.

## What is removed from capability pages

Remove/consolidate these current surfaces from the Local/Cloud capability views:

- `Cloud model catalog` as a separate top-level card;
- `Choose a model after you connect the provider.` as a second nested surface title;
- `Refresh current configuration` as a primary capability-page action;
- `Current configuration` / `Active source: LOCAL/CLOUD` summary blocks;
- opposite-locality route information;
- duplicated provider setup links repeated at the bottom;
- full provider credential forms embedded in every capability.

Detailed provider/runtime setup remains owned by the dedicated Connection pages.

## Dedicated connection pages remain

The directory still provides direct access to the detailed connection pages:

### Local
- Ollama → existing local runtime/model setup
- ComfyUI → existing local ComfyUI setup
- LTX-Video → existing LTX workflow setup
- MiniMax H3 → existing H3 advanced local setup

### Cloud
- OpenAI → existing protected OpenAI API authority/model setup
- ComfyUI → existing Comfy Cloud connection/execution policy
- Gemini → existing Google Gemini API setup
- MiniMax → existing protected MiniMax API authority/model setup

A compact capability row's setup/change-model action should navigate to these existing owners rather than duplicating the forms.

## Capability compatibility

Preserve the currently supported capability boundaries rather than inventing new provider capabilities:

- Local Ollama: Writing + Agents/text.
- Local ComfyUI: Images and the runtime beneath local Video workflows.
- Local LTX-Video: Video.
- Local MiniMax H3: advanced Video.
- Cloud OpenAI: Writing, Images, Agents/text on this Story Mode surface.
- Cloud Gemini: Writing, Agents/text.
- Cloud MiniMax: Writing, Images, Video, Agents/text.
- Cloud ComfyUI: supported remote image/video workflows.

## Skin V1 and navigation

- Preserve Skin V1 tokens, typography and Title Case menu-item rules.
- Group headings remain chrome and may use uppercase `CAPABILITIES` / `CONNECTIONS`.
- Preserve mouse, arrow-key, Home/End, letter shortcut, Enter and Space navigation.
- Do not lock visual baselines in this issue.
- Do not replace the current stable Story Mode routes/IDs unnecessarily.

## Authority and safety boundaries

- Preserve existing protected credential storage.
- No API key is rendered back from storage.
- No silent provider test or generation occurs merely by opening a capability page.
- No local failure silently promotes work to cloud.
- No paid cloud route is selected without explicit acknowledgement.
- The PPF/canon authority is unchanged.
- Provider/runtime IDs remain existing IDs; this is a presentation and interaction consolidation, not a second AI routing architecture.

## Implementation shape

Prefer one shared Skin V1 compact capability/connection presentation component consumed by both Story Modes. This is how visual symmetry and vocabulary should remain aligned.

The Local and Cloud hosts remain responsible for translating their existing status sources into that shared presentation:

- `/api/ai-routing/status` for routable capability/provider readiness;
- existing local media/video status for ComfyUI and hardware-aware video plug-ins;
- existing Comfy Cloud status for remote ComfyUI readiness;
- existing dedicated setup pages for detailed configuration/testing.

## Regression requirements

Add a focused #1901 regression that proves:

1. both directories use `CAPABILITIES` then `CONNECTIONS`;
2. both capability lists are Writing / Images / Video / Agents;
3. Local connection order is Ollama / ComfyUI / LTX-Video / MiniMax H3;
4. Cloud connection order is OpenAI / ComfyUI / Gemini / MiniMax;
5. ComfyUI is slot 2 on both and MiniMax family is slot 4 on both;
6. capability views use the shared compact connection component;
7. Cloud capability view places billing acknowledgement before connection rows;
8. Local capability view declares no-cloud-charge local boundary and no cloud consent;
9. the Cloud host no longer mounts `CloudModelCatalogPanel` or `AiRoutingPanel` for capability views;
10. the Local host no longer mounts the full `AiRoutingPanel` / `LocalVideoPanel` / `LocalComfyUiPanel` as capability views;
11. detailed setup pages remain mounted for their Connection views;
12. legacy phrases `PROVIDERS`, `ENGINES`, `CLOUD RESOURCES`, `Active source:` and `Refresh current configuration` do not define the new Story Mode capability UI.

## Completion

This issue uses the canonical PlotPickle Development Loop. Before merge:

- the #1901 convergence manifest must report `CONVERGED`;
- focused regressions must pass;
- existing Skin/Story Mode regressions must remain green;
- PR Gate must be green;
- Product Gate / Windows focused UAT and production build must be green;
- merge only the exact tested head.
