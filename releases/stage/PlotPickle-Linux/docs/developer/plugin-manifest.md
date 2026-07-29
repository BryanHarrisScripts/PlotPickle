# Plugin manifest reference

Every plugin contains `plotpickle.plugin.json`.

## Required fields

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable lowercase identifier such as `studio.tool-name` |
| `name` | string | Human-readable display name |
| `version` | semver | Plugin release version |
| `apiVersion` | semver | PlotPickle plugin API contract; currently `1.0.0` |
| `entryPoint` | string | Module path relative to the manifest |
| `permissions` | string[] | Requested host capabilities |
| `capabilities` | string[] | Features contributed by the plugin |

Optional metadata may include description, author, homepage, repository, license and compatibility notes. Unknown fields must be ignored by compatible hosts unless a future schema explicitly marks them invalid.

## Version negotiation

The host validates `apiVersion` before activation. A plugin targeting an unsupported major version must not activate. Minor additions should remain backward-compatible; breaking changes require a new major API version and a migration guide.

## Capabilities

Common capabilities include `commands`, `events`, `menus`, `panels`, `workspaces`, `importer`, `exporter`, `ai-provider`, `image-provider`, `voice-provider`, `music-provider` and `collaboration`.

Capabilities describe discoverability. They do not grant data access.

## Permissions

Permissions are requests, not grants. See [Permissions and security](permissions-security.md). A plugin must handle denied permissions without corrupting project state.

## Validation

```bash
node scripts/plotpickle-plugin.mjs validate path/to/plugin
```

Typical errors:

- invalid identifier or semantic version;
- unsupported `apiVersion`;
- missing permission or capability arrays;
- missing entry point.
