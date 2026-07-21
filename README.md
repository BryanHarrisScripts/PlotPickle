# PlotPickle Playhouse

PlotPickle is a local-first story development application built around Bryan Harris's 24 Blocks method. One canonical project powers the complete hierarchy from story foundation to sequence, block, scene, mini-block, screenplay page, review, and visual board.

Current application version: `0.7.3`

Current project schema: `1.4.0`

## Download the current version

[Download a fresh copy of PlotPickle Playhouse](https://github.com/BryanHarrisScripts/PlotPickle/archive/refs/heads/main.zip)

This link always downloads the current `main` version. Because the repository is private, sign in to the GitHub account that has access before downloading.

## Easiest Windows setup

1. Download the current ZIP.
2. Right-click the ZIP and select **Extract All**.
3. Open the extracted `PlotPickle-main` folder.
4. Double-click `Start-PlotPickle.bat`.
5. Review the installation plan and press **Y** only when a dependency runtime is genuinely required.
6. Leave the command window open while using PlotPickle. The browser opens at `http://127.0.0.1:4173`.
7. Press `Ctrl+C` when finished, then close the command window.

PlotPickle requires Node.js 22.13 or newer. The first successful launch installs a reusable dependency runtime under the current Windows user's local application-data folder. Later launches and matching future downloads reconnect to that runtime instead of installing all packages again.

The command window is PlotPickle's private local server. It must remain open while the application is running. Closing it stops PlotPickle.

## Easy upgrades without reinstalling everything

Beginning with PlotPickle 0.7.2, application files and installed packages are separated:

- replaceable PlotPickle program files remain in the extracted folder;
- reusable packages live under `%LOCALAPPDATA%\PlotPickle\runtimes\<dependency fingerprint>`;
- npm downloads are cached under `%LOCALAPPDATA%\PlotPickle\npm-cache`;
- browser-stored story projects remain outside the program folder.

### Recommended routine upgrade

1. Close PlotPickle and its local-server command window.
2. Double-click `Update-PlotPickle.bat` inside the existing PlotPickle folder.
3. The updater opens the current GitHub ZIP download in your signed-in browser.
4. After the download finishes, return to the updater and select the ZIP.
5. The updater validates the package, replaces managed program files, preserves the runtime and local settings, and displays a success message.
6. Choose whether to start the upgraded PlotPickle immediately.

A downloaded ZIP can also be dragged directly onto `Update-PlotPickle.bat`.

### What happens on the next start

The launcher fingerprints `package-lock.json`:

- if the fingerprint matches an installed runtime, PlotPickle starts without running npm;
- if an older folder already contains a complete local `node_modules`, the launcher moves it into the persistent runtime once and reuses it thereafter;
- if the dependency fingerprint changed, PlotPickle creates one new runtime and installs only that new dependency set;
- older fingerprinted runtimes remain separate, allowing an older PlotPickle version to reconnect to its matching packages.

Deleting and re-extracting the PlotPickle program directory no longer forces a first-time package installation when the same dependency fingerprint is already present. Keeping one permanent folder and using the updater is still the fastest and cleanest workflow.

The repository is private, so the updater uses the authenticated browser download rather than attempting an anonymous background download.

See `docs/windows-upgrades.md` for the complete upgrade and recovery guide.

## Transparent guided installer

The Windows launcher explains the setup before anything is downloaded. It displays:

- PlotPickle, Node.js, and npm versions;
- the package-lock dependency fingerprint;
- every top-level package and requested version;
- the replaceable application folder;
- the persistent dependency runtime and npm cache;
- currently available disk space;
- a recommended minimum of **2 GB free space** for a new runtime;
- an estimated first-runtime working requirement of about **1.5 GB**;
- a Y/N consent prompt only when installation is needed;
- visible installation and repair progress;
- a final **SUCCESS** report with installed versions and actual dependency size.

The launcher does not request Administrator rights, install a Windows service, add itself to startup, disable Windows Security, or upload the active story project. It binds to `127.0.0.1`, the private loopback address for the current computer only.

## Windows setup recovery

The launcher detects interrupted or incomplete dependency runtimes and:

1. verifies that Vite and the core packages are truly installed;
2. retries `npm ci` inside the fingerprinted persistent runtime;
3. falls back to `npm install` so cached packages can be reused;
4. refuses to start the server until Vite passes validation.

For repeated `ECONNRESET` or `EPERM` errors:

1. confirm the internet connection is stable;
2. confirm at least 2 GB of space is free;
3. close other PlotPickle, Node, npm, editor, and terminal windows;
4. run `Start-PlotPickle.bat` again;
5. use `Repair-PlotPickle.bat` if the current fingerprinted runtime remains damaged.

`Repair-PlotPickle.bat` resets only the runtime required by the current `package-lock.json`. It does not delete application files, browser-stored projects, exported `.plotpickle.json` files, or runtimes used by other PlotPickle versions.

## Connected workspaces

- **Instructions** explains the four-act, 24-block method.
- **Story Planner** develops the story foundation, world, characters, Ghost, Catalyst, The Pickle, dialogue system, and block spine.
- **Structure Engine** expands the spine into 12 sequences, 48 scenes, 96 mini-blocks, beat and shot targets, and a complete Story Clock.
- **Resonance Engine** aligns the central question with character choices, motifs, opening and closing images, and consequences.
- **Voiceprint Engine** develops character-specific speech from history, status, worldview, rhythm, vocabulary, emotion, and pressure.
- **PageFlow Engine** turns planning into visible, active, actor-playable screenplay description.
- **DraftLens Engine** reviews the whole draft and converts reader experience into evidence, root diagnosis, and revision questions.
- **CraftLoop Engine** connects the entire method into a repeatable deliberate-practice cycle.
- **Visual Board** attaches storyboard frames, prompts, shot notes, performance ideas, and continuity to the same project.

Every workspace reads and writes the same locally saved project.

## Engines workspace

**Engines** is the fourth top-level menu item beside Instructions, Story Planner, and Visual Board. It replaces the former floating button stack with a guided overview of all six specialist engines.

Before entering a specialist screen, each engine card explains:

- the story problem the engine is designed to solve;
- the best time to use it;
- the canonical project information it works with;
- the expected result of the pass;
- where it belongs in the recommended development sequence.

The suggested path is **Structure → Resonance → Voiceprint → PageFlow → DraftLens → CraftLoop**, but writers may enter whichever engine addresses the current problem.

## Structure Engine

Version 0.7 restores the complete timed hierarchy beneath the 24 Blocks method:

**4 Acts → 12 Sequences → 24 Blocks → 48 Scenes → 96 Mini-Blocks → Beats → Shots**

### Twelve sequences

Each act contains three sequences and each sequence contains two blocks. The editable starting progression is:

1. Awakening
2. Discovery
3. Alliance
4. Conflict
5. Struggle
6. Pivot
7. Apex
8. Turn
9. Reveal
10. Fallout
11. Mending
12. Legacy

Each sequence records its question, promise, escalation, climax, turning point, result, block pair, and target runtime.

### Forty-eight scenes

Every block begins with two scene containers:

- Scene 1 establishes the block objective and develops the first pressure.
- Scene 2 deepens the conflict, forces action or choice, and creates the block consequence.

The scene records are flexible. They can represent two full screenplay scenes, two movements, or containers for several shorter scenes.

### Ninety-six mini-blocks

Each block contains four mini-blocks:

1. Promise
2. Progress
3. Pressure
4. Payoff

Each mini-block can store purpose, active character, objective, resistance, action, revelation, turn, entry and exit states, visual beat, dialogue intention, setup, payoff, notes, duration, beat target, and shot target.

### Original two-hour preset

At 120 minutes, the default model produces:

- 30 minutes per act;
- 10 minutes per sequence;
- 5 minutes per block;
- 2.5 minutes per scene;
- 75 seconds per mini-block;
- 4 beats and 16 shots per mini-block;
- 16 beats and 64 shots per block;
- 384 beat targets and 1,536 shot targets overall;
- an average shot length of approximately 4.69 seconds.

These values are reference targets, not requirements. Every mini-block timing, beat target, and shot target remains editable.

### Story Clock

The Story Clock calculates start time, end time, duration, beats, and shots for every sequence, block, scene, and mini-block.

Changing the project runtime and selecting **Rebalance full timeline** changes duration allocations only. It does not overwrite story, dialogue, screenplay, or visual content.

The complete design is documented in `docs/architecture/structure-engine.md`.

## Project data and migration

New projects use schema `1.4.0`.

Imports from PlotPickle 1.0, 1.1, 1.2, and 1.3 are upgraded automatically. Migration:

- preserves all existing story, world, character, block, dialogue, note, screenplay, and visual data;
- creates twelve sequence records;
- assigns blocks to sequences in pairs;
- creates two scene records per block;
- creates four mini-block records per block;
- calculates the initial Story Clock from the project target runtime.

The source of truth is:

- `schema/plotpickle-project.schema.json`
- `lib/project.ts`
- `lib/structure.ts`

## Specialist engines

### Resonance Engine

Resonance uses the dramatic question, theme, anti-theme, audience promise, opening and closing images, character arcs, block turns, visual language, and dialogue motifs. Its alignment signal measures coverage, not artistic quality.

See `docs/architecture/resonance-engine.md`.

### Voiceprint Engine

Voiceprint stores each character's origin, social context, expertise, worldview, sentence shape, vocabulary, verbal fingerprints, emotional access, status shifts, and persuasion strategy while retaining a concise scene-ready voice rule.

See `docs/architecture/voiceprint-engine.md`.

### PageFlow Engine

PageFlow uses `block.scriptExcerpt`, `storyboardDirection`, block cause-and-effect fields, character descriptions, notes, and visuals. Its diagnostic signal highlights language worth inspecting without treating exceptions as errors.

See `docs/architecture/pageflow-engine.md`.

### DraftLens Engine

DraftLens reviews story question, character, structure, page experience, dialogue, and surprise. It separates reader experience, evidence, root cause, and revision questions.

See `docs/architecture/draftlens-engine.md`.

### CraftLoop Engine

CraftLoop coordinates audience game, opening contract, scene turn, character pressure, observed voice, page compression, pitching, and comparative craft study.

See `docs/architecture/craftloop-engine.md`.

## Connected production cycle

**Plan the story → organize the sequence → build the scene → turn the mini-block → test the idea → shape the voice → write the page → review the draft → practise the craft → preserve the image → repeat.**

## Manual local development

```bash
npm ci
npm run dev:local -- --host 127.0.0.1 --port 4173
```

Then open `http://127.0.0.1:4173`.

Run the production checks in a Bash-compatible environment:

```bash
npm run lint
npm run build
npm test
```

## Brand assets

The PlotPickle Playhouse logo kit is in `public/brand`. The horizontal lockup is used by the product page, the icon-only mark is used inside the application, and favicon and web-app sizes are connected through the site metadata and manifest.

## Deployment

PlotPickle has no required database, account system, or server-side project storage. It can run locally through the Windows launcher or be adapted for another compatible web host.
