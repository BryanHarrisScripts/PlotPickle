# PlotPickle Local

PlotPickle Local runs the same browser interface from a private PHP server on the user's own computer. It is intended to complement—not replace—the hosted PlotPickle demo.

## Editions

| Edition | Entry point | Intended release package |
| --- | --- | --- |
| Windows | `PlotPickle.bat` initially; compiled launcher later | `PlotPickle-Windows.zip` or signed installer |
| macOS | `PlotPickle.command` initially; `.app` wrapper later | `PlotPickle-macOS.dmg` |
| Linux | `plotpickle.sh` initially; AppImage wrapper later | `PlotPickle-Linux.AppImage` |

All editions use the same web bundle and `local/server/router.php`. Only the launcher and bundled PHP runtime differ.

## Local capabilities

The PHP runtime listens only on `127.0.0.1:48721` and provides:

- `GET /__plotpickle/health` — confirms that PlotPickle is running locally.
- `GET /__plotpickle/projects` — lists local `.plotpickle.json` projects.
- `GET /__plotpickle/project?name=...` — opens a local project.
- `PUT /__plotpickle/project?name=...` — saves a project atomically.
- Automatic timestamped backups, retaining the latest 20 backups per project.

User data is stored beside the application:

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

## Build a package

The local package builder expects a static browser bundle containing `index.html`:

```bash
bash scripts/package-local.sh path/to/static-bundle
```

It produces platform folders under `releases/local/`.

Before distributing them publicly, add the appropriate PHP runtime:

```text
Windows: runtime/php/php.exe
macOS:   runtime/php/php
Linux:   runtime/php/php
```

PHP binaries are intentionally not committed to the repository.

## Current integration boundary

The existing hosted build produces an OpenAI Sites Worker artifact rather than a directly servable static folder. The local runtime and packaging layer are complete, but the app still needs a dedicated static-export build and a small client bridge that sends autosaves to the local API when `/__plotpickle/health` is available.

Until that bridge lands, the local package can serve a static PlotPickle build but the hosted application continues using browser storage and JSON export/import.

## Security

- The server must remain bound to `127.0.0.1`, not `0.0.0.0`.
- Project names are reduced to safe filenames.
- Reads are restricted to the packaged `web` directory.
- Saves use temporary files and atomic renames.
- API keys must never be included in the public browser bundle.
