# Updating PlotPickle on Windows

PlotPickle 0.7.2 separates replaceable application files from reusable npm dependencies. Routine upgrades no longer require deleting the program directory or reinstalling every package.

## Storage model

PlotPickle now uses three separate locations:

1. **Application folder** — the extracted PlotPickle source files and Windows launchers.
2. **Persistent dependency runtimes** — `%LOCALAPPDATA%\PlotPickle\runtimes\<package-lock fingerprint>`.
3. **Persistent npm cache** — `%LOCALAPPDATA%\PlotPickle\npm-cache`.

The application folder can be updated or replaced. Matching future versions reconnect to the runtime created for the same `package-lock.json` fingerprint.

## One-time transition from an older installation

Run the new `Start-PlotPickle.bat` once from PlotPickle 0.7.2 or later.

When the existing folder contains a complete local `node_modules`, the launcher attempts to move it into the persistent runtime and creates a Windows directory junction from the application folder to that runtime. This is a one-time migration; the packages are not downloaded again.

If Windows has the old folder locked, close PlotPickle, Node, npm, editor, and terminal windows, then run the launcher again.

## Recommended routine upgrade

1. Close PlotPickle and its local-server command window.
2. Double-click `Update-PlotPickle.bat` inside the current PlotPickle folder.
3. The updater opens the current ZIP download in the signed-in browser.
4. Wait for the ZIP download to finish, return to the updater, and press Enter.
5. Select the downloaded ZIP in the file window.
6. The updater validates that the ZIP contains the official `plotpickle` package.
7. It replaces managed application files while preserving local configuration and the persistent runtime.
8. When the success message appears, choose whether to start PlotPickle immediately.

A ZIP may also be dragged directly onto `Update-PlotPickle.bat`.

## What the updater preserves

The updater preserves:

- every runtime under `%LOCALAPPDATA%\PlotPickle\runtimes`;
- the persistent npm cache;
- browser-stored PlotPickle projects;
- exported `.plotpickle.json` files;
- `.env`, `.env.local`, and environment-specific local configuration files;
- user-owned `projects`, `exports`, `user-data`, and `backups` folders;
- a local update-history log under `%LOCALAPPDATA%\PlotPickle`.

The updater does not copy or redownload `node_modules`.

## What happens after an upgrade

`Start-PlotPickle.bat` calculates a fingerprint from `package-lock.json`.

### Matching dependency fingerprint

When a matching persistent runtime exists and passes verification, PlotPickle starts immediately. npm does not run.

This also works after deleting and freshly extracting the application folder because the runtime is outside that directory.

### New dependency fingerprint

When package requirements genuinely change, PlotPickle creates a separate runtime for the new fingerprint. It first uses `npm ci` with the persistent cache, then falls back to `npm install` if an interrupted download requires repair.

The previous runtime remains separate so an older PlotPickle version can reconnect to its matching packages.

### Missing or damaged runtime

Run `Repair-PlotPickle.bat`.

The repair command removes only the runtime selected by the current `package-lock.json` fingerprint, recreates its connection, and launches the normal guided installer. It does not delete other version runtimes or story projects.

## Why the updater asks for a ZIP

The PlotPickle repository is private. The updater opens the official ZIP URL in the user's authenticated browser and then asks the user to select the downloaded archive. It does not require a GitHub token or store GitHub credentials.

## Project safety

PlotPickle projects are stored in browser storage for `http://127.0.0.1:4173` and may also be exported as `.plotpickle.json` files. Updating or replacing the program folder does not erase that browser storage.

Before browser resets, Windows reinstallation, or major operating-system work, export important projects as an additional backup.
