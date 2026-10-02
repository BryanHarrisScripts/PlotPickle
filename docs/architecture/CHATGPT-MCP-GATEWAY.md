# ChatGPT-facing PlotPickle MCP gateway evaluation

Issue #2673 evaluates OpenAI MCP Extensions / ChatGPT plugin surfaces as a future structured interface to PlotPickle.

## Decision

**Prototype a read-only gateway. Do not make it a PlotPickle dependency.**

The first slice is a **PlotPickle Read-Only Navigator**: a remote MCP endpoint (or Secure MCP Tunnel for private/local development) exposing only governed read/search/fetch tools. A ChatGPT sidebar entry can open the navigator, and governed PlotPickle objects can become composer-mention candidates where that extension is supported.

The first slice deliberately has **no write/canon/repository/merge action**.

## Architecture boundary

```text
ChatGPT / plugin UI
        |
        v
PlotPickle ChatGPT MCP gateway
        |
        v
authorization + project/session boundary
        |
        v
PPF read model / governed resource projection
```

ChatGPT is an interface/client. PlotPickle/PPF remains the source of story truth.

This gateway is separate from `scripts/developer-agent-mcp.mjs`, which exists for DSDD/developer verification. ChatGPT-facing story access must not inherit developer build, UAT, shell, repository, or merge capabilities.

## Current platform facts used for the evaluation

OpenAI's current plugin/Apps SDK documentation describes MCP-backed ChatGPT integrations with optional UI and extension surfaces including global/thread sidebar entry points, composer mentions, file handlers, and richer forms.

The current documentation also states that ChatGPT connects to remote MCP servers rather than directly to arbitrary local MCP servers. Private/on-prem/local development can use Secure MCP Tunnel rather than publishing a local PlotPickle service to the public internet.

Availability varies by ChatGPT surface and plan, so PlotPickle must treat these entry points as optional presentation capabilities rather than architecture dependencies.

## Minimal prototype

The contract in `core/sidecars/chatgpt-mcp-gateway-contract.mjs` defines four read-only actions:

- list projects;
- search governed resources;
- fetch one governed resource;
- fetch a project summary.

Mentionable resource classes are:

- project;
- character;
- Story Block;
- Mini-Block;
- scene;
- developer brief.

Each resource keeps a PlotPickle-owned identity. A mention or fetched result is a reference/projection, not a duplicate canonical record inside ChatGPT.

## Extension surface evaluation

### Sidebar — prototype

A global sidebar entry is useful because it gives the Human one obvious way to browse PlotPickle projects and governed resources without exposing development controls.

### Composer mentions — prototype where supported

Composer mentions are a good fit for explicit resource selection: “use this Character,” “review this Block,” or “explain this developer brief.” Mention selection must resolve back to a PlotPickle-owned resource ID.

This is convenience, not authority transfer.

### File viewer/editor — defer

PlotPickle should not invent a file extension or expose arbitrary local files just to obtain a ChatGPT file viewer. A file handler can be reconsidered after PlotPickle has a separately governed portable project/resource file contract.

### Rich forms — defer write actions

Forms are potentially useful for structured Human input, but any form that writes story state needs:

1. explicit authenticated project/session identity;
2. a proposal vs canonical-write distinction;
3. Human confirmation;
4. deterministic PPF mutation rules;
5. audit/evidence;
6. no merge/repository authority.

That is a separate implementation phase.

## Authorization and privacy

Every request must be scoped to an authenticated actor/session and an authorized PlotPickle project.

The gateway must not expose:

- arbitrary filesystem reads;
- arbitrary repository reads/writes;
- shell commands;
- browser control;
- provider credential access;
- Human browser profiles;
- GitHub merge;
- DSDD PASS/FAIL authority;
- direct canon writes in the read-only prototype.

Private/local PlotPickle data must not be made public simply to satisfy a remote-MCP transport requirement.

## Browser automation comparison

Pi/browser automation remains useful for experiments, compatibility tests, or temporary workflows where there is no structured API.

It should **not** be the long-term integration path for core PlotPickle ↔ ChatGPT resource access because a structured MCP contract is narrower, auditable, schema-bound, and easier to authorize.

Browser automation remains experimental and never becomes canon, DSDD, or merge authority.

## Promotion rule

Production deployment, write actions, file handling, credentials, or remote hosting require a new governed issue.

A future implementation should start from the read-only contract, use standard MCP tools/resources first, and add ChatGPT-specific extension metadata only for UI capabilities that materially improve the Human experience.
