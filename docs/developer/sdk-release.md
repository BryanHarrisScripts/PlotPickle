# SDK packaging and release

PlotPickle publishes the SDK as one coordinated version set:

| Package | Purpose | Status |
| --- | --- | --- |
| `@plotpickle/types` | public contracts | preview |
| `@plotpickle/sdk` | host client and Core Services | preview |
| `@plotpickle/plugin-sdk` | plugin runtime | preview |
| `@plotpickle/testing` | mock host helpers | preview |

## Local release checks

```bash
npm run sdk:validate
npm run sdk:build
npm run sdk:pack
npm run sdk:verify
```

`verify` compiles declaration files and source maps, creates allow-listed tarballs, installs them into a clean external consumer, and runs a runtime import check.

## Versioning

All packages use one coordinated semantic version. During preview, incompatible changes increment the preview version and require migration notes. After the first stable release: patch releases fix compatible defects, minor releases add compatible APIs, and major releases may remove or change public contracts.

Stable APIs are exported from documented package entry points. Preview APIs are supported but may change with migration guidance. Deprecated APIs remain documented for at least one minor release before removal. Application routes, components, stores and database modules are internal.

## Release notes

Each release must include:

- package version and release date;
- added, changed, deprecated, removed and fixed sections;
- compatibility matrix updates;
- migration steps for breaking changes;
- integrity hashes for generated tarballs.

## Publishing lock

Publishing is manual and disabled by default. `npm run sdk:publish` fails unless an authorized release operator explicitly sets `PLOTPICKLE_APPROVE_SDK_PUBLISH=YES`. Enabling the flag is a release approval, not a routine build step. Hosted publishing workflows must remain disabled until separately approved.

## Rollback

Never overwrite a published version. For a defective release, deprecate it in the registry, publish a corrected version, update release notes, and document the affected version range.
