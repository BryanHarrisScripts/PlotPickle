# Pluggable Readiness Identity and Target Contract

Status: Phase A contract for #1071 / #1072.

This contract applies the stable-identity principle established by #927 to generic PlotPickle extensions and readiness modules. It deliberately defines identity and target selection only. Module runtime ownership, process supervision, readiness APIs and registries belong to later phases, beginning with Phase B.

## Identity split

Every extension has four identity layers. They must remain separate so a rename or reconnect cannot silently change process, transport or target identity.

1. Human display identity

`displayName` is presentation metadata for people. It may be changed independently of the machine-facing identifiers. It is never used as a service key, transport namespace, callback identity, task identity or persistence key.

2. Process/service identity

`owner` plus `moduleId` form the stable module key. `serviceName` is derived deterministically as `plotpickle-module-<owner>-<moduleId>`. A human-facing rename therefore cannot change the process/service identity.

This follows #927's rule that mutable Studio naming stays separate from immutable identity. The extension contract does not replace, mutate or derive the existing `pp_studio_XXXXXXXX` Studio identity.

3. Transport/tool namespace

`transportNamespace` is derived as `plotpickle.modules.<owner>.<moduleId>`. Callback and task identities are derived from that namespace, while HTTP-style convention roots are exposed as:

`/extensions/<owner>/<moduleId>`

`/extensions/<owner>/<moduleId>/callbacks`

`/extensions/<owner>/<moduleId>/tasks`

These names are generic contract identifiers. Phase A does not choose an MCP server, HTTP server, process host or tool registry.

4. Remote target identity

A selected external target is described independently from module identity. The descriptor requires `endpoint` and may include `authRef`, `displayLabel` and `reconnectPolicy` (`manual`, `on-demand` or `always`).

`authRef` is a reference to authentication material, not the authentication secret itself. Phase A does not define credential providers or transport-specific authentication.

Selected targets persist by the stable `<owner>/<moduleId>` key in PlotPickle's local protected credential storage. They do not persist by display name or Studio name, so human-facing renames cannot orphan target selection.

## Compatibility rules

The existing Studio identity from #927 remains authoritative for Studio federation, permissions, moderation, history and signing. Extensions must not derive their stable identity from a mutable Studio display name.

The generic extension contract contains no provider-specific naming or behavior. A future module may use it whether that module is bundled with PlotPickle, launched beside PlotPickle or contacted independently. No Phase A contract requires the Studio UI or Studio process to be running for machine-to-machine use.

Existing MCP envelope and startup contracts remain unchanged. Phase A adds no new runtime owner, server, process lifecycle or startup dependency.

## Deferred to Phase B and later

Phase B defines the shared module/runtime interfaces that consume this identity contract. Later phases define Studio capability metadata, process ownership, a first package pilot, migration wiring, wider coverage and adoption documentation.

Until those phases land, callers should treat `build/extension-identity.ts` as the canonical identity and persisted-target contract only, not as a runtime implementation.
