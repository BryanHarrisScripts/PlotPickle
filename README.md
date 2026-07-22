# PlotPickle Playhouse

## PlotPickle 0.14 — Diagnostic Craft Layer

PlotPickle now diagnoses story function rather than only storing story description. Open `/diagnostics` for Act I Launch, Opening Move, Scene Pulse, Story Thread overlays, the Setup/Payoff/Reflection Ledger, Character Arc checkpoints, and chronology-versus-presentation views. The same focused findings appear inside Structure, Writer and DraftLens.

PlotPickle is a local-first story-development application built around Bryan Harris’s 24 Blocks method. One canonical project powers the complete hierarchy from story foundation to sequence, block, flexible scene plan, mini-block, screenplay page, review, and visual board.

Current application version: `0.14.0`

Current released project schema: `1.7.0`

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

When a new version is available, download the new ZIP, extract it, and run `Update-PlotPickle.bat` from the new folder. The updater copies the new application files over the existing installation while preserving the reusable runtime, projects, settings, and saved API connection.

If PlotPickle stops launching correctly, run `Repair-PlotPickle.bat`. Repair resets only the current reusable dependency runtime and leaves projects and settings intact.

## Local-first privacy

Projects remain on the user's computer unless they explicitly export or share them. Optional AI connections run through PlotPickle's private local gateway. API keys are kept outside story project files, exports, prompts, logs, browser storage, and GitHub.

## Project files

PlotPickle currently exports `.plotpickle.json` projects using canonical schema 1.7. These files include story foundations, characters, world, flexible scenes, screenplay elements, Story Threads, Character Arc Matrices, rights and provenance, and revision snapshots.

A future portable `.ppf` project package and optional GitHub collaboration layer are tracked separately so they can build on this stable model without changing local-only use.
