# SDK compatibility matrix

| SDK version | PlotPickle host | Node.js | TypeScript | API status |
| --- | --- | --- | --- | --- |
| `0.1.0-preview.1` | `1.0.0-rc.3` and later RC builds using API `1.0.0` | `>=22.13.0` | `>=5.9` recommended | Preview |

A plugin must compare its manifest `apiVersion` with the host Core Services API before activation. Package version compatibility does not override manifest permissions or host approval.

The optional `@plotpickle/ui` package is intentionally excluded until its component API is stable.
