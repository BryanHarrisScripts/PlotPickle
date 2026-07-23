# Phase 9A — SDK Foundation

Phase 9A establishes the first public, versioned TypeScript boundary for tools that need to understand or extend PlotPickle without importing internal UI code.

## Packages

- `@plotpickle/types` exposes stable project, canon, plugin and service contracts.
- `@plotpickle/sdk` exposes the version-negotiated client and host bridge.
- `sdk/schemas` contains machine-readable public schemas.

The packages remain private during stabilization. Publishing is a later Phase 9 release step.

## API version

The initial SDK API is `1.0.0`. The package implementation version is `0.1.0` while the public surface is being validated.

```ts
import { connectPlotPickle } from "@plotpickle/sdk";

const connection = connectPlotPickle(host, {
  apiVersion: "1.0.0",
  clientName: "Storyboard Editor",
  clientVersion: "0.1.0",
});

const project = await connection.services.project.get();
const approvedCanon = await connection.services.canon.query({ statuses: ["approved", "locked"] });
```

## Stability rules

1. Consumers negotiate an explicit API version.
2. The SDK rejects incompatible hosts before exposing services.
3. Public types re-export the Phase 8 service and plugin contracts rather than duplicating them.
4. Internal UI components, storage implementation details and provider credentials are not part of the SDK.
5. New optional members may be added within an API version; breaking changes require a new API version.

## Included surface

- project snapshots and transactions
- canon binder queries and context
- screenplay and storyboard services
- reports and timeline services
- provider-neutral AI services
- asset and storage services
- Git and plugin services
- plugin manifests, permissions, capabilities and registry types

Phase 9B will add plugin authoring helpers, events and testing utilities on top of this foundation.
