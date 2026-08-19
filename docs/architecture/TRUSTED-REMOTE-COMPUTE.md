# Trusted/Public Node Discovery and Scoped Remote Compute

Status: Phase D implementation contract for #1071 / #1075.

Phase A (#1072) locked Person, Avatar and Node identity authority. Phase B (#1073) added independent Node authorization/revocation and portable LEARN reconciliation. Phase D adds the transport-neutral contract for optional Compute Node advertising, discovery and least-privilege remote work without turning PlotPickle, BUZZ or a remote machine into unrestricted project authority.

## Core rule

Compute is an optional capability of an authorized Node. Starting PlotPickle, joining Community or running BUZZ never publishes compute automatically.

A Node must explicitly opt in before an advertisement exists. Opting out removes its advertisement. Revoking an own Node at the account layer also removes it from account-scoped discovery even if a stale directory entry still exists.

## Trust and visibility

PlotPickle distinguishes the viewer's relationship to a Node from the Node owner's sharing scope.

Viewer relationships:

- `own` — an independently authorized Node belonging to the same PlotPickle Person;
- `trusted` — a remote Node the user explicitly approved;
- `studio` — a remote family/team/studio Node the user explicitly approved;
- `public` — a Node intentionally advertised for public discovery.

Owner sharing scopes:

- `private`;
- `trusted`;
- `studio`;
- `public`.

The receiving side cannot promote a Node beyond the scope its owner advertised. A private advertisement cannot be registered as trusted/public. Trusted and studio relationships require explicit user approval. A public result may be listed without establishing a trusted relationship, but using it still requires the user or host workflow to select that exact Node.

## Safe capability advertisement

`core/identity/remote-node-compute-core.mjs` publishes a deliberately small metadata record:

- Node ID and owner Person ID;
- explicit sharing scope;
- availability: available, busy or offline;
- text/image/video capability classes;
- safe model/workflow classes;
- coarse memory tier rather than a full machine inventory;
- load percentage;
- protocol version;
- free/paid job cost declaration;
- short advertisement lifetime.

The advertisement has no endpoint, filesystem path, private key, provider credential, full software inventory or unrestricted machine description. Unknown fields are rejected.

Advertisements expire within 24 hours and must be refreshed. Discovery therefore cannot treat a months-old public record as current availability.

## No silent fallback

Remote dispatch is exact-target.

`requireSelectedComputeNode()` requires one specific Node ID. If that Node is missing, revoked, expired, busy or offline, dispatch fails. PlotPickle must not silently substitute another own, trusted or public Node.

This is especially important for paid/public compute. A local failure may not turn into a public or paid request without a new explicit selection/consent path.

## Least-privilege work package

A work package contains only the minimum approved material for one job:

- opaque job ID;
- authenticated requester Person and requester Node IDs;
- exact target Node ID;
- one text/image/video capability;
- up to 16 narrow context items (story, character, world, visual or instruction);
- up to 16 reference-asset descriptors identified by ID, SHA-256, media type and byte length;
- optional model/workflow class constraints already advertised by the Node;
- runtime/output limits;
- one opaque return-route ID;
- a single-use task grant expiring within 30 minutes;
- explicit billing-consent ID when the chosen Node advertises paid compute.

The package rejects unrestricted PPF, provider credentials, local paths and unknown fields. Writer context may contain ordinary creative subject matter, but private-key PEM material is rejected.

Reference-asset bytes may be transported by a future authenticated channel, but local filesystem paths are not part of the work-package contract.

## Authorization and expiry

The requester Node must be active in the account authorization model from #1073.

The task grant is bound to:

- one grant ID;
- one exact target Node;
- one exact capability;
- one use;
- an issue/expiry interval no longer than 30 minutes.

A target Node rejects an expired grant, a package addressed to a different Node or a capability mismatch.

Transport signatures and network delivery remain replaceable implementation details above/below this pure contract. No account token, Node private key or provider credential is embedded in the package merely to prove the state machine.

## Paid compute

A Node may advertise a per-job price for future accounting. This phase does not build a marketplace.

A paid advertisement cannot produce a dispatchable work package without an explicit `billingConsentId`. PlotPickle must not infer consent from previous provider use or silently fall back from free/local compute to paid compute.

## Returned artifact authority

Remote output is always returned as a candidate with provenance:

- result ID and originating job ID;
- artifact ID, SHA-256, media type, byte length and opaque remote artifact reference;
- producing Node ID;
- signed receipt reference;
- completion time;
- provider/model/workflow class where available.

The core hard-codes:

- `candidateStatus: candidate`;
- `canonStatus: not-canon`;
- `accepted: false`.

The result input cannot ask to set `accepted`, `canon` or another authority field. Normal PlotPickle review/acceptance must happen after return through the existing writer/PPF authority. Remote execution never advances BUILD or alters canon by itself.

## Data-minimization examples

Allowed package context for one World frame:

- accepted lighthouse description;
- accepted palette/composition note;
- hashes/descriptors for two approved reference images;
- `image` capability;
- `world-frame` workflow class;
- 300-second execution limit.

Not allowed merely because remote compute is available:

- the entire PPF;
- project directory path;
- provider API key;
- Node private key;
- hidden prompts/reasoning;
- unrelated screenplay history;
- arbitrary shell commands;
- permanent account/session credential.

## Transport and public-Node boundary

This phase deliberately implements the contract/state machine and deterministic security tests, not a public execution service.

Before real Internet/public Node execution is enabled, the runtime layer must still provide authenticated transport, signed advertisement/result verification, sandbox/process isolation, archive/path defenses, resource/rate limits, revocation/blocking and audited receipts. No arbitrary shell or general remote-code endpoint is authorized by this contract.

BUZZ may later help transport/discover signed Node state, but joining the BBS never implies compute sharing and BUZZ remains provenance/Community transport rather than project or account authority.

## Phase boundary

Phase D supplies the reusable discovery and scoped-work primitives required by the future web-anywhere phase (#1077) and managed Desktop/Node harness (#1079). It does not add:

- a compute marketplace;
- automatic public sharing;
- silent local-to-remote or free-to-paid fallback;
- unrestricted project sync;
- permanent remote credentials;
- arbitrary remote shell/code execution;
- automatic canon/PPF acceptance;
- mobile or web UI.

Those later surfaces must consume this least-privilege contract rather than bypass it.
