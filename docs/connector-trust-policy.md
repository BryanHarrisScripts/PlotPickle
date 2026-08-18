# Connector, federation and egress trust policy

PlotPickle treats connector capability as host-owned authority. Agent instructions, tool responses, Agent Skills, MCP servers, BUZZ messages, signed Playhouse events and future code-mode programs cannot expand the scopes granted by the local PlotPickle host.

## One permission pipeline

Every capability call must pass the same host policy whether it originated as a direct agent tool call, MCP invocation, provider function call, graph node, code-mode nested call or BUZZ-triggered specialist action.

A policy denial is explicit, non-retryable and cannot be bypassed by changing syntax, connector, model, provider or execution route. Runtime failures are separate from policy denials.

Network connectors require both an explicit network-egress scope and an HTTPS destination on that connector's host allowlist. Local connectors cannot acquire network access from their arguments or from text returned by another tool.

Search/list/read tools that return bounded results must disclose truncation and, when safe, return a bounded continuation reference.

## Inbound trust

The inbound sequence is:

`receive -> verify provenance/signature when available -> classify -> sanitize -> Context Engine as untrusted evidence -> optional writer/host promotion`

A valid signature proves provenance and integrity. It does not make the message a trusted instruction, project memory or PPF canon. BUZZ/Playhouse content has no direct PPF mutation path.

## Credentials and provider keys

The existing OS-protected local credential store remains authoritative. This policy does not introduce another secret store.

When a provider key is removed, its protected credential entry should be deleted and the provider becomes unavailable until the writer supplies a replacement. Replacing a key does not grant new Agent Profile scopes or paid-cloud approval; those remain separate host decisions.

Credential values must never be copied into tool audit events, Context Engine receipts, PPF provenance, BUZZ messages or Playhouse events.

## Studio signing-key rotation and recovery

The stable PlotPickle Studio ID is a product identity and must not silently change when signing material changes.

A future signing-key rotation flow should:

1. require an explicit local owner action;
2. generate the replacement key inside the existing protected local credential boundary;
3. preserve the Studio ID;
4. create a rotation record linking the previous public key to the replacement public key;
5. sign the rotation record with the previous key when it is still available;
6. publish only public rotation material through permitted Playhouse transport;
7. keep old public keys as verification history, never as active private credentials;
8. require a recovery/re-verification flow when the previous private key is unavailable rather than silently creating a new Studio identity.

The current implementation does not automatically rotate Studio keys. This section defines the required compatibility and identity invariant for that future operation.

## External Agent Skills

Skills are procedure, never permission. External/community Skills enter quarantine and are not production-executable until host review approves their trust record. Intake may inspect scripts, references and assets without executing them. A changed source hash/revision invalidates approval according to the Skill trust policy.

A verified publisher or signature proves provenance only. BUZZ-shared Skills are still quarantined when received by another Studio.
