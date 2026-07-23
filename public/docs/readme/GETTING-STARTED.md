PlotPickle Playhouse
====================

This is one selectable tab from the complete PlotPickle README. The canonical root README links all three tabs.

## Official distribution

PlotPickle is officially distributed as a **downloadable local-server application**.

[Download the current PlotPickle Playhouse ZIP](https://github.com/BryanHarrisScripts/PlotPickle/archive/refs/heads/main.zip)

The local edition runs on the user’s own computer and opens in a browser at `http://127.0.0.1:4173`. There is no required PlotPickle cloud account and no official online PlotPickle service.

Because the repository is currently private, sign into the GitHub account that has access before downloading.

## Easiest Windows setup

1. Download the current ZIP.
2. Right-click the ZIP and select **Extract All**.
3. Open the extracted `PlotPickle-main` folder.
4. Double-click `Start-PlotPickle.bat`.
5. Review the installation plan and press **Y** only when a dependency runtime is genuinely required.
6. Leave the command window open while using PlotPickle.
7. Press `Ctrl+C` when finished, then close the command window.

PlotPickle requires Node.js 22.13 or newer. The first successful launch installs a reusable dependency runtime under the current Windows user’s local application-data folder. Later launches and matching future downloads reconnect to that runtime instead of installing all packages again.

The command window is PlotPickle’s private local server. Closing it stops the application. The launcher binds to `127.0.0.1`, so the default local edition is available only on that computer.

## Easy upgrades without reinstalling everything

Application files and installed packages are separated:

- replaceable PlotPickle program files remain in the extracted folder;
- reusable packages live under `%LOCALAPPDATA%\PlotPickle\runtimes\<dependency fingerprint>`;
- npm downloads are cached under `%LOCALAPPDATA%\PlotPickle\npm-cache`;
- browser-stored story projects remain outside the program folder.

### Recommended routine upgrade

1. Close PlotPickle and its local-server command window.
2. Double-click `Update-PlotPickle.bat` inside the existing PlotPickle folder.
3. Download the current ZIP through the signed-in browser.
4. Return to the updater and select the ZIP.
5. The updater replaces managed program files while preserving the runtime and local settings.
6. Choose whether to start the upgraded PlotPickle immediately.

A downloaded ZIP can also be dragged directly onto `Update-PlotPickle.bat`.

The launcher fingerprints `package-lock.json`. When the fingerprint matches an installed runtime, PlotPickle starts without running npm. A new dependency runtime is created only when the dependency fingerprint changes or the current runtime is damaged.

See `docs/windows-upgrades.md` for the complete upgrade and recovery guide.

## Transparent guided installer

Before any packages are downloaded, the Windows launcher displays:

- PlotPickle, Node.js, and npm versions;
- the dependency fingerprint;
- every requested top-level package and version;
- the application folder, persistent runtime, and npm cache;
- current disk space and a recommended 2 GB free-space allowance;
- a Y/N consent prompt only when installation is needed;
- visible installation and repair progress; and
- a final **SUCCESS** report with verified versions and actual dependency size.

The launcher does not request Administrator rights, install a Windows service, add itself to startup, disable Windows Security, or upload the active story project.

## Manual local development

```bash
npm ci
npm run dev:local -- --host 127.0.0.1 --port 4173
```

Then open `http://127.0.0.1:4173`.

Run production checks in a Bash-compatible environment:

```bash
npm run lint
npm run build
npm test
```


## Windows security warning

See [`docs/windows-publisher-warning.md`](../../../docs/windows-publisher-warning.md) for the Unknown Publisher explanation, the ZIP **Unblock** steps and the long-term signed-launcher plan.
