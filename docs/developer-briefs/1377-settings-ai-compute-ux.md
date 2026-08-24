# Developer Brief — Unified Local Compute / Cloud Compute Setup

## Objective
Redesign PlotPickle Settings so AI configuration begins with one simple question: **where should AI run?**

Expose two primary destinations:

- **Local Compute** — AI that runs on this PlotPickle Node.
- **Cloud Compute** — online AI services the Human explicitly connects.

Both destinations must use the **same shared interface architecture** and the same visual language. Each must expose three capability tabs:

- **Writing**
- **Images**
- **Video**

The difference between Local and Cloud is the provider/options shown inside the shared workspace, not a different UI system.

This is primarily an **experience and information-architecture repair**, not a provider-framework rewrite.

## Product goal
Make AI setup understandable to a first-time AI user without hiding the depth experienced users expect.

The normal/default view should answer:

1. What am I configuring?
2. What is PlotPickle currently using?
3. Is it working?
4. How do I change or test it?

Technical detail remains available through progressive disclosure such as **Advanced Options**. Do not create separate Beginner and Expert modes.

## Core mental model

```text
AI COMPUTE

LOCAL COMPUTE
Runs AI on this computer

CLOUD COMPUTE
Uses connected online AI services
```

Selecting either opens the same shell:

```text
LOCAL COMPUTE / CLOUD COMPUTE

WRITING | IMAGES | VIDEO

provider/status/setup/test/advanced options
```

The Human learns one interface once.

## Navigation / information architecture
Replace the current mixture of top-level concepts such as:

- Sage Setup
- PLAN Setup
- LLM Routing
- Images Setup
- Video Setup
- Ollama
- OpenAI Cloud
- MiniMax Cloud

with primary AI setup destinations:

```text
AI COMPUTE
  Local Compute
  Cloud Compute
```

Existing provider/routing capabilities are not removed. They move into the appropriate capability tab.

LLM Routing LOCAL/CLOUD must not become duplicate top-level settings. Routing belongs inside the relevant Writing / Images / Video compute context.

## Local Compute
Header language should be beginner-readable, for example:

> **LOCAL COMPUTE**  
> Run AI privately using this computer. No cloud account is required.

Tabs:

```text
WRITING | IMAGES | VIDEO
```

### Local Writing
Reuse the existing local text provider/runtime architecture. Present detected/recommended options first (for example Ollama), with real status and model information. Other supported local runtimes such as LM Studio, llama.cpp, or approved OpenAI-compatible local runtimes remain available where already supported.

Advanced controls may expose endpoint/model/context/routing details without forcing beginners to understand them.

### Local Images
Reuse existing ComfyUI/image-provider infrastructure. Show real readiness, current workflow/provider, configure/test actions, and advanced controls.

### Local Video
Use the same shell. Show only real supported local video options and truthful unavailable/setup-required states.

## Cloud Compute
Use the same shell and tabs:

```text
WRITING | IMAGES | VIDEO
```

Cloud tabs show only cloud-capable providers for that capability.

### Cloud authentication
Where supported by the existing provider/connector architecture, connection methods may include:

- OAuth / MCP OAuth
- API key

Present plain-language explanation first, technical terminology second. Credentials must remain in the existing protected credential architecture and must never be displayed after storage.

Do not make the Human configure the same provider three separate times if one authenticated connection supports Writing, Images and Video. Authentication belongs to the provider connection; capability selection belongs to the respective tab.

## Sage and PLAN
Sage and PLAN are consumers of Writing Compute, not providers.

Conceptually:

```text
LOCAL / CLOUD COMPUTE
        ↓
     WRITING
        ↓
 provider/model routing
        ↓
  SAGE / PLAN / AGENTS
```

Agent-specific personality/behavior settings can remain separate, but provider/model setup belongs to the shared Writing Compute system.

## Progressive disclosure
Do not create separate Beginner and Expert modes.

Default provider cards should show concise information such as:

- provider/runtime name
- READY / NOT CONNECTED / NEEDS SETUP / STARTING / UNAVAILABLE / ERROR
- current/recommended model or workflow
- Configure / Test / Change action
- Advanced Options disclosure

Advanced Options can expose the deeper controls already supported by the architecture, such as provider protocol, base URL, model ID, context window, endpoint, routing priority, fallback policy, capability mapping, MCP server, and authentication method.

## Shared visual system
Local Compute and Cloud Compute must use the same:

- header structure
- description hierarchy
- Writing / Images / Video tab bar
- provider cards
- readiness/status treatment
- setup/test actions
- advanced disclosure
- spacing and typography
- responsive behavior

Local vs Cloud should be distinguished primarily by title, explanatory copy, status/provider data, and connection methods — not by separate component families.

## Architecture constraints
Reuse existing provider, routing, credential, local-AI and cloud integration architecture.

Do **not** introduce:

- a second provider registry
- another local AI runtime
- another credential store
- another model-routing engine
- duplicated Local and Cloud implementations
- provider-specific Settings UIs scattered around the app

Prefer one shared component/data model shaped approximately like:

```text
ComputeWorkspace
  computeMode: local | cloud
  capability: writing | images | video

ProviderSetup
  status
  connection
  recommended configuration
  test
  advanced
```

Local and Cloud should be data/configuration variants of the same UI components.

## Truthfulness / trust rules
- No simulated READY/CONNECTED states.
- Tests must exercise the real existing provider/status boundary where available.
- Unsupported capabilities remain visibly unsupported/unavailable.
- Existing offline-first, local/cloud trust, credential and provider-routing boundaries remain unchanged.
- No silent paid-cloud fallback or provider promotion.

## Migration / compatibility
Existing working Ollama, ComfyUI, OpenAI, MiniMax and other supported configuration must present correctly in the new shared UI without forcing existing users to reconfigure everything.

## Acceptance criteria
1. Settings exposes **Local Compute** and **Cloud Compute** as the primary AI setup destinations.
2. Both use one shared visual/interaction architecture.
3. Both expose **Writing / Images / Video** tabs.
4. Local Compute shows only supported local options.
5. Cloud Compute shows only supported cloud options.
6. Cloud connections can present OAuth/MCP OAuth and/or API-key methods where the existing architecture supports them.
7. A beginner can configure the recommended provider without understanding endpoints, model APIs or routing tables.
8. Experienced users can expand Advanced Options to access supported technical configuration.
9. Existing Ollama, ComfyUI, OpenAI, MiniMax and other supported integrations are reused rather than duplicated.
10. Sage and PLAN continue consuming the shared Writing routing architecture.
11. Provider status is visible and understandable.
12. Each capability exposes an obvious real Test action where the existing architecture supports one.
13. No fake connected/ready/success states.
14. Existing credential, provider-routing, offline-first and local/cloud trust boundaries remain intact.
15. Responsive behavior preserves the same hierarchy.
16. Existing valid provider configuration is preserved/migrated in presentation.
17. Regression coverage protects the shared Local/Cloud workspace structure and existing provider contracts.

## UX success criterion
The system should feel **simpler without becoming less capable**:

```text
WHERE SHOULD AI RUN?

LOCAL             CLOUD
  ↓                 ↓
Writing           Writing
Images            Images
Video             Video
  ↓                 ↓
Choose/configure the provider
```

The beginner gets a clear path. The experienced user can still reach models, endpoints, authentication, MCP and routing when needed.
