# Events and interface extensions

## Typed events

Subscribe through `context.events.on(name, listener)` and add the returned disposable to `context.subscriptions` when it is not already owned by a helper.

Supported events:

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

Payloads are structured-cloned and frozen before delivery. Listeners should treat them as snapshots and fetch current data from Core Services when a complete view is needed.

```ts
context.subscriptions.add(
  context.events.on("SceneChanged", async ({ sceneId, changedFields }) => {
    if (changedFields.includes("dialogue")) {
      await refreshSceneDiagnostics(sceneId);
    }
  }),
);
```

Avoid long blocking work inside an event listener. Queue or debounce expensive analysis and make repeated events idempotent.

## Commands

```ts
context.registerCommand({
  id: "example.report.run",
  title: "Run Example Report",
  handler: async () => context.services.reports.generate("example"),
});
```

Command identifiers must be stable and namespaced by plugin ID.

## Menus

```ts
context.registerMenu({
  location: "tools.reports",
  command: "example.report.run",
  group: "analysis",
  order: 50,
});
```

Menus point to commands. The host owns rendering, keyboard access and final placement.

## Panels

Panels contribute focused information to `sidebar`, `workspace` or `settings` locations.

```ts
context.registerPanel({
  id: "example.report.panel",
  title: "Example Report",
  location: "sidebar",
  render: () => ({ kind: "report-summary" }),
});
```

The return type is intentionally host-defined. Do not depend on application component imports.

## Workspaces

```ts
context.registerWorkspace({
  id: "example.review",
  title: "Example Review",
  route: "/plugins/example/review",
  render: () => ({ kind: "review-workspace" }),
});
```

Routes must be plugin-scoped and must not collide with core navigation.

## Cleanup

Registration helpers automatically add their disposables to the activation store. Manual event subscriptions and external resources must also be disposed. Development reload always deactivates the old generation before activating the next one.
