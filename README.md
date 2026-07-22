# PlotPickle Playhouse

PlotPickle is a local-first story-development application built around Bryan Harris’s 24 Blocks method. One canonical project powers the complete hierarchy from story foundation to sequence, block, scene, mini-block, screenplay page, review, and visual board.

Current application version: `0.11.0`

Current project schema: `1.6.0`

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

## Five connected workspaces

- **Instructions** explains the 24 Blocks method and every story column.
- **Story Planner** develops the story foundation, world, characters, Ghost, Catalyst, The Pickle, dialogue system, structure summary, block spine, and notes.
- **Writer** connects three modes to the same 24 Blocks and 96 mini-blocks: a Markdown Treatment editor for developing literature and story prose, a screenplay editor for standard scene headings, action, character cues, parentheticals, dialogue and transitions, and Read & Learn for contextual craft education plus the colour-coded script viewer.
- **Visual Storyboard** moves from the 24-block overview into all 96 mini-block images. Every default prompt is assembled from the current story, scene purpose, mini-block function, assigned characters, locations, visual language, screenplay evidence, shot notes, and continuity. Writers can refine or copy the prompt, generate a landscape frame through the private local AI gateway, and see whole-film completion at a glance.
- **Engines** explains and opens six focused specialist passes.

Every workspace reads and writes the same locally saved project.

The Writer starts with a Markdown treatment section for every mini-block. It includes formatting tools, live preview, section and complete-treatment export, word counts, optional AI cleanup that requires approval, and a deliberate handoff from prose into screenplay action. Treatment text is saved in the canonical local project and can contribute context to later visual-storyboard prompts.

Screenplay mode starts blank for a new movie and uses the existing Story Setup, World, Characters, Ghost, Catalyst, 24 Blocks, 48 scenes and 96 mini-blocks as its writing foundation. Every screenplay element retains its Block and mini-block assignment. The editor estimates page and scene counts, uses screenplay-standard spacing, and exports Fountain and Final Draft FDX; Print / PDF uses the screenplay page layout.

Read & Learn adds a searchable Learning Studio drawn from PlotPickle's screenwriting documentation. Short learning paths cover concept-to-draft, character and inner journey, structure and dramatic questions, scene construction, visual writing, dialogue, subtext, silence, theme, pacing, revision and Markdown. Recommended lessons follow the active Block and mini-block, provide an immediate exercise, and open the correct workspace for application. The educational guidance remains CC BY-SA 4.0; each writer's creative work remains their own.

It also accepts plain-text (`.txt`), Fountain (`.fountain` or `.spmd`), and Final Draft (`.fdx`) files. **Load a screenplay** in Read & Learn and **Import** in the top bar use the same ingestion pipeline. A screenplay creates a fresh active project, replaces the optional Afterglow example, preserves the complete draft, detects the title, speaking characters, locations and scene order, and maps passages into the 24 Blocks, Story Planner, Structure Map, guided questions, and Visual Board directions. Script-derived interpretations are visibly marked as suggestions until the writer reviews and confirms them.

Parsing and the initial structural extraction happen on the local device without AI. The source screenplay is stored in the canonical `.plotpickle.json` project so it travels with the project, while the writer retains ownership of the script. Importing an existing `.plotpickle.json` file still restores that complete saved project.

## Optional AI foundation

PlotPickle's AI layer is provider-independent and local-server mediated. The primary development and live-test target is **ChatGPT / OpenAI API**, using the writer's own API key, while OpenAI-compatible servers, Ollama, manual prompt export, and no-AI operation remain supported choices.

Settings also contains **Reports** and a searchable **Terminology Index**. Reports calculate each character’s dialogue lines, spoken words, scene count, scene list, first and last appearance, and estimated speaking time from the active screenplay so actors can compare roles. The index explains screenplay formatting, structure, character, production, and PlotPickle terms in plain language. Both work locally without AI.

Optional connections remain in **AI Setup**, **Music**, and **Plugins**. Music can store Suno or Udio artist links, including profiles such as Ava Iris. Plugins are reserved for future connectivity and cannot be enabled yet.

The first foundation includes:

- capability-based provider selection instead of hardcoded model assumptions;
- portable knowledge-source contracts and bounded project context packs;
- character identity locks, approved looks, continuity locks, and generation provenance;
- OpenAI Responses and GPT Image adapters;
- compatible-server and Ollama text adapters; and
- a replaceable asynchronous video-job contract.

In the downloaded local edition, a verified API key may be saved in PlotPickle's private local-server data under the current computer account. AI Setup confirms the live connection, records the last successful check, and can test or remove the saved key. API keys are connection secrets, not project data, and are never written into browser settings, exported `.plotpickle.json` files, prompts, logs, or GitHub. OpenAI video is not enabled in the initial preset because the current Sora 2 Videos API is scheduled to shut down on September 24, 2026.

