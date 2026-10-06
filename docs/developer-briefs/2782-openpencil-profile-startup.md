# Developer Brief — #2782 OpenPencil profile scope and managed startup

## UAT finding

Settings → Command showed OpenPencil inside an already-unlocked Human session, but the OpenPencil gateway returned “Unlock the local PlotPickle profile before using OpenPencil.”

Root cause: the gateway required `currentProfileRequestContext()`, but `/api/openpencil` was not included in the canonical profile-scoped request prefixes.

The Human also confirmed the desired installation contract:

- PlotPickle should prepare the reviewed OpenPencil MCP helper automatically.
- The canonical design workspace should be `<repo>\designs\openpencil`.
- Design artifacts should be part of the Git repository.
- Actual OpenPencil connection must remain explicit.

## Build contract

### Authenticated profile scope

Add `/api/openpencil` to the existing profile-scoped API boundary. Do not create a parallel auth mechanism. Existing Human session authorization and CSRF behavior remain authoritative.

### Managed MCP helper

After core PlotPickle readiness, deferred maintenance prepares:

`@open-pencil/mcp@0.15.1`

under:

`%LOCALAPPDATA%\PlotPickle\tools\openpencil`

This is deliberately outside the replaceable source checkout and outside the normal PlotPickle package-lock dependency graph.

Preparation is idempotent and version-aware. Failure is warning-only and cannot block core PlotPickle.

Startup preparation never launches `openpencil-mcp-http` and never opens port 7600.

Runtime resolution prefers the PlotPickle-managed entrypoint. Existing global npm installation remains a fallback.

### Repository design workspace

Canonical default:

`<repo>\designs\openpencil`

The directory is tracked in Git through its README. OpenPencil `.pen` source files and reviewed supporting design artifacts can be committed normally.

OpenPencil has no commit, source-code mutation, pull-request or merge authority. Design changes still flow through Human review and the normal DSDD/GitHub process.

### Settings behavior

OpenPencil status exposes the recommended repository workspace. Settings prefills it when the Human has not already typed another explicit path.

Connect / Disconnect remain explicit Human actions.

## Non-goals

- Do not install the OpenPencil desktop application.
- Do not auto-connect OpenPencil.
- Do not launch the MCP server during startup.
- Do not add `@open-pencil/mcp` to package.json/package-lock.json.
- Do not silently commit design files.
- Do not weaken Human profile isolation.
- Do not make OpenPencil a product, source, or merge authority.

## Acceptance

- Unlocked Human session reaches OpenPencil status/connect/disconnect.
- Locked or expired session remains rejected.
- Mutations retain CSRF.
- Managed 0.15.1 helper is prepared after readiness under LOCALAPPDATA.
- Managed helper wins before global npm fallback.
- Setup creates/ensures the repository design workspace.
- Setup failure cannot block PlotPickle.
- Setup never starts OpenPencil MCP.
- Settings prefills `designs\openpencil`.
- `designs/openpencil` is tracked by Git.
- Existing #2778/#2780 tests are updated to the superseding contract.
- Exact-head Architecture Verification is green before merge.
