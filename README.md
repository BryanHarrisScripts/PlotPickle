# PlotPickle Playhouse

PlotPickle is a local-first story development application built around Bryan Harris's 24 Blocks method. One canonical project object powers connected workspaces for learning the method, planning the story, developing character dialogue, and building the visual board.

Current application version: `0.2.0`

Current project schema: `1.3.0`

## Download the current version

[Download a fresh copy of PlotPickle Playhouse](https://github.com/BryanHarrisScripts/PlotPickle/archive/refs/heads/main.zip)

This link always downloads the current `main` version, so it stays up to date as PlotPickle develops. Because the repository is private, sign in to the GitHub account that has access before downloading.

## Easiest Windows setup

1. Download the current ZIP using the link above.
2. Right-click the downloaded ZIP and select **Extract All**.
3. Open the extracted `PlotPickle-main` folder.
4. Double-click `Start-PlotPickle.bat`.
5. Leave the command window open while using PlotPickle. The browser opens automatically at `http://127.0.0.1:4173`.
6. Press `Ctrl+C` in the command window when finished, then close it.

PlotPickle requires Node.js 22 or newer. If Node.js is missing or too old, the starter explains the problem and opens the official Node.js download page. The first launch installs the required components with `npm ci`; later launches start more quickly.

The command window is PlotPickle's local server. It must remain open while the application is running, and it provides a useful place to see setup or runtime errors.

## Connected workspaces

- **Instructions** explains the four-act, 24-block process.
- **Story Planner** develops the foundation, world, characters, Ghost, Catalyst, The Pickle, dialogue system, and block-by-block cause-and-effect spine.
- **Voiceprint Engine** builds dialogue from character history, social context, knowledge, worldview, rhythm, vocabulary, emotional access, relationships, objectives, and pressure.
- **Visual Board** attaches storyboard frames, prompts, shot notes, performance ideas, and continuity information to the same blocks.

Open the Voiceprint Engine from the floating button inside PlotPickle. It reads and writes the same locally saved project as the main application.

## Project data

Every new project uses schema version `1.3.0`. Import automatically upgrades compatible PlotPickle 1.0, 1.1, and 1.2 project files.

Version 1.3 adds the Voiceprint Engine to the shared story architecture. Each character can now store:

- origin and formative environment;
- social context and status;
- education and expertise;
- worldview and boundaries;
- rhythm and sentence shape;
- vocabulary and metaphors;
- verbal fingerprints;
- emotional access;
- status and relationship shifts;
- persuasion strategy.

The project-wide dialogue system also tracks world vernacular, monologue rules, subtext seeds, exposition rules, recurring language, and an observation library.

The source of truth is documented in `schema/plotpickle-project.schema.json` and typed in `lib/project.ts`. The Voiceprint Engine design is documented in `docs/architecture/voiceprint-engine.md`.

The Pickle defines what the audience keeps trying to solve: the central tension, story promise, expected destination, unpredictable route, competing live answers, escalation pattern, final answer, and signature execution. Every block also records the audience expectation and the clue, reversal, complication, near-answer, or reframe that changes it. See `docs/architecture/the-pickle.md`.

The application autosaves the active project to browser storage. Export produces a readable `.plotpickle.json` file that can be imported into any compatible PlotPickle installation. A valid project contains exactly 24 blocks.

The Afterglow starter project is assembled in `data/afterglow.ts`. It includes the current world, character library, and 21 named storyboard blocks found in the source repository. Blocks 22–24 remain explicitly marked for screenplay reconciliation rather than being filled with invented material.

## Manual local development

Install dependencies and run the local development server:

```bash
npm ci
npm run dev:local -- --host 127.0.0.1 --port 4173
```

Then open `http://127.0.0.1:4173`.

On macOS or Linux, the existing development command can also be used:

```bash
npm ci
npm run dev
```

Run the production checks in a Bash-compatible environment:

```bash
npm run lint
npm run build
npm test
```

## Brand assets

The complete PlotPickle Playhouse logo kit lives in `public/brand`. The horizontal lockup is used by the product page, the icon-only mark is used inside the application, and the favicon, Apple touch icon, and web-app sizes are connected through the site metadata and `public/manifest.webmanifest`.

## Deployment

The application has no required database, account system, or server-side project storage. It can run locally through the included Windows starter and can also be deployed as a standard PlotPickle Site, GitHub Pages adaptation, Plesk application, or another compatible web host.
