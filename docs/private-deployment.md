# Private deployment and local-first trust model

PlotPickle is designed to keep the writer's project local by default. Deployment choices must not imply that a feature is remote-safe or cloud-hosted merely because the web UI can be served from another machine.

## Current supported shape

### Local desktop / same-machine server

This is the primary trusted deployment shape today:

- PlotPickle UI and Vite server run on the writer's machine.
- Project state remains in the local browser/project folders/portable PPF files.
- Protected credentials use the local OS credential boundary.
- Responsibility Run, Verification, backup and other sensitive local APIs enforce loopback-local access.
- Local AI/ComfyUI/companion applications are reached as explicit local capabilities.
- BYOK cloud providers are optional and only used when explicitly configured/allowed; a local failure must not silently become paid cloud usage.
- BUZZ is a separate application/runtime with its own identity, memory, relay and runtime configuration.

This is the configuration against which the local safety boundaries and focused CI contracts are written.

### Private LAN/server hosting

PlotPickle's UI can technically be served by a host reachable on a private network, but **the current sensitive local gateways are intentionally loopback-only**. Therefore, moving the UI/server to another machine does not automatically make local credentials, Responsibility Run storage, backups, BUZZ integration or local companion applications available remotely.

A real private-server deployment must explicitly redesign/proxy/authenticate those local-only services. Do not open the existing loopback gateways to a LAN or the public Internet as a shortcut.

### Optional cloud/BYOK model calls

Cloud model access is not a deployment requirement. When explicitly enabled:

- credentials remain in the protected local credential store;
- connector/egress policy must permit the outbound provider host;
- the Run has a non-zero cloud budget/approval where required;
- telemetry labels the route as `cloud-byok` and cost precision as exact/estimated/unknown based on available provider data;
- provider failure/circuit state does not authorize a different paid provider automatically.

The PlotPickle web application itself does not need to become a public cloud service simply because a writer uses a BYOK model.

## BUZZ remains a separate trust domain

BUZZ may host persistent agents and provides its own:

- cryptographic identities;
- agent/team instructions;
- encrypted core/cold memory;
- ACP harness/provider/model/effort;
- respond-to and social permissions;
- BUZZ workspace/nest/lifecycle;
- relay/channel history.

PlotPickle does not claim those stores as PlotPickle project data. BUZZ-sourced content enters PlotPickle through the connector/Context trust boundary and does not become PPF canon simply because it is signed or came from an owned BUZZ agent.

Normal PlotPickle project backup excludes BUZZ private data. BUZZ data should use BUZZ-native backup/export support rather than being copied by PlotPickle.

## Developer/repair deployment boundary

Repository repair agents, Codex/Claude/Goose/other developer harnesses and future sandboxed code agents live in the developer authority plane, not the product-agent plane.

A developer worker may receive repository/worktree authority only through an explicit developer workflow. It still cannot grant itself story-canon authority or override deterministic verification. A repair requires a fresh authoritative rerun.

A future NOOA/Python specialist, if adopted, should run in an isolated sandbox and enter PlotPickle through the same Agent Contract, connector policy, Responsibility Run, telemetry and proposal boundaries. It is not part of the current production runtime.

## Production now vs target wiring

**Implemented now:**

- Mastra embedded product agents and local-AI routing;
- BUZZ integration and Playhouse/Connected Studios federation primitives;
- Agent Contracts v2;
- Context Engine;
- revision-aware PPF proposal/history boundary;
- connector/egress trust policy primitives;
- Responsibility Runs and local Run Activity;
- Responsibility Graph primitives;
- safe Run telemetry, provider adapters/health and portability eval primitives;
- local backup/restore/retention controls.

**Target adoption:** progressively move older agent/model/tool paths through the complete Responsibility Run -> Context -> connector policy -> provider adapter -> structured output -> verification/writer -> PPF revision sequence and emit the corresponding structured Run events. The target diagram is a migration goal, not a claim that every historical path already uses every layer.

## Do not deploy by assumption

Before exposing PlotPickle beyond the same machine, review:

- which APIs are loopback-only;
- where credentials live;
- whether any companion runtime accepts unauthenticated network traffic;
- whether local project/backup folders are protected by OS account permissions;
- what outbound provider/BUZZ/Playhouse destinations are explicitly permitted;
- whether TLS and user authentication exist at the new ingress;
- whether the threat model includes other LAN users or Internet clients.

No README or diagram should label an unverified localhost-only capability as cloud-ready, multi-user-ready or Internet-safe.
