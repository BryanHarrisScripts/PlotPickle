# PlotPickle Node Topology

PlotPickle is local-first today, but its application boundary is intentionally server-based/client-capable. The node-topology contract gives that boundary a stable vocabulary without pretending that the current local Studio is already a hardened public multi-user service.

## Canonical Node definition

A **PlotPickle Node is one uniquely identified PlotPickle installation/device**.

The Node is the installation/runtime identity itself. It is not the Steward, it is not a model/runtime, and it is not a special compute class. Each installation owns one durable `node_id` and one independent local signing keypair. A Person/account may authorize many Nodes, but each Node remains independently identifiable and revocable.

Conceptually:

```text
Machine
  -> PlotPickle installation
     -> PlotPickle Node
        - durable node_id + local signing key
        - Steward + local agents/services
        - local PPF/projects
        - hardware/runtime/provider capabilities
        - readiness/health evidence
        - BUZZ connection when available
```

The existing immutable `pp_studio_XXXXXXXX` identity and Ed25519 key from the Studio-identity architecture remain valid Node identity/key material for upgraded installations. Normal upgrades, restarts, hardware changes and role changes must not silently regenerate them.

A second installation/device gets a different Node identity and private key even when both Nodes belong to the same Person/account.

## Human, Node and Agent identities stay separate

PlotPickle uses three distinct identity layers that must never silently substitute for one another:

1. **Human / Avatar identity** — the writer/person represented in Community.
2. **Node identity** — the specific PlotPickle installation/device signing and sending work.
3. **Agent / Steward identity** — Sage, BEN, Pi, Merrin, the local Steward and other helpers operating inside or through a Node.

A display label, hostname, Steward name, model name, provider account or relay name is not `node_id`.

The **Steward is the local caretaker inside a Node**. It may monitor health, coordinate recovery, explain system state and help operate the installation, but Steward identity does not replace Node identity and does not gain authority merely by operating locally.

## One product, several operational roles

Every PlotPickle installation is the same Node identity concept. Terms such as `desktop`, `studio-host`, `compute` and `hybrid` describe the Node's current topology/operational role; they are not different identity classes.

| Mode | Intended shape | Current status |
| --- | --- | --- |
| `desktop` | Client + local host + optional compute on one computer | Current default |
| `studio-host` | Authenticated HTTPS PlotPickle host for approved browser/desktop clients | Contract only; not enabled yet |
| `compute` | Text/image/video/retrieval capability for an approved PlotPickle host | Routing primitive only; registration/handshake is follow-on work |
| `hybrid` | Host + high-capacity compute on one workstation/server | Contract only; useful for systems such as a unified-memory AI workstation |

Changing a Node from desktop-only to host, compute or hybrid operation does not create a new Node identity. The mode does not grant authority. A compute-capable Node can be powerful without owning projects, credentials, canon or code.

Compute is an optional capability/role of a Node, not a separate identity class.

## BUZZ is the Node communications and coordination fabric

BUZZ is the trusted communications/coordination fabric connecting PlotPickle Nodes, humans and agents.

BUZZ can carry signed provenance, presence, Community/BBS events, agent coordination, health/evidence signals and future bounded inter-Node work contracts. The Node signature establishes which authorized installation sent an event; human/Avatar and Agent identities remain separately attributable according to their own contracts.

BUZZ does **not** create the local Node's authority and it does not make a local PlotPickle installation dependent on remote connectivity. When BUZZ is offline, the Node remains a Node and local writing, PPF access, local AI, local agents and local recovery continue according to their own readiness. BUZZ-dependent Community, federation and remote-presence features must instead report unavailable/degraded truthfully.

Remote Node discovery/presence must flow through the supported BUZZ federation/presence boundary rather than inventing a second PlotPickle social directory.

## Capabilities

The first capability vocabulary is deliberately product-level rather than runtime-specific:

- `client`
- `host`
- `text`
- `vision`
- `image`
- `video`
- `retrieval`
- `agents`
- `community`

A Node may satisfy several capabilities. The router requires every capability requested by a job. It never treats a model name, GPU name or network location as proof of capability.

ComfyUI, llama.cpp, LM Studio, Ollama and other engines remain implementation details behind the capability boundary. They are not public PlotPickle APIs and they are not Node identities.

## Trust scopes are explicit

Node network scope and Node identity/trust are not synonyms. The same durable Node can change how it is reachable without becoming a different cryptographic identity.

### `local`

The endpoint must be loopback. This is the current desktop default. Sensitive local diagnostics and runtime management remain restricted to the local Studio.

### `lan`

