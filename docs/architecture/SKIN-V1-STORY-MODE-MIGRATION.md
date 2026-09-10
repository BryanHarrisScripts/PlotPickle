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

Cloud Story Mode mirrors Local Story Mode around three writer tasks:

- Writing
- Images
- Video

Its resource area owns provider-specific cloud authority and model configuration. The initial supported provider surfaces are OpenAI and MiniMax, with the existing Google Gemini writing setup reachable from the cloud writing route. Remote Compute remains an honest planned boundary.

OpenAI and MiniMax authority is saved for the authenticated Human profile through the dedicated `/api/cloud-story-mode/provider` boundary. Saving authority updates the modern writing-assistant and media-routing profile stores but does not run a paid provider request and does not activate a cloud route. Provider tests remain separate explicit actions.

## What stays outside Cloud Story Mode

Data stays separate because PPF files, backups, databases, retrieval and caches apply to both local and cloud workflows.

Deploy stays separate because builds, publishing and edge hosting are application delivery concerns rather than story-generation providers.

Repos stays separate because GitHub history, story proposals and protocol definitions are collaboration and source-control concerns.

Auth stays separate for account authorization, OAuth and the protected credential vault. Provider-specific API authority belongs inside Cloud Story Mode so the writer can configure a cloud provider in one place without duplicating OpenAI or MiniMax keys in the Settings navigation.

Agents stays separate because tool execution, Buzz runtime, worktrees and reasoning loops can use either local or cloud compute.

Open Source stays separate because packages, licences, model formats and evaluation tools describe the installed ecosystem rather than an active cloud account.

## Migration rule

Only one new Settings system is opened at a time. Cloud Story Mode is the first connected tertiary system. Data, Deploy, Repos, Auth, Agents and Open Source remain visible but disabled in the Skin V1 directory until each is reviewed and migrated. A new Skin V1 surface must not route through `LegacySettingsPanel` or the legacy `/api/local-ai/connection` provider boundary.

Legacy `ai-connection.json` remains readable for one-time migration, but once a modern writing or media provider profile exists it must never overwrite the newer Story Mode configuration.
