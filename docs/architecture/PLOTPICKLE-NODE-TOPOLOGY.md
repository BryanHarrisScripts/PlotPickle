# PlotPickle Node, Human Profile, BUZZ Community and Compute Boundaries

Status: canonical architecture for #1135. This replaces the older peer/distributed-compute interpretation while preserving the durable Node identity established by #1131.

## Canonical objects

PlotPickle keeps four concepts separate:

1. **Human / Avatar** — the person acting, writing and participating socially.
2. **PlotPickle Node** — one PlotPickle installation/device with a durable `node_id` and independent local signing key.
3. **Agent / Steward** — a bounded helper operating inside a Node; never a substitute for Human or Node identity.
4. **BUZZ Community** — a social/security object containing members, rooms, permissions, moderation and signed conversation.

A Community is not a Node. A Node is not a person. A Person may use several Nodes, and one shared household Node may securely host multiple Human profiles.

```text
Human / Avatar
   -> active Human profile
      -> PlotPickle Node (node_id + device key)
         -> BUZZ signed transport
            -> BUZZ Community
               -> room/channel
```

Node identity remains underneath Community activity as device/install provenance. The normal user-facing discovery model is **BUZZ Communities and people**, not a directory of machines.

## Shared-computer privacy

One PlotPickle installation may host zero or more local Human profiles without changing `node_id`.

Each Human profile has its own private workspace/vault boundary for project/PPF state, Story Archive and Library metadata, Human/project agent memory, retrieval/search state, private Community cache, Human BUZZ signer reference, personal settings/credentials where applicable, and private recent previews.

A shared Node must never let one Human enumerate, open, search, preview or infer another Human's private workspace simply because both people can launch PlotPickle on the same computer.

A profile switch is a security transition. Before another Human activates, PlotPickle requires evidence that the prior project was safely closed, vault access released, agent and retrieval context cleared, private UI state cleared, Human BUZZ session detached, personal credentials cleared where feasible, and the prior session invalidated. The next Human then supplies a separately verified unlock. Shared Node-level services may remain running but receive Human-scoped authorization before touching private data.

PlotPickle may use OS-backed secure storage when the OS account identifies one Human. If several people share the same OS login, PlotPickle must provide its own secure unlock boundary. Unlock secrets never belong in PPF, BUZZ messages, logs, GitHub, plain-text settings or agent memory.

Guest is an isolated local profile, not implicit access to an existing Human's work.

## BUZZ Communities and people

BUZZ is the signed Community/federation fabric through which PlotPickle sees Communities, people, rooms, membership and presence.

A verified Human may use the built-in PlotPickle Community and, where the connected BUZZ contract supports it, create additional Communities. A Community can be public, closed/invite-only, or private/non-discoverable according to its BUZZ policy.

PlotPickle consumes BUZZ as the authority for Community identity, membership, rooms, presence and signed conversation instead of creating a competing social database.

Public Communities may expose safe public metadata for discovery. Closed Communities expose only the safe invitation/join surface allowed by BUZZ until membership is authorized. Private/non-discoverable Communities remain invisible to unauthorized Humans. Revoked membership and stale presence are never shown as current.

A Human using two Nodes is still one Community person. Two Humans sharing one Node remain two Humans with separate BUZZ identities and memberships.

## Node provenance, not Node browsing

A remote social event may retain originating Node provenance for trust, audit, revocation and moderation. That provenance does not make the remote installation a resource provider.

**Community presence is never compute eligibility.**

Community presence must not publish another Human's GPU/VRAM/CPU/RAM inventory, local models, ComfyUI details, BERD availability, storage inventory, provider credentials/endpoints, build/test capacity, spare load, or local agents as remotely executable services.

Social trust, room membership, household relationship, LAN proximity or Community membership never grants filesystem, PPF, provider, ComfyUI, BERD, shell, build/test, model or arbitrary execution access to another Human's Node.

## Local Capability Manifest

A Node still needs truthful local capability/readiness state so its own Steward/router can operate the installation. Local capability classes may include text, vision, image, video/audio, retrieval, models/runtimes, ComfyUI, storage/project services, agents, BEN, Pi, build/test and BERD.

This manifest is private to the local Node by default. Hardware/model/provider/tool changes update capability readiness but do not rotate `node_id`.

BERD is a local Node capability/harness pattern. BEN, Pi or the Steward may use it locally when policy permits. It is never advertised to Community peers as a remote shell or build resource.

