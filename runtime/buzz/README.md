# PlotPickle-managed Buzz runtime

This directory is the packaging boundary for the optional Buzz sidecar runtime.

No Buzz executable is committed by the Phase 1 architecture work. Native artifacts must be produced by a reproducible release workflow, pinned to a reviewed `block/buzz` source revision, checksummed and clean-machine tested before a platform manifest may set `packaged` to `true`.

## Included components

The managed package is expected to contain:

- `buzz-relay`
- `buzz-cli`
- `buzz-agent`
- `buzz-dev-mcp`
- Apache 2.0 licence and required attribution files

The separate Buzz Tauri desktop client is not included because PlotPickle provides the user interface.

## Dormant rule

Merely installing PlotPickle must not:

- start a Buzz process;
- open a relay port;
- generate a Buzz identity;
- create a database, room or media store; or
- create a Buzz credential file.

Initialization happens only after the user chooses **Configure Buzz** in PlotPickle Settings.

## Program and data separation

Files in this directory are replaceable program artifacts. Generated data, encrypted credentials, logs, backups and coding-agent worktrees live outside the application folder under the current operating-system user account.

## Manifest rule

Each platform release must provide a manifest matching `BuzzRuntimeManifest` in `lib/buzz-runtime.ts` with:

- exact source revision and Buzz version;
- target platform;
- component paths;
- SHA-256 checksums;
- required/optional component flags; and
- licence file paths.

A missing, invalid or incomplete manifest produces an honest `unavailable` or `repair-required` state. PlotPickle must never silently download or execute an unverified replacement.
