# SDK and Core Services API reference

All symbols below are **preview public APIs** unless marked otherwise. Import only from `@plotpickle/types`, `@plotpickle/sdk`, `@plotpickle/plugin-sdk` or `@plotpickle/plugin-sdk/testing`.

## Plugin SDK exports

### Lifecycle and disposal

- `PLOTPICKLE_PLUGIN_SDK_VERSION` — current package version.
- `Disposable` — object with an idempotent `dispose()` method.
- `toDisposable(callback)` — creates an idempotent disposable.
- `DisposableStore` — owns multiple disposables through `add`, `delete`, `clear` and `dispose`.
- `PluginModule` — module with `activate(context)` and optional `deactivate()`.
- `PluginContext` — manifest, permission-aware services, event bus, subscription store and registration helpers.
- `ActivationHostOptions` — manifest, services, grants, events and registration host used to activate a plugin.
- `PluginActivationHost` — activates and deactivates one plugin safely.
- `PluginDevelopmentSession` — reload boundary exposing `generation`, `reload` and `dispose`.
- `createDevelopmentSession(factory)` — creates a development reload session.

### Events

- `PlotPickleEventMap` — payload map for all supported event names.
- `PlotPickleEventName` — keys of the event map.
- `EventListener` — synchronous or asynchronous event listener.
- `EventBus` — typed `on` and `emit` contract.
- `TypedEventBus` — clone-and-freeze event bus implementation.

### Registrations

- `CommandHandler`, `CommandRegistration` — command identifier, title and handler.
- `MenuRegistration` — menu location, command, optional group and order.
- `PanelLocation`, `PanelRegistration` — sidebar, workspace or settings panel.
- `WorkspaceRegistration` — named routed workspace.
- `RegistrationHost` — host-side registration contract.

### Permissions

- `PermissionAwareServices` — Core Services after plugin permission filtering.
- `PermissionError` — includes `pluginId` and required `permission`.
- `assertPermission(pluginId, grants, permission)` — explicit guard.
- `createPermissionAwareServices(pluginId, services, grants)` — wraps all public service methods.

## Core Services

The context exposes these service groups. Method availability is versioned by the SDK contract.

| Service | Public operations | Required permission |
| --- | --- | --- |
| `project` | `get`, `replace`, `transact` | `project:read`, `project:write` |
| `canon` | `binder`, `query`, `context` | `canon:read` |
| `screenplay` | `read`, `update` | `screenplay:read`, `screenplay:write` |
| `storyboard` | `frames` | `storyboard:read` |
| `reports` | `list`, `generate` | `reports:read` |
| `timeline` | `events` | `project:read` |
| `ai` | `providers`, `complete` | `ai` |
| `assets` | `list`, `read`, `write` | `assets:read`, `assets:write` |
| `storage` | `readJson`, `writeJson` | `storage:read`, `storage:write` |
| `git` | `status`, `history`, `propose` | `git` |
| `plugins` | `registry`, `pluginsFor` | `project:read` |

`services.apiVersion` identifies the Core Services contract. Do not infer access from the presence of a method; call it and handle `PermissionError`.

## Testing exports

`@plotpickle/plugin-sdk/testing` provides:

- `MockPluginHost` — activation host with observable registrations and events;
- `MockRegistrationHost` — in-memory command, menu, panel and workspace registry;
- `createMockServices(overrides)` — minimal Core Services test double.

## Internal APIs

Anything not exported by the four public entry points above is internal. Importing application routes, components, stores or database modules is unsupported even when TypeScript can resolve the path.
