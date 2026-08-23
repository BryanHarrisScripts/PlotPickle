# Getting started

This tutorial creates a small plugin that listens for project saves and registers a command.

## Prerequisites

- Node.js 22.13 or newer
- a PlotPickle repository checkout
- familiarity with TypeScript modules

## 1. Create the plugin folder

```text
my-plugin/
  plotpickle.plugin.json
  src/index.ts
```

## 2. Add the manifest

```json
{
  "id": "example.my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "apiVersion": "1.0.0",
  "entryPoint": "src/index.ts",
  "permissions": ["project:read"],
  "capabilities": ["commands", "events"]
}
```

Use the smallest permission set that supports the feature. Declaring a permission requests access; the host still decides whether to grant it.

## 3. Add the activation module

```ts
import type { PluginModule } from "@plotpickle/plugin-sdk";

const plugin: PluginModule = {
  activate(context) {
    context.subscriptions.add(
      context.events.on("ProjectSaved", ({ projectId, savedAt }) => {
        console.log(`Project ${projectId} saved at ${savedAt}`);
      }),
    );

    context.registerCommand({
      id: "example.my-plugin.inspect",
      title: "Inspect project",
      handler: (projectId) => context.services.project.get(String(projectId)),
    });
  },
};

export default plugin;
```

Registrations created through the activation context are disposed automatically when the plugin is deactivated.

## 4. Validate the manifest

```bash
node scripts/plotpickle-plugin.mjs validate my-plugin
```

Validation confirms the identifier, semantic version, API version, arrays and entry point.

## 5. Test with the mock host

```ts
import test from "node:test";
import assert from "node:assert/strict";
import plugin from "../my-plugin/src/index";
import { MockPluginHost, createMockServices } from "@plotpickle/plugin-sdk/testing";

await test("registers its command", async () => {
  const host = new MockPluginHost({
    manifest: {
      id: "example.my-plugin",
      name: "My Plugin",
      version: "0.1.0",
      apiVersion: "1.0.0",
      entryPoint: "src/index.ts",
      permissions: ["project:read"],
      capabilities: ["commands", "events"],
    },
    grantedPermissions: ["project:read"],
    services: createMockServices({
      project: { get: async () => null },
    }),
  });

  await host.activate(plugin);
  assert.ok(host.registrations.commands.has("example.my-plugin.inspect"));
  await host.deactivate();
});
```

## 6. Choose the correct integration pattern

- Use **commands and events** for editor workflows.
- Use **Core Services** for project data instead of internal stores.
- Use an **importer/exporter** for format conversion.
- Use a **provider plugin** for cloud or local AI, images, voice or music.
- Use the GitHub collaboration example for remote repository workflows.

Continue with the [manifest reference](plugin-manifest.md) and the [example plugin catalog](../../examples/plugins/README.md).
