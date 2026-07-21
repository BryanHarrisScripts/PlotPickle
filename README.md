# PlotPickle Playhouse

PlotPickle is a local-first story development application built around Bryan Harris's 24 Blocks method. Instructions, Story Planner, and Visual Board all work from the same project file.

## Download and run on Windows

No installation, Node.js, PHP, or development software is required.

1. [Download the latest PlotPickle Windows ZIP](https://github.com/BryanHarrisScripts/PlotPickle/releases/latest/download/PlotPickle-Windows.zip).
2. Open the downloaded ZIP and choose **Extract all**.
3. Open the extracted `PlotPickle-Windows` folder.
4. Double-click `START-PLOTPICKLE.bat`.
5. Leave the PlotPickle Local Server window open while you work. Closing it stops PlotPickle safely.

PlotPickle opens in your normal web browser, but the application runs privately on your computer at `127.0.0.1`. Your projects are saved in `data/projects`, and automatic backups are stored in `data/backups`.

To move to a newer copy, close PlotPickle and copy the entire `data` folder from your old PlotPickle folder into the new one before starting it.

The full local-edition guide and troubleshooting notes are in [LOCAL.md](LOCAL.md).

## Three connected workspaces

- Instructions explains the four-act, 24-block process.
- Story Planner develops the foundation, world, characters, audience tension, dialogue, block-by-block cause and effect, and scene-level dramatic movement.
- Visual Board attaches storyboard frames, prompts, shot notes, and continuity information to the same blocks.

## Project data

Every project uses schema version `1.5.0`. Version 1.5 adds Scene Lab as the fourteenth shared story column: Story Setup, Pitch & Vision, World, Characters, Ghost, Catalyst, Foundations, The Pickle, Act I Launch, Dialogue, 24 Blocks, Scene Lab, Storyboard, and Notes. Project files from versions 1.0–1.4 upgrade automatically during import.

The Pickle defines what the audience keeps trying to solve. Act I Launch checks whether Blocks 1–6 establish enough world, cast, pressure, feeling, and choice to carry the remaining story. Opening Move designs the audience's first contact through an entry strategy, first signal, and seven effects: Anchor, Grip, Compass, Question, Imprint, Echo, and Handoff.

Scene Pulse is the micro-structure engine inside Scene Lab. Every block can contain any number of scene cards. Each card tracks a Pressure Lock, Cut Line, Character Proof, Value Flip, Focus Signal, and Handoff so the scene begins under active pressure, reveals character through choice, changes meaning or value, and makes the next movement necessary. See `docs/architecture/scene-pulse.md` for the full design.

The canonical schema is in `schema/plotpickle-project.schema.json`; the TypeScript model and migration logic are in `lib/project.ts`.

The application also supports readable `.plotpickle.json` export and import. A valid project contains exactly 24 blocks.

The Afterglow starter includes an original Scene Pulse example for Amy's opening BBT evaluation. Blocks 22–24 remain explicitly marked for screenplay reconciliation rather than being filled with invented material.

## Brand assets

The complete PlotPickle Playhouse logo kit lives in `public/brand`. Production favicon, Apple touch icon, web-app icons, stacked logos, and horizontal website headers are included.

## Development

Development software is needed only when changing PlotPickle itself.

```bash
npm ci
npm run dev
```

Run the production and local-edition checks with:

```bash
npm run lint
npm run build
npm run build:local
bash scripts/test-local-runtime.sh
npm run package:local
```

The packaged Windows build includes its own verified PHP runtime. Third-party runtime binaries are downloaded and checksum-verified by GitHub Actions; they are not committed to the source repository.
