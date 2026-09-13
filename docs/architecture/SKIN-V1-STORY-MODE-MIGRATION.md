# Skin V1 Story Mode migration

## Product decision

Skin V1 separates story compute from advanced technical settings.

User Profile owns Human identity. Local Story Mode and Cloud Story Mode own provider/model setup where that compute is actually used. Node Info owns the local PlotPickle Node. Agents assigns available story-compute resources to PlotPickle Agents.

Local Story Mode is the user-facing name for the proven local writing, image and video configuration currently implemented by the local AI host. Internal `local-ai` route and data identifiers remain stable during the migration so working local runtime, Ollama, ComfyUI, LTX-Video and H3 contracts do not regress.

Under issue #2016, Options & Settings no longer preserves DATA / DEPLOY / REPOS / AUTH / OPEN SOURCE as separate Human-facing taxonomy bins. The Skin V1 SYSTEMS directory is:

1. Node Info
2. Local Story Mode
3. Cloud Story Mode
4. Agents
5. Advanced

The older shared taxonomy remains compatibility input for legacy callers and diagnostics; it is not product truth for the Skin V1 menu.

## Cloud Story Mode

Cloud Story Mode mirrors Local Story Mode around four task views:

- Writing
- Images
- Video
- Agents

Its resource area owns provider-specific cloud authority and model configuration. The supported Cloud Resources are OpenAI, MiniMax and Google Gemini. There is no generic Remote Compute placeholder in the primary Skin V1 directory.

Capability truth follows the working adapters rather than a marketing list:

- OpenAI supplies Writing, Images and Agent text compute.
- MiniMax supplies Writing, Images, Video and Agent text compute.
- Google Gemini supplies Writing and Agent text compute through the current Gemini writing adapter.

The OpenAI/MiniMax provider model catalog is filtered by the selected task. Agent model browsing maps to the text/writing catalog because PlotPickle Agents consume text compute. Gemini remains available through its actual provider setup/routing implementation instead of pretending that it supports the OpenAI/MiniMax catalog API.

OpenAI and MiniMax authority is saved for the authenticated Human profile through the dedicated `/api/cloud-story-mode/provider` boundary. Saving authority updates the modern writing-assistant and media-routing profile stores but does not run a paid provider request and does not activate a cloud route. Provider tests remain separate explicit actions. Deprecated Sora-specific routing is not restored.

## PlotPickle Agent compute

Agents remains a separate PlotPickle Agent compute assignment surface.

Local Story Mode and Cloud Story Mode supply provider/model resources. Settings / Agents assigns those resources to PlotPickle-owned embedded Mastra Agents with one global default plus optional per-Agent overrides. The provider's currently configured model remains owned by its Story Mode/provider setup; the Agent assignment points at that provider/model resource rather than creating a competing model store.

A fixed default or per-Agent override must fail visibly if its provider becomes unavailable. It must never silently fall through to another provider or to paid cloud compute. The assignment is persisted in protected local application data and does not become PPF canon.

BUZZ-managed Agent provider/model/runtime settings remain BUZZ-owned. The PlotPickle Agent compute surface does not edit BUZZ identity, rooms, keys, memory, presence or ACP runtime configuration.

## Advanced

Advanced consolidates the useful technical material that previously appeared under DATA / DEPLOY / REPOS / AUTH.

Human-facing content retained in Advanced:

- Project Data & Recovery: project files, backups, recovery, private project search, media/preview cache and the hard canonical-versus-derived safety boundary.
- Tools & MCP: reviewed MCP server definitions, client-host/tool protocol references and diagnostics. Do not expose configuration controls until a supported Human action exists.
- PlotPickle Source: direct reference to the current PlotPickle source repository for support, source and release context.
- Technical Diagnostics: database/schema/migration details, search/index implementation, build/runtime evidence, edge/deployment evidence when troubleshooting, and credential-storage protection diagnostics.

What does not survive as a normal Settings control:

- DEPLOY: no ordinary Human action exists today for Vite builds, Cloudflare/edge bindings or publishing pipelines. These remain diagnostic evidence unless PlotPickle later ships an explicit Human deployment workflow.
- REPOS: story GitHub authorization/collaboration belongs with the task that uses it; PlotPickle source is reference-only; Afterglow recovery belongs with project data/recovery; MCP belongs in Advanced.
- AUTH: provider API keys remain in Local Story Mode or Cloud Story Mode. Advanced must not recreate duplicate API-key setup. Credential protection may appear only as diagnostics/safety evidence.

## Open Source

Open Source is no longer a Settings SYSTEMS row. It is a connected Dashboard destination under PROJECT MANAGEMENT, directly below User Profile.

Open Source opens the canonical `/legal` licensing/ownership surface. That surface is the authority for current licence scope:

- PlotPickle software: AGPL-3.0-or-later.
- 24 Blocks method and reusable non-software instructional/documentation material: CC BY-SA 4.0 where identified.
- Third-party material remains under its own licences/notices.
- Human-created stories and project files remain the Human's work; PlotPickle's software licences do not automatically apply to creative output.

The licensing surface returns to Dashboard, not Settings.

## Settings directory rule

Skin V1 Settings remains a keyboard-first directory using the same typography/design-token contract as Dashboard. General, Appearance & Accessibility and Project Defaults remain workspace entries. SYSTEMS exposes Node Info, Local Story Mode, Cloud Story Mode, Agents and Advanced.

Advanced remains yellow and openable while Human review is active. Yellow means testable/in review, not disabled. Interior Advanced content remains canonical monochrome Skin V1. Promote Advanced to green only after focused tests and visible Human acceptance.

A connected Skin V1 surface must not route through `LegacySettingsPanel` or the legacy `/api/local-ai/connection` provider boundary.

Legacy `ai-connection.json` remains readable for one-time migration, but once a modern writing or media provider profile exists it must never overwrite the newer Story Mode configuration.
