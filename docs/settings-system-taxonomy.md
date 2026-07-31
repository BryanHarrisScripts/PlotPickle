# Settings system taxonomy

## Product decision

PlotPickle Settings uses stable, supportable system names instead of marketing-style integration labels.

Workspace remains the home for personal application preferences:

- General
- Appearance & Accessibility
- Project Defaults

Every configurable, installable or supportable technology is organized under one Systems group with eight primary bins:

1. Local
2. Cloud
3. Data
4. Deploy
5. Repos
6. Auth
7. Agents
8. Open Source

These names are the canonical help terms used by the interface, tests and support documentation.

## Interaction contract

- Each system bin expands into a task-specific submenu.
- Every submenu item has one clear title, one plain-language description and one availability state.
- Configure items open an existing working Settings surface.
- Separate workspaces, including Buzz, route to their dedicated Settings page.
- Planned items explain their intended scope without displaying fake controls or implying that an API is active.
- Reference items document installed packages, formats or licence boundaries without pretending that they require credentials.
- The previous Settings implementation remains the configuration engine behind the new taxonomy so existing connection, storage, permission and recovery behaviour is preserved.

## Availability language

The only menu states are:

- Installed
- Configure
- Optional
- Planned
- Reference

A system is never shown as connected, ready or installed unless the underlying runtime or connection status establishes that state.

## Mechanics placement

The architecture terms supplied for planning are placed in their logical homes:

- Prompting, tokens and model formats: Local or Cloud model configuration.
- RAG, embeddings and vector stores: Data.
- Streaming and structured outputs: Deploy.
- MCP server definitions: Repos.
- OAuth, API keys, encrypted credentials and human approval gates: Auth.
- ReAct loops, function calling, tool execution and MCP clients: Agents.
- Guardrails, evaluations, model hubs and public packages: Open Source.

## Diagnostics integration

- The taxonomy JSON is the required owner of the Settings navigation contract.
- Taxonomy styles, documentation and regression tests are mapped to the Settings diagnostics area and its focused suite.
- The deterministic Windows smoke waits for the hydrated Repos control to expand before selecting GitHub Story Repository, avoiding a pre-hydration click race.

## Scope boundary

This change is information architecture and navigation. It does not install Buzz, Docker, ComfyUI, models, cloud APIs, vector databases, deployment targets or agent runtimes. It creates the stable bins needed to plan and support those systems deliberately.
