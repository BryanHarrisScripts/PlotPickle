# PlotPickle Node Topology

PlotPickle is local-first today, but its application boundary is intentionally server-based/client-capable. The node-topology contract gives that boundary a stable vocabulary without pretending that the current local Studio is already a hardened public multi-user service.

## One product, several node roles

Every PlotPickle installation can be described as a **PlotPickle Node**. A node has a mode, explicit trust scope, endpoint, readiness state, hardware summary and declared capabilities.

| Mode | Intended shape | Current status |
| --- | --- | --- |
| `desktop` | Client + local host + optional compute on one computer | Current default |
| `studio-host` | Authenticated HTTPS PlotPickle host for approved browser/desktop clients | Contract only; not enabled yet |
| `compute` | Text/image/video/retrieval capability for an approved PlotPickle host | Routing primitive only; registration/handshake is follow-on work |
| `hybrid` | Host + high-capacity compute on one workstation/server | Contract only; useful for systems such as a unified-memory AI workstation |

The mode does not grant authority. A compute node can be powerful without owning projects, credentials, canon or code.

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

A node may satisfy several capabilities. The router requires every capability requested by a job. It never treats a model name, GPU name or network location as proof of capability.

ComfyUI, llama.cpp, LM Studio, Ollama and other engines remain implementation details behind the capability boundary. They are not public PlotPickle APIs.

## Trust scopes are explicit

Node network scope and node trust are not synonyms.

### `local`

The endpoint must be loopback. This is the current desktop default. Sensitive local diagnostics and runtime management remain restricted to the local Studio.

### `lan`

The endpoint must be a private/local-network hostname or address. A LAN node is still remote and **does not inherit local trust** merely because it is on RFC1918 address space, mDNS or the same Wi-Fi/Ethernet network.

Future remote-compute registration must authenticate the node, bind its allowed capabilities and keep project/credential authority on the PlotPickle host.

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
   PlotPickle Host
   - authentication
   - authorization
   - project membership
   - tenant isolation
   - CSRF/session policy
   - rate limits
   - audit/evidence
          |
      private services
      - agent runtime
      - PPF/project storage
      - ComfyUI
      - local text runtimes
      - retrieval
      - BUZZ/community bridge
```

The public client talks to the PlotPickle Host. It does not receive direct network access to ComfyUI, Ollama, llama.cpp, filesystem paths, credentials, GitHub mutation endpoints or raw PPF storage.

## Hardware belongs to the node

Hardware profiling is attached to each compute-capable node instead of assuming compute lives on the machine rendering the UI.

A hardware summary records platform/architecture, CPU, RAM, GPU, GPU generation, GPU memory and memory model (`system`, `discrete`, `unified`, or `unknown`). Compatibility decisions remain capability/hardware driven.

That supports very different layouts with the same product contract:

```text
Desktop-only
PlotPickle UI + Host + Compute
Windows PC / constrained discrete GPU

Split Studio
PlotPickle desktop UI ---> private LAN ---> PlotPickle compute node

Hosted hybrid
Browser clients ---> HTTPS ---> PlotPickle host + high-capacity compute
```

A Pascal desktop may require a legacy-compatible CUDA/PyTorch line; a modern RTX workstation can use a newer stack; a unified-memory workstation can expose a much larger safe working set. Those are node hardware policies, not different PlotPickle products.

## Routing contract

`selectPlotPickleNode()` is intentionally small and deterministic:

1. consider only explicitly enabled nodes;
2. require `ready` unless the caller explicitly permits `degraded`;
3. require every requested capability;
4. respect the caller's allowed trust scopes;
5. never select an Internet node unless `allowInternet` is explicitly true;
6. prefer local, then LAN, then Internet among otherwise eligible nodes.

The router selects **where a capability may run**. It does not authenticate a remote node, execute arbitrary remote commands, copy credentials, approve paid cloud, change PPF canon or merge code.

## Current diagnostics

The local server exposes a loopback-only `GET /api/system/node-topology` diagnostic. It reports the current desktop node, current hardware summary, capability/readiness evidence that PlotPickle can already prove, an empty registered-node list, and the policy that future node registration must preserve.

The endpoint deliberately says hosted Studio is `contract-only`. A non-loopback request receives `403` until hosted authentication and tenant isolation exist.

## Authority remains unchanged

- Writer approval remains creative authority.
- PPF remains canonical story state.
- The PlotPickle Host owns authorization and routing policy.
- Compute supplies capability, not authority.
- Agent Skills remain procedures, not permissions.
- BUZZ federation coordinates identities/events but does not expose another Studio's localhost or write its PPF.
- GitHub remains code merge authority.

## Follow-on phases

This foundation intentionally leaves the risky parts explicit rather than half-implementing them:

1. hosted identity, sessions, project membership and tenant isolation;
2. HTTPS/reverse-proxy deployment contract and secure headers;
3. signed remote-compute registration and capability receipts;
4. cross-node jobs, leases, cancellation, health and telemetry;
5. desktop/hosted project synchronization and offline conflict policy;
6. writer-facing node inventory and route controls once the trust model above is enforceable.
