# Phase 9B — Plugin SDK and Event Bus

PlotPickle Phase 9B adds the public plugin-authoring layer on top of the Phase 8 plugin platform and Phase 9A SDK service boundary.

## Package

`@plotpickle/plugin-sdk` provides:

- typed project and editor events;
- plugin activation and deactivation contracts;
- automatic subscription and registration disposal;
- command, menu, panel and workspace registration helpers;
- permission-aware Core Services wrappers;
- development reload boundaries;
- a mock activation host for local tests.

The package remains private while the public surface is stabilized.

## Lifecycle

A plugin exports a module with an `activate(context)` function and an optional `deactivate()` function.

The activation context contains the plugin manifest, permission-filtered services, typed events, a disposable subscription store and registration helpers. Every registration made through the context is automatically removed when the plugin is deactivated.

Plugins must not import application-internal modules. They use `@plotpickle/types`, `@plotpickle/sdk` and `@plotpickle/plugin-sdk` only.

## Typed events

The initial event contract includes:

- `ProjectOpened`
- `ProjectSaved`
- `CanonChanged`
- `CharacterUpdated`
- `SceneChanged`
- `ScreenplayChanged`
- `StoryboardChanged`
- `TimelineUpdated`
- `ApprovalGranted`
- `AICompleted`
- `ExportCompleted`

Subscriptions return a `Disposable`. Event payloads are cloned and frozen before delivery so one listener cannot mutate data observed by another listener.

## Registration helpers

Plugins can register:

- commands;
- menu placements;
- panels;
- workspaces.

The host owns the actual interface implementation. The plugin receives only a disposable registration handle and cannot reach internal registries directly.

## Permissions

Core Services are wrapped per plugin. A service call checks the plugin's granted permissions before forwarding to the real host service.

Permission failures throw `PermissionError`, identifying both the plugin and required permission. Declaring a permission in the manifest does not grant it; the host still controls approval.

Read and write calls are separated for project, canon, screenplay, storyboard, reports, assets and storage. Git and AI services require their dedicated permissions.

## Development mode

`createDevelopmentSession()` creates a safe reload boundary for local plugin development. A reload first deactivates the previous activation host, disposes every registration and subscription, creates a fresh host and activates the new module generation.

This is a local development helper, not a production promise that arbitrary application modules can be replaced without validation.

## Testing

Import `MockPluginHost`, `MockRegistrationHost` and `createMockServices` from `@plotpickle/plugin-sdk/testing`.

The mock host can:

- activate and deactivate a plugin;
- emit typed events;
- inspect registered commands, menus, panels and workspaces;
- execute registered commands;
- inject only the service methods required by a test;
- verify explicit permission failures and cleanup.

Run the focused contract test locally:

```bash
npm run test:plugin-sdk
```

## Developer CLI foundation

The first local CLI command validates a plugin manifest and confirms that its entry point exists:

```bash
node scripts/plotpickle-plugin.mjs validate path/to/plugin
```

A plugin folder should contain `plotpickle.plugin.json`. This foundation can later support scaffolding, packing, compatibility checks and development hosting without changing the manifest contract.

## Example activation

```ts
import type { PluginModule } from "@plotpickle/plugin-sdk";

const plugin: PluginModule = {
  activate(context) {
    context.subscriptions.add(
      context.events.on("ProjectSaved", ({ projectId }) => {
        console.log(`Saved ${projectId}`);
      }),
    );

    context.registerCommand({
      id: "example.inspect-project",
      title: "Inspect Project",
      handler: () => context.services.project.getActive(),
    });
  },
};

export default plugin;
```

## Compatibility boundary

Phase 9B does not publish packages or make plugin execution unrestricted. The Phase 8 manifest, permission and capability model remains authoritative. Phase 9C will use these APIs to build reference plugins, and RC4 will freeze the supported long-term format after the remaining compatibility work is complete.
