# Permissions and security

PlotPickle plugins run through a capability and permission boundary. A manifest declaration requests access; only the host can grant it.

## Least privilege

Request only permissions used by the plugin. Separate read and write access wherever the service contract supports it.

| Permission | Typical use |
| --- | --- |
| `project:read` | Inspect active project data and timeline |
| `project:write` | Replace or transact on project data |
| `canon:read` | Query the canon binder and context |
| `screenplay:read` / `screenplay:write` | Read or update screenplay elements |
| `storyboard:read` | Read storyboard frames |
| `reports:read` | List or generate reports |
| `assets:read` / `assets:write` | Read or add project assets |
| `storage:read` / `storage:write` | Plugin-scoped JSON state |
| `git` | Repository status, history and proposals |
| `ai` | AI provider discovery and completion |

## Permission failures

Service calls without a grant throw `PermissionError`. Catch it at a user-facing boundary and explain which permission is missing. Do not silently retry through an internal API.

```ts
import { PermissionError } from "@plotpickle/plugin-sdk";

try {
  await context.services.screenplay.update(change);
} catch (error) {
  if (error instanceof PermissionError) {
    return { ok: false, message: `Enable ${error.permission} for this plugin.` };
  }
  throw error;
}
```

## Credentials

Plugins must never place provider keys, GitHub tokens or local-provider secrets in project files, logs, prompts, exports or source control. Credentials belong in host-managed secret storage and should be represented to plugins by opaque configuration or service access.

## Human approval

AI, image, voice and music results are proposals until the writer explicitly accepts them. A plugin must preserve provenance, model/provider metadata and whether generated material was retained. Write operations should be reversible and should never replace canonical material without a clear approval step.

## Data handling

- Treat screenplay, character and project data as private user content.
- Send only the minimum required context to remote services.
- Clearly distinguish local providers from cloud providers.
- Avoid hidden network requests.
- Do not execute arbitrary project content.
- Dispose subscriptions, registrations and temporary resources during deactivation.

## Security review checklist

Before release, confirm permission minimization, credential isolation, network disclosure, approval gates, provenance records, safe error messages, cleanup and compatibility behavior.
