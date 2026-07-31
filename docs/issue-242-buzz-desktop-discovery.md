# Issue #242 — Buzz Desktop v0.5.3 discovery

## Product decision

PlotPickle no longer requires a writer to locate or install a second Buzz CLI when Buzz Desktop already provides one.

Buzz Desktop `desktop-v0.5.3` bundles the `buzz` CLI as a Tauri external binary. PlotPickle uses that installed sidecar for signed room and message operations when no explicit CLI path has been saved.

## Resolution order

1. Explicit Buzz CLI path saved in PlotPickle.
2. `BUZZ_CLI_PATH` environment override for development or support.
3. Normal Buzz Desktop installation locations for the current platform.
4. `buzz.exe` on Windows or `buzz` on macOS/Linux through `PATH`.

The Settings status reports which source resolved the executable. Detection only checks local executable paths and runs `--version` through the existing bounded command runner. It does not start Buzz Desktop, create an identity, open a port, connect a relay or write project data.

## Windows v0.5.3

The primary current-user candidate is:

```text
%LOCALAPPDATA%\Buzz\buzz.exe
```

PlotPickle also checks the Tauri resources subdirectory, the `%LOCALAPPDATA%\Programs\Buzz` fallback and per-machine Program Files locations. Target-triple sidecar names are accepted for support builds.

## Separate relay boundary

Buzz Desktop is a client and includes the CLI sidecar. It does not remove the need for a reachable Buzz relay.

PlotPickle's managed local relay remains the separately pinned Docker Compose path. Its image and trust bundle are not silently replaced by the desktop release. A writer may instead connect to an existing trusted relay.

## Identity and canon boundary

- Buzz private identities remain in PlotPickle's encrypted OS-user credential store.
- CLI discovery never reads the Buzz Desktop keyring or backups.
- Buzz discussion can create a PlotPickle proposal.
- Only explicit human approval changes the PPF creative record.

## Optional installation from the Windows launcher

`Start-PlotPickle.bat` remains the single Windows startup entry point. After PlotPickle's own reusable runtime is ready, the launcher checks the same supported Buzz Desktop installation roots.

When Buzz Desktop is missing, the launcher presents one explicit Y/N choice. Choosing Yes runs the packaged `scripts/install-buzz-desktop.ps1` helper, which downloads the exact `desktop-v0.5.3` Windows asset from the official `block/buzz` GitHub release and opens the installer visibly. It does not pass silent-install arguments or request elevation. The current asset is labelled alpha-unsigned, so Windows SmartScreen may require confirmation.

Choosing No, cancelling the third-party installer or encountering a download failure does not block PlotPickle startup. No relay, identity or story data is created by the launcher.

Buzz still lives in PlotPickle:

- Settings owns detection, relay configuration, encrypted identity and connection testing.
- Collab owns Buzz Story Rooms, messages and proposal creation.
- Buzz Desktop supplies the local client/CLI dependency underneath those PlotPickle surfaces.
