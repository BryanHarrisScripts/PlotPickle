# PlotPickle Developer Portal

Build integrations for PlotPickle without importing application internals.

> **API status:** The Phase 9 SDK and plugin APIs are preview APIs until RC4 freezes the project, plugin and file-format contracts. Public packages are not yet published to a registry; repository workspace imports are used during development.

## Start here

1. [Getting started](getting-started.md)
2. [Plugin manifest reference](plugin-manifest.md)
3. [SDK and Core Services API](api-reference.md)
4. [Permissions and security](permissions-security.md)
5. [Events and interface extensions](events-extensions.md)
6. [Importers, exporters and providers](integration-guides.md)
7. [Testing, compatibility and troubleshooting](testing-compatibility.md)
8. [Example plugin catalog](../../examples/plugins/README.md)

## Documentation map

| Area | Use it for |
| --- | --- |
| Getting started | Creating, validating and testing a first plugin |
| Manifest | Declaring compatibility, capabilities and permissions |
| API reference | Activation lifecycle, services, events, registrations and testing exports |
| Security | Least-privilege access, credentials, approvals and provenance |
| Extensions | Commands, menus, panels, workspaces and typed events |
| Integrations | AI, local models, GitHub, FDX, Fountain, PDF, images and music |
| Compatibility | Version negotiation, migration and error recovery |

## Stable, preview and internal

- **Stable:** documented project exchange concepts already covered by frozen schemas.
- **Preview:** `@plotpickle/sdk`, `@plotpickle/plugin-sdk`, plugin API version `1.0.0`, events and extension registrations. These are supported for current development but may receive documented migration changes before RC4.
- **Internal:** application components, stores, routes and implementation modules not exported by public packages. Plugins must never import these.

## Offline use

This entire folder is the canonical offline documentation bundle. Markdown links are relative so the bundle works from a cloned or downloaded repository without a network connection.

Run documentation validation with:

```bash
npm run test:developer-docs
```

The command checks required pages, navigation links, API coverage markers and the search index used by a future hosted portal.
