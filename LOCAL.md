# PlotPickle Local

PlotPickle Local runs the same browser interface from a private PHP server on the user's own computer. It complements—not replaces—the hosted PlotPickle demo.

## Editions

| Edition | Current entry point | Intended public package |
| --- | --- | --- |
| Windows | `PlotPickle.bat` | `PlotPickle.exe` inside a signed installer or portable ZIP |
| macOS | `PlotPickle.command` | notarized `PlotPickle.app` in a DMG |
| Linux | `plotpickle.sh` | AppImage |

All editions use the same exported HTML, CSS, JavaScript, PHP router, project schema, and autosave bridge. Only the launcher and PHP runtime differ.

## Local capabilities

The PHP runtime listens only on `127.0.0.1:48721` and provides:

- `GET /__plotpickle/health` — confirms that PlotPickle is running locally.
- `GET /__plotpickle/projects` — lists local `.plotpickle.json` projects.
- `GET /__plotpickle/project?name=...` — opens a local project.
- `PUT /__plotpickle/project?name=...` — saves a project atomically.
- Automatic timestamped backups, retaining the latest 20 backups per project.

When the local runtime is detected, `app/local-runtime-bridge.tsx` restores the newest disk project and mirrors the canonical browser project into a real project file after changes. The hosted edition continues using browser storage and JSON import/export because the local endpoints do not exist there.

User data is stored beside the portable application:

```text
PlotPickle/
├── data/
│   ├── projects/
│   └── backups/
├── web/
├── server/
├── runtime/
└── launcher
```

A later installer can move `data` to the normal per-user application-data directory. Keeping it beside the portable package makes the first release easy to inspect, copy, and back up.

## Build and package

Install dependencies and create the local static export:

```bash
npm ci
npm run build:local
```

The local build enables Next.js static export only for this command and validates that `out/index.html`, the canonical storage key, and the PHP bridge are present.

Create platform folders and archives:

```bash
npm run package:local
```

Outputs are written under `releases/local/`:

```text
PlotPickle-Windows.zip
PlotPickle-macOS.zip
PlotPickle-Linux.tar.gz
manifest.json
```

To supply bundled PHP runtimes during packaging, point these variables at complete redistributable runtime folders:

```bash
PLOTPICKLE_WINDOWS_PHP_DIR=/path/to/windows/php \
PLOTPICKLE_MACOS_PHP_DIR=/path/to/macos/php \
PLOTPICKLE_LINUX_PHP_DIR=/path/to/linux/php \
npm run package:local
```

Expected runtime executables:

```text
Windows: runtime/php/php.exe
macOS:   runtime/php/php
Linux:   runtime/php/php
```

PHP binaries are intentionally not committed to the source repository.

## Validation

Run the local server smoke test:

```bash
bash scripts/test-local-runtime.sh
```

It verifies health detection, project saving, project loading, and automatic backup creation. The `PlotPickle Local` GitHub Actions workflow also builds the static edition, runs lint and smoke tests, packages the three developer archives, and uploads them as a workflow artifact.

## Remaining release work

The application plumbing is complete. Public installers still require:

1. approved redistributable PHP runtime builds for each operating system;
2. a Windows `.exe` launcher and signing certificate;
3. a macOS `.app` wrapper, Developer ID signing, and notarization;
4. a Linux AppImage wrapper;
5. final installer testing on clean machines.

## Security

- The server must remain bound to `127.0.0.1`, not `0.0.0.0`.
- Project names are reduced to safe filenames.
- Reads are restricted to the packaged `web` directory.
- Saves use temporary files and atomic renames.
- API keys must never be included in the public browser bundle.
