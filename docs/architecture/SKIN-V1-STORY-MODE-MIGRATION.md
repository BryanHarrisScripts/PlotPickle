# Skin V1 Story Mode migration

## Product decision

Skin V1 separates story compute from the remaining system settings.

User Profile owns the computer-local story stack:

- Profile
- Local Story Mode
- Node

Local Story Mode is the user-facing name for the proven local writing, image and video configuration currently implemented by the local AI host. Internal `local-ai` route and data identifiers remain stable during the migration so working local runtime, Ollama, ComfyUI, LTX-Video and H3 contracts do not regress.

Options & Settings exposes the newer system directory as:

1. Cloud Story Mode
2. Data
3. Deploy
4. Repos
5. Auth
6. Agents
7. Open Source

The old `Local` system bin is hidden from the Skin V1 directory. The older shared taxonomy still contains that bin temporarily because legacy Settings callers use its Ollama and ComfyUI target mappings. That compatibility data is migration input only; Skin V1 does not open the older Settings surface for Local Story Mode or Cloud Story Mode.

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

Agents is now connected as a separate PlotPickle Agent compute assignment surface.

Local Story Mode and Cloud Story Mode supply provider/model resources. Settings / Agents assigns those resources to PlotPickle-owned embedded Mastra Agents with one global default plus optional per-Agent overrides. The provider's currently configured model remains owned by its Story Mode/provider setup; the Agent assignment points at that provider/model resource rather than creating a competing model store.

A fixed default or per-Agent override must fail visibly if its provider becomes unavailable. It must never silently fall through to another provider or to paid cloud compute. The assignment is persisted in protected local application data and does not become PPF canon.

BUZZ-managed Agent provider/model/runtime settings remain BUZZ-owned. The PlotPickle Agent compute surface filters those Agents out and does not edit BUZZ identity, rooms, keys, memory, presence or ACP runtime configuration.

## What stays outside Cloud Story Mode

Data stays separate because PPF files, backups, databases, retrieval and caches apply to both local and cloud workflows.

Deploy stays separate because builds, publishing and edge hosting are application delivery concerns rather than story-generation providers.

Repos stays separate because GitHub history, story proposals and protocol definitions are collaboration and source-control concerns.

Auth stays separate for account authorization, OAuth and the protected credential vault. Provider-specific API authority belongs inside Cloud Story Mode so the writer can configure a cloud provider in one place without duplicating provider keys in the Settings navigation.

Open Source stays separate because packages, licences, model formats and evaluation tools describe the installed ecosystem rather than an active cloud account.

## Settings directory rule

Skin V1 Settings is a keyboard-first directory using the same typography/design-token contract as Dashboard. General, Appearance & Accessibility, Project Defaults, Cloud Story Mode, Data, Deploy, Repos, Auth, Agents and Open Source remain visible as named rows. Cloud Story Mode and Agents are connected in this slice. The other destinations remain selectable and visibly marked Not Connected rather than disabled or hidden.

A new connected Skin V1 surface must not route through `LegacySettingsPanel` or the legacy `/api/local-ai/connection` provider boundary.

Legacy `ai-connection.json` remains readable for one-time migration, but once a modern writing or media provider profile exists it must never overwrite the newer Story Mode configuration.