## Network scopes are not resource authority

The topology vocabulary retains `local`, `lan` and `internet` endpoint scopes because PlotPickle may have hosted/client transport contracts in the future. Those scopes describe reachability, not permission to execute workloads on another Human's Node.

LAN proximity never grants trust. Internet endpoints require HTTPS. A public/hosted PlotPickle client does not receive direct network access to ComfyUI, Ollama, llama.cpp, filesystem paths, credentials, GitHub mutation endpoints or raw PPF storage.

Terms such as `desktop`, `studio-host`, `compute` and `hybrid` remain deployment/readiness descriptors for an installation; they are not Community identity classes and they do not opt a machine into peer resource sharing.

## Local Node routing contract

`selectPlotPickleNode()` is now deliberately local-resource-only:

1. normalize known Node descriptors;
2. require `trustScope === local`;
3. require enabled and ready, unless degraded is explicitly permitted;
4. require every requested capability;
5. never select LAN or Internet Community/peer Nodes for text/image/video/build work.

`PLOTPICKLE_PEER_RESOURCE_ROUTING_ENABLED` is `false`.

A request that permits only LAN/Internet scopes returns no resource route. Allowing Internet egress does not turn an Internet Node into a compute target.

Compute supplies capability, not authority. Local compute remains local to the installation and active authorized Human.

## Managed cloud compute is a separate registry

Future remote generation is represented by a distinct **Cloud Service Registry**, not by a list of other Humans' Nodes.

```text
Human
  -> local PlotPickle Node
     -> explicit cloud request
        -> configured managed cloud service
           -> scoped job
              -> candidate result + provenance
```

A managed cloud service uses service identity such as `serviceId`, not another Human's `node_id`. It must be explicitly configured/enabled, truthfully available and fresh, and may expose only bounded service capability metadata needed for routing.

Cloud routing cannot be populated from ordinary BUZZ Community presence. No Community Node advertisement may be normalized as a managed cloud service.

Paid cloud work requires explicit billing consent and cannot be a silent local-to-cloud or free-to-paid fallback.

Returned cloud artifacts remain candidates and not canon until normal Human/PPF acceptance.

See the legacy-path document `TRUSTED-REMOTE-COMPUTE.md`, now rewritten as the managed cloud-compute security contract.

## BUZZ has two bounded roles

### Inside one Node

BUZZ provides the local coordination/evidence backbone described by #1130 for agent/service status, health, recovery, UAT evidence and continuous-improvement candidates. Local coordination does not require remote peers.

### Between people and Communities

BUZZ carries signed Community identity, Communities, rooms, membership, messages, presence, moderation and Node provenance as required by #1129. It does not carry another Human's private capability manifest for execution routing.

## Current diagnostics

`GET /api/system/node-topology` remains loopback-only. It reports the current local Node and local hardware/capability evidence. Its routing policy explicitly reports:

- `defaultTrustScopes: ["local"]`;
- `peerNodeResourceRouting: false`;
- `communityPresenceCarriesCapabilities: false`;
- `cloudServicesUseSeparateRegistry: true`.

Community discovery is reported as BUZZ-backed `communities`, `people`, `rooms` and `presence`, with Node identity marked `provenance-only`.

## Authority remains unchanged

- Human/Avatar owns authorship and Community personhood.
- PPF remains canonical creative story state.
- Node identity proves installation/device provenance.
- Human profile/vault boundaries protect local private work.
- BUZZ supplies signed social/coordination provenance, not creative canon or peer execution authority.
- Steward and Agents remain bounded helpers.
- BEN/deterministic tests/build/UAT/Full Verification retain engineering PASS/FAIL authority.
- Managed cloud services may produce candidate outputs but cannot accept canon.
- GitHub remains source/PR/merge authority.

## Release invariants

- One Node may host several isolated Humans.
- One Human may use several Nodes without becoming several Community people.
- Profile switches clear Human-scoped project, agent, retrieval, UI, credential and BUZZ-session state before another Human unlocks.
- Community discovery centers Communities and people; Node identity is provenance underneath.
- Community presence never exposes or routes local resources.
- Peer Node compute is disabled.
- Local capability routing remains local.
- Remote compute, if configured, targets only an explicit managed cloud service.
- Missing/stale evidence is never presented as ready/online.
- BUZZ offline does not prevent local LEARN/PLAN/BUILD, local AI, local agents or local profile access.
