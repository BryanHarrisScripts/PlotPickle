# Managed Cloud Compute Boundary

Status: canonical #1135 replacement for the former Trusted/Public Node Compute contract. The filename is retained temporarily for repository/history compatibility; the architecture described here is **managed cloud compute only**.

## Historical correction

The earlier #1075 design allowed `own`, `trusted`, `studio` and `public` Human-owned PlotPickle Nodes to advertise spare compute. That peer-resource model is retired.

An ordinary PlotPickle Community participant is not a compute provider. Their Node may supply signed provenance for Community activity, but their GPU, models, ComfyUI, BERD, storage, build/test environment and agents remain private to their installation.

Future remote compute targets a separately configured **managed cloud service/farm**, not another Community member's PlotPickle Node.

## Cloud Service Registry

Remote compute configuration is isolated from BUZZ Community discovery.

A managed cloud service record contains only bounded routing metadata:

- `serviceId`;
- `serviceType: managed-cloud`;
- explicit enabled state;
- available/busy/offline readiness;
- text/image/video capability classes;
- safe model/workflow classes;
- protocol version;
- free/paid cost declaration;
- verification/freshness timestamps.

The registry rejects Community/peer identity fields such as `nodeId`, `ownerPersonId`, `communityId`, peer relationship/sharing scope and local hardware inventory. It also rejects local paths, provider credentials and unrestricted endpoint expansion from its safe service descriptor.

A Community Node cannot be converted into a cloud service by changing a UI label.

## Exact selection and no fallback

Remote work requires one explicitly selected, configured, fresh and available managed cloud service. If that service is missing, stale, busy or offline, dispatch fails.

PlotPickle never silently substitutes another service, another Community member's Node, or a paid provider.

Paid work requires a fresh explicit `billingConsentId` before a scoped package can be built.

## Least-privilege scoped cloud work package

The useful security principles from #1075 are preserved, but the target is a `serviceId`, not a remote `node_id`.

A package contains only what one bounded job needs:

- opaque job ID;
- authenticated requester Person and requester local Node IDs;
- exact target managed-cloud `serviceId`;
- one requested text/image/video capability;
- up to 16 narrow context items;
- up to 16 reference-asset descriptors using IDs/hashes/media metadata rather than local paths;
- optional model/workflow class constraints already supported by the service;
- runtime/output limits;
- opaque return-route ID;
- single-use task grant with no more than 30 minutes of lifetime;
- billing-consent ID when the selected service is paid.

The allowlist rejects unrestricted PPF/project state, provider credentials, local paths, hidden private-key material, arbitrary shell/code instructions as authority, and unknown privilege-bearing fields.

The requester Node must still be authorized under the account/Node identity model. That proves which local installation requested the cloud job; it does not turn that Node into a cloud provider.

## Result authority

A managed cloud result returns with:

- result/job identity;
- artifact ID, SHA-256, media type, byte length and opaque remote artifact reference;
- producing `serviceId`;
- signed receipt reference;
- completion time;
- provider/model/workflow class where available.

The contract hard-codes:

- `candidateStatus: candidate`;
- `canonStatus: not-canon`;
- `accepted: false`.

Remote/cloud execution never advances BUILD or alters PPF canon by itself. Human review and the normal PlotPickle acceptance path remain authoritative.

## Community boundary

BUZZ may eventually coordinate an approved cloud integration, but ordinary BUZZ Communities and people are a separate social plane.

Community discovery may reveal Communities, people, rooms, membership, presence and signed social provenance. It must not reveal a peer's local capability manifest or make that peer eligible for cloud/resource routing.

Joining a Community, trusting a Human, sharing a household/LAN or receiving a signed Node-provenance event never grants compute rights.

## Security invariants

- no peer-to-peer PlotPickle resource sharing;
- no `trusted`, `studio`, `family/team` or `public` Human Node compute targets;
- no Community presence -> compute conversion;
- no local filesystem paths in cloud work packages;
- no Human/Node private keys in cloud work packages;
- no provider credentials in cloud work packages;
- no unrestricted PPF upload;
- no arbitrary general remote shell endpoint;
- exact target service and single-use short-lived grant;
- explicit paid consent;
- no silent fallback;
- result provenance is service-based;
- returned artifacts remain candidate/not-canon until Human acceptance.

## Compatibility note

`core/identity/remote-node-compute-core.mjs` remains only as a compatibility tombstone. Its peer-compute entry points are disabled and throw the #1135 retirement error. New remote compute code must use `core/cloud/managed-cloud-compute-core.mjs` / `core/cloud/managed-cloud-compute.ts`.
