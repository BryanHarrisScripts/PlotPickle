# Updating PlotPickle on Windows

PlotPickle 0.7.1 introduces an in-place upgrade path. You no longer need to delete the PlotPickle directory or reinstall every npm package after each update.

## One-time transition

If your current PlotPickle folder does not contain `Update-PlotPickle.bat`, download and extract PlotPickle 0.7.1 once. Keep that extracted folder as your permanent PlotPickle installation.

From that point onward, do not delete the folder for routine upgrades.

## Routine upgrade

1. Close PlotPickle and its local-server command window.
2. Download the latest PlotPickle ZIP from the official GitHub repository.
3. Leave the ZIP in Downloads; do not extract it manually.
4. Double-click `Update-PlotPickle.bat` inside your existing PlotPickle folder.
5. Select the newly downloaded ZIP when the file window opens.
6. Wait for the updater to report `SUCCESS - PLOTPICKLE PROGRAM FILES UPDATED`.
7. Double-click `Start-PlotPickle.bat`.

## What is preserved

The updater replaces application source files while preserving:

- `node_modules`, which contains the already-installed local components;
- `.plotpickle`, which contains the dependency fingerprint;
- the npm cache managed by npm;
- browser-stored PlotPickle projects;
- exported `.plotpickle.json` files stored outside the program folder.

The updater also leaves `.git`, build output, and temporary development folders alone when present.

## What happens after an upgrade

`Start-PlotPickle.bat` fingerprints `package-lock.json` and compares it with the fingerprint saved after the last successful installation.

### Program-only update

When the lock file has not changed, PlotPickle verifies Vite and starts immediately. npm does not reinstall packages.

### Dependency update

When the lock file changed, PlotPickle explains that an upgrade is required and asks for confirmation. It runs `npm install --prefer-offline`, reusing the existing `node_modules` folder and npm cache wherever possible.

### Missing or damaged installation

When the required packages are missing or damaged, the launcher falls back to the full two-step installation and repair process.

## Why the updater asks for a ZIP

The PlotPickle repository is private. A script cannot anonymously download its contents. The user downloads the ZIP while signed into GitHub, then the local updater safely applies it to the permanent installation folder.

## Project safety

PlotPickle projects are saved in browser storage and may also be exported as `.plotpickle.json`. Routine program upgrades do not erase browser storage.

Before major operating-system work or browser resets, export important projects as an additional backup.