The endpoint must be a private/local-network hostname or address. A LAN Node is still remote and **does not inherit local trust** merely because it is on RFC1918 address space, mDNS or the same Wi-Fi/Ethernet network.

Future remote-compute registration must authenticate the Node, bind its allowed capabilities and keep project/credential authority on the PlotPickle host.

### `internet`

The endpoint must use HTTPS and cannot be loopback/private-LAN. Internet routing is opt-in at the route request; the router does not silently add public egress.

This contract does not expose the current local PlotPickle server to the Internet. Public hosting requires a separate identity/authorization/tenant-isolation phase before it can be enabled.

## Hosted Studio boundary

A future public PlotPickle deployment should look like this:

```text
Internet / browser clients
          |
       HTTPS
          |
   PlotPickle Host Node
   - node_id + signing identity
   - authentication
   - authorization
   - project membership
   - tenant isolation
   - CSRF/session policy
   - rate limits
   - audit/evidence
          |
      private services
      - Steward / agent runtime
      - PPF/project storage
      - ComfyUI
      - local text runtimes
      - retrieval
      - BUZZ coordination/community bridge
```

The public client talks to the PlotPickle Host Node. It does not receive direct network access to ComfyUI, Ollama, llama.cpp, filesystem paths, credentials, GitHub mutation endpoints or raw PPF storage.

## Hardware belongs to the Node

Hardware profiling is attached to each compute-capable Node instead of assuming compute lives on the machine rendering the UI.

A hardware summary records platform/architecture, CPU, RAM, GPU, GPU generation, GPU memory and memory model (`system`, `discrete`, `unified`, or `unknown`). Compatibility decisions remain capability/hardware driven.

That supports very different layouts with the same product contract:

```text
Desktop-only
PlotPickle UI + Host + Compute
Windows PC / constrained discrete GPU

Split Studio
PlotPickle desktop Node ---> signed/authorized route ---> PlotPickle compute-capable Node

Hosted hybrid
Browser clients ---> HTTPS ---> PlotPickle host + high-capacity compute Node
```

A Pascal desktop may require a legacy-compatible CUDA/PyTorch line; a modern RTX workstation can use a newer stack; a unified-memory workstation can expose a much larger safe working set. Those are Node hardware policies, not different PlotPickle products or identities.

## Routing contract

`selectPlotPickleNode()` is intentionally small and deterministic:

1. consider only explicitly enabled Nodes;
2. require `ready` unless the caller explicitly permits `degraded`;
3. require every requested capability;
4. respect the caller's allowed trust scopes;
5. never select an Internet Node unless `allowInternet` is explicitly true;
6. prefer local, then LAN, then Internet among otherwise eligible Nodes.

The router selects **where a capability may run**. It does not create Node identity, authenticate an unregistered remote Node, execute arbitrary remote commands, copy credentials, approve paid cloud, change PPF canon or merge code.

## Current diagnostics

The local server exposes a loopback-only `GET /api/system/node-topology` diagnostic. It reports the current desktop Node, current hardware summary, capability/readiness evidence that PlotPickle can already prove, an empty registered-Node list, and the policy that future Node registration must preserve.

The current topology descriptor ID such as `local-desktop` is a routing descriptor, not the cryptographic `node_id`, until the runtime explicitly binds the two according to the identity-authority contract.

The endpoint deliberately says hosted Studio is `contract-only`. A non-loopback request receives `403` until hosted authentication and tenant isolation exist.

## Authority remains unchanged

- Writer approval remains creative authority.
- PPF remains canonical story state.
- `person_id` / Avatar contracts own human/account identity; Node identity does not replace them.
- Each Node owns only its own local signing identity and authorized device provenance.
- The Steward and Agents operate within bounded responsibilities; their identity does not replace Node identity.
- The PlotPickle Host owns authorization and routing policy.
- Compute supplies capability, not authority.
- Agent Skills remain procedures, not permissions.
- BUZZ coordinates signed identities/events, presence and evidence but does not expose another Node's localhost or write its PPF.
- GitHub remains code merge authority.

## Follow-on phases

This foundation intentionally leaves the risky parts explicit rather than half-implementing them:

1. bind the current topology descriptor to canonical `node_id` without rotating existing Studio/Node keys;
2. hosted identity, sessions, project membership and tenant isolation;
3. HTTPS/reverse-proxy deployment contract and secure headers;
4. signed remote-compute registration and capability receipts;
5. cross-Node jobs, leases, cancellation, health and telemetry through the approved coordination boundary;
6. desktop/hosted project synchronization and offline conflict policy;
7. writer-facing Node inventory and route controls once the trust model above is enforceable.
