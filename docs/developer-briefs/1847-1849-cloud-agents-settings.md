# Developer Brief: Cloud Story Mode, PlotPickle Agent Compute, and Skin V1 Settings

Issues: #1847, #1848, #1849

## Current state

Skin V1 already owns the Dashboard and opens a Settings directory. Cloud Story Mode already uses the modern writing/media provider stores and AI routing, but its task/resource menu was incomplete: it exposed Writing, Images and Video, still advertised a generic Remote Compute resource, and reused the generic routing panel including the old Active Source summary. Only Cloud Story Mode was connected from the Skin V1 Settings directory.

PlotPickle's embedded Mastra Agents already execute through `/api/writing-assistant/chat`. Provider/model configuration already belongs to Local Story Mode or Cloud Story Mode, and the writing provider store already knows Local Runtime, Ollama, OpenAI, MiniMax and Gemini. BUZZ-managed Agent runtime/provider/model settings are a separate ownership domain and must stay outside this work.

## Goal

Make the visible product match the approved architecture:

1. Cloud Story Mode supplies truthful cloud resources by capability.
2. PlotPickle Agents assign already-configured text compute through one default plus optional per-Agent overrides.
3. Skin V1 Settings looks and behaves like the Dashboard, including keyboard-first navigation and the same typography/design-token contract.

## Exact product decisions

### Cloud Story Mode

Cloud Resources contains OpenAI, MiniMax and Google Gemini. Do not show a generic Remote Compute entry.

Tasks contains Writing, Images, Video and Agents.

Provider capability truth is currently:

- OpenAI: Writing, Images, Agents/text.
- MiniMax: Writing, Images, Video, Agents/text.
- Google Gemini: Writing and Agents/text through the current Gemini writing adapter.

The OpenAI/MiniMax live model-catalog endpoint remains the catalog source where supported. Agent model browsing maps to the text/writing catalog because PlotPickle Agents consume text compute. Gemini stays visible through its real provider setup/routing path rather than pretending the OpenAI/MiniMax catalog supports it.

No Sora-specific route is restored. No legacy Settings fallback is restored. Saving provider authority does not run a paid generation or activate a cloud route.

### PlotPickle Agents

This is not BUZZ configuration.

Local Story Mode and Cloud Story Mode own provider connection/model setup. Settings / Agents assigns those resources to PlotPickle embedded Mastra Agents.

The assignment contract is:

- one global default;
- default may follow the active Story Mode writing route or pin a ready provider;
- each supported embedded PlotPickle Agent may inherit Default or pin a ready provider;
- the model displayed for an assignment is the model currently supplied by that provider/Story Mode resource;
- a fixed provider that becomes unavailable must fail visibly; it must not silently fall through to another local or paid cloud provider;
- a task-level explicit provider already supplied by an existing caller remains an explicit request override for backward compatibility;
- Agent compute choice does not grant tools, credentials, canon authority, GitHub authority, or provider-selection authority to the Agent itself.

Persist the Human's assignment in protected local application data using the existing local credential JSON boundary. Do not put Agent compute assignment in PPF canon or BUZZ memory.

### Settings

The first Skin V1 Settings directory must expose these named destinations as real keyboard rows:

- General
- Appearance & Accessibility
- Project Defaults
- Cloud Story Mode
- Data
- Deploy
- Repos
- Auth
- Agents
- Open Source

Workspace/System headings may remain as visual grouping only. Cloud Story Mode and Agents are connected in this slice. The other rows remain visible, selectable and truthfully marked Not Connected; they are not disabled/hidden placeholders.

Keyboard contract:

- Up/Down changes the selected row.
- Home/End move to first/last.
- Enter/Space activates the selected row.
- The displayed single-key shortcut selects/activates that destination.
- Escape returns to the parent Settings/Dashboard surface.

Skin V1 Settings must inherit the canonical `--pp-skin-*` typography, spacing, border, status-box and command-line row treatment already used by Dashboard. Do not create a second local theme.

## Implementation ownership

- `app/skin-v1/dashboard-bbs-panel.tsx`: Settings directory, shortcuts, selection, Cloud/Agents entry points.
- `app/skin-v1/cloud-story-mode-host.tsx`: task/resource directory and Cloud task presentation.
- `app/settings/compute/cloud-model-catalog-panel.tsx`: capability-filtered OpenAI/MiniMax model browsing.
- `app/skin-v1/plotpickle-agents-host.tsx`: Human-facing PlotPickle Agent default/override assignment.
- `build/agent-compute-store.ts`: protected local assignment persistence and deterministic resolution.
- `build/agent-compute-gateway.ts`: loopback/same-origin assignment status and mutations; excludes BUZZ-managed Agents.
- `build/writing-assistant-gateway.ts`: applies the resolved PlotPickle Agent assignment at execution time and reports failures without silent fallback.
- `build/local-ai-gateway.ts`: registers the Agent compute gateway before the writing gateway.

## Tests/checks

Focused source/contract tests must prove:

- Cloud task/resource names and provider capability filtering.
- Remote Compute and deprecated Sora paths are absent from the Skin V1 Cloud Story Mode menu.
- Settings rows expose stable shortcuts and no longer disable all non-Cloud destinations.
- Cloud Story Mode and PlotPickle Agents are the connected Settings destinations in this slice.
- Agent assignment storage supports Default and per-Agent Override.
- only embedded PlotPickle Mastra Agents are assignable; BUZZ-managed Agent provider/model ownership is untouched.
- writing execution resolves the Agent assignment and emits an explicit no-fallback error when a pinned provider is unavailable.
- existing loopback/same-origin and credential boundaries remain in place.

Then run the repository's normal production build and required GitHub CI gates. Fix only failures caused by this slice. Merge only after required checks are green.

## Do not change

Do not change PPF/canon semantics, story creative authority, BUZZ identity/room/presence/private-key ownership, Local Story Mode runtime installation, provider credential storage format, unrelated Settings systems, or unrelated Dashboard navigation.