The first live creative actions are available inside the work itself. The Screenplay assistant can suggest material using the current Block, mini-block and character context, but inserts nothing until the writer approves it. Characters can generate a portrait through the connected image model; the local server saves the resulting asset under the current computer account and attaches it as the character reference. OpenAI is the primary tested path, while compatible endpoints and local text models use the same private gateway where their capabilities allow it.

See `docs/ai-architecture.md` for the complete architecture and delivery sequence.

## Guided left-hand story rail

The story rail is grouped into four readable areas.

### Project

- **OV — Project Overview** shows project identity, overall coverage, the next suggested task, structural totals, open questions, and ownership information.

### Foundation

- Story Setup
- Pitch & Vision
- World
- Characters
- Ghost
- Catalyst
- Foundations
- The Pickle
- Dialogue

### Structure

- **ST — Structure Map** summarizes 4 acts, 12 sequences, 24 blocks, 48 scenes, 96 mini-blocks, and the Story Clock before the writer enters the full Structure Engine.
- 24 Blocks

### Production

- Storyboard
- Notes

Each rail item displays a live state:

- `○` not started;
- `◐` in progress;
- `✓` substantially complete; or
- `!` an open question or continuity item needs attention.

## Engines workspace

The guided engine order is:

**Structure → Resonance → Voiceprint → PageFlow → DraftLens → CraftLoop**

- **Structure Engine** expands the spine into 12 sequences, 48 scenes, 96 mini-blocks, beat and shot targets, and a complete Story Clock.
- **Resonance Engine** aligns the central question with character choices, motifs, opening and closing images, and consequences.
- **Voiceprint Engine** develops character-specific speech from history, status, worldview, rhythm, vocabulary, emotion, and pressure.
- **PageFlow Engine** turns planning into visible, active, actor-playable screenplay description.
- **DraftLens Engine** converts reader experience into evidence, root diagnosis, and revision questions.
- **CraftLoop Engine** connects the method into a repeatable deliberate-practice cycle.

The suggested order is not mandatory. Writers may enter whichever engine addresses the current story problem.

## Complete structural hierarchy

**4 Acts → 12 Sequences → 24 Blocks → 48 Scenes → 96 Mini-Blocks → Beats → Shots**

At the original 120-minute preset, the default reference model provides:

- 30 minutes per act;
- 10 minutes per sequence;
- 5 minutes per block;
- 2.5 minutes per scene;
- 75 seconds per mini-block;
- 4 beats and 16 shots per mini-block;
- 384 beat targets and 1,536 shot targets overall; and
- approximately 4.69 seconds average shot length.

These are editable planning references, not mandatory filmmaking rules.

## Project data and migration

New projects use schema `1.6.0`.

Imports from schemas 1.0 through 1.3 are upgraded automatically. Migration preserves existing story, world, character, dialogue, note, screenplay, block, and visual data while creating the 12-sequence, 48-scene, and 96-mini-block hierarchy.

The source of truth is:

- `schema/plotpickle-project.schema.json`
- `lib/project.ts`
- `lib/structure.ts`

## Copyright, ownership, and licences

PlotPickle separates software, instructional material, user work, and brand rights.

### User-created work

Users retain the rights they hold in their original stories, screenplays, characters, dialogue, images, notes, and exported `.plotpickle.json` project files. Using PlotPickle does not transfer that material to Bryan Harris, PlotPickle, a contributor, or a server operator.

### Software

PlotPickle software is licensed under **GNU AGPLv3 or later** (`AGPL-3.0-or-later`). The full licence text is included as `LICENSE`.

### Method and documentation

Unless otherwise marked, the written 24 Blocks method, documentation, diagrams, and reusable non-software instructional material are licensed under **Creative Commons Attribution-ShareAlike 4.0 International** (`CC BY-SA 4.0`).

### Contributions

Contributors retain copyright in their original contributions. By submitting material for inclusion, software contributions are licensed under AGPL-3.0-or-later and documentation or method contributions are licensed under CC BY-SA 4.0.

See:

- `LICENSE`
- `LICENSES.md`
- `NOTICE.md`
- `CONTRIBUTING.md`
- `TRADEMARKS.md`
- `docs/licensing-and-ownership.md`

These project documents provide practical information and are not a substitute for legal advice.

## Self-hosted server editions

PlotPickle’s official distribution remains the downloadable local edition. Downstream users may adapt PlotPickle for compatible server infrastructure, including Plesk or a WordPress-connected architecture, under the applicable licences.

A modified version made available to remote users must prominently offer those users the corresponding source code for that version at no charge, as required by AGPLv3 section 13. Hosted editions must preserve legal notices, identify modifications, respect user ownership, and avoid implying that an unofficial edition is the official PlotPickle service.

A server operator should provide their own privacy and data-retention terms because a hosted edition may store user projects differently from the official local edition.

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

## Brand assets

The PlotPickle Playhouse logo kit is in `public/brand`. Brand assets may not be used to misrepresent an unofficial or modified edition as the official PlotPickle project. See `TRADEMARKS.md`.
