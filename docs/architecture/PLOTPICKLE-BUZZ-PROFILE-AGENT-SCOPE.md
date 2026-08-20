# PlotPickle BUZZ profile and agent-instance scope

Issue: #1144

## Authority model

PlotPickle Auth remains the authority for the local Human profile and its encrypted vault. BUZZ is a separate optional community identity and never unlocks a PlotPickle profile.

Every live `/api/local-buzz` request first resolves the authenticated server session to an `AuthContext`. The Human profile id is derived from that trusted context. A browser request cannot select a different Human signer by supplying a profile id, signer id, key reference or private key.

The request scope is carried with `AsyncLocalStorage`, so concurrent requests can retain distinct Human profile contexts without a mutable process-global current caller or current signer.

## Human BUZZ identity

`buzz-connection.json` is Human-profile owned. During an authenticated BUZZ request, the shared credential seam reads and writes it through `ProfilePrivateStorageService`, which protects it with the profile master key contract from #1140/#1141.

The profile credential contains the external BUZZ signer material and that profile's connection metadata. Safe BUZZ responses expose only non-secret connection status and verification state. The private key remains server-side.

The managed BUZZ runtime remains Node-owned. `buzz-managed-secrets.json`, relay service credentials, containers, volumes and backups are not moved into a Human profile and do not grant access to any Human vault.

Locking or logging out a Human invalidates new operations under that Human's `AuthContext`; it does not stop the shared managed BUZZ runtime and does not invalidate another authenticated Human's signer.

## Legacy migration

The old single-user `PLOTPICKLE_HOME/secrets/buzz-connection.json` is a legacy migration source only. PlotPickle does not silently assign it to the first Human who signs in.

The local profile-migration endpoint requires an authenticated Human request context and explicitly migrates the legacy BUZZ credential into that profile through the #1141 migration service. A completed legacy assignment records the destination profile in the migration marker. A later request from another profile is rejected rather than copying the same signer into multiple Human vaults.

No migration response returns signer material.

## Agent definitions and instances

A shared agent definition is not a Human-owned running agent instance. Creative instances are keyed by:

`profileId + agentDefinitionId + projectId? + conversationId`

The profile id is derived from `AuthContext`; it is not accepted from a browser request. Creative memory is stored in the authenticated Human's encrypted `memory` domain with the same provenance tuple.

This prevents a Sage instance used by one Human, project or conversation from becoming another Human's Sage memory implicitly.

## Agent BUZZ permissions

Agent BUZZ participation is an explicit grant scoped to the authenticated Human agent instance, one room and a list of allowed actions. Grants do not inherit across rooms and state explicitly that agent authorship cannot substitute for the Human community signer.

Merrin uses the same grant model. Its moderation grant is room-content-only and carries no project-private-data permission.

Node operational agents are described separately as `node-operational`. That scope does not imply Human profile access, Human vault access, Human BUZZ signer access or inherited Human permissions.

## Security properties

The boundary intentionally preserves these invariants:

- PlotPickle profile authentication and BUZZ identity remain separate.
- A Human can use local PlotPickle without configuring BUZZ.
- BUZZ signer selection is derived from the authenticated request context.
- Concurrent Humans can use separate signer records through the same runtime.
- No mutable process-global current Human, caller or signer is used.
- Human signers and agent authorship remain distinct.
- Agent memory and BUZZ grants are profile/instance scoped.
- Managed BUZZ service secrets remain Node scoped.
- Legacy BUZZ identity migration has one explicit Human destination.
