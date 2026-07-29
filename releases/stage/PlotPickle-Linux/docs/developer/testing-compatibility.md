# Testing, compatibility and troubleshooting

## Mock-host testing

Use `MockPluginHost`, `MockRegistrationHost` and `createMockServices` from `@plotpickle/plugin-sdk/testing`. Tests should cover activation, commands, events, permissions, service calls and complete cleanup after deactivation.

Recommended cases:

1. plugin activates with its minimum grants;
2. every command and extension is registered;
3. an expected event produces the intended result;
4. a denied write throws `PermissionError`;
5. deactivation removes registrations and listeners;
6. reload does not duplicate state;
7. provider failures return actionable errors without leaking credentials.

## Compatibility policy

Plugin compatibility is determined by manifest `apiVersion`, SDK package versions and Core Services `apiVersion`.

- A different major version is incompatible unless the host explicitly supports both contracts.
- Minor versions may add optional capabilities and methods without breaking existing plugins.
- Patch versions correct behavior without changing the documented contract.
- RC4 will freeze the long-term project, plugin and exchange-format boundary.

Do not perform feature detection by importing internal files. Use documented version fields and public methods.

## Migration workflow

When a contract changes:

1. read the release migration note;
2. update `apiVersion` only after adapting code;
3. update manifest capabilities and permissions;
4. rerun manifest and documentation validation;
5. run mock-host regression tests;
6. test with a copy of a real project before release.

## Troubleshooting

### `Plugin ... requires granted permission ...`

The plugin requested or used a service method without a host grant. Add the correct manifest request, let the user approve it, and handle denial gracefully.

### Unsupported API version

The manifest targets a plugin API major version the host cannot activate. Install a compatible plugin release or migrate against the matching SDK.

### Entry point does not exist

Resolve `entryPoint` relative to `plotpickle.plugin.json`, including filename and extension used by the development host.

### Command is missing

Confirm activation succeeded, the command ID is namespaced and unique, and the registration was not disposed by an early error.

### Event fires more than once

Ensure subscriptions are owned by the activation store and old development generations are deactivated before reload.

### Local provider cannot connect

Confirm the provider is running, endpoint configuration uses the correct loopback URL, the model is installed and the plugin reports timeout/network errors separately from model errors.

### Import loses content

Do not discard unsupported source elements. Preserve them as warnings or source metadata and require writer review before committing the conversion.

## Documentation checks

```bash
npm run test:developer-docs
```

The validator checks required pages, relative Markdown links, search entries, public API markers and examples referenced by tutorials.
