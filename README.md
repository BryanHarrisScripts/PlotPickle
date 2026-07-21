# PlotPickle Playhouse

PlotPickle is a local-first story development application built around Bryan Harris's 24 Blocks method. One canonical project object powers connected workspaces for learning the method, planning the story, aligning meaning, developing dialogue, writing visible screenplay action, reviewing the whole draft, and building the visual board.

Current application version: `0.5.0`

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

PlotPickle requires Node.js 22.13 or newer. If Node.js is missing or too old, the starter explains the problem and opens the official Node.js download page. The first launch installs the required components with `npm ci`; later launches start more quickly.

The command window is PlotPickle's local server. It must remain open while the application is running, and it provides a useful place to see setup or runtime errors.

## Connected workspaces

- **Instructions** explains the four-act, 24-block process.
- **Story Planner** develops the foundation, world, characters, Ghost, Catalyst, The Pickle, dialogue system, and block-by-block cause-and-effect spine.
- **Resonance Engine** turns the central story question into a pattern of character choices, opening and closing images, block turns, motifs, locations, subtext, and consequences without reducing the screenplay to a slogan.
- **Voiceprint Engine** builds dialogue from character history, social context, knowledge, worldview, rhythm, vocabulary, emotional access, relationships, objectives, and pressure.
- **PageFlow Engine** turns block plans into visible, active, actor-playable, economical screenplay description and provides revision signals for invisible information, weak phrasing, dense paragraphs, emotion labels, and unnecessary directing language.
- **DraftLens Engine** reviews the whole screenplay through story question, character, structure, page experience, dialogue, and surprise lenses, then turns reader experience into root diagnoses, evidence and revision questions.
- **Visual Board** attaches storyboard frames, prompts, shot notes, performance ideas, and continuity information to the same blocks.

Open DraftLens, Resonance, Voiceprint, and PageFlow from the floating engine buttons inside PlotPickle. All four read and write the same locally saved project as the main application.

## Resonance Engine

Resonance is an alignment and diagnostic layer, not a second theme database. It uses existing canonical project fields:

- `story.dramaticQuestion` for the difficult question the screenplay tests;
- `story.theme` and `story.antiTheme` for the working answer and credible counter-answer;
- `development.pitch.audiencePromise` and `emotionalExperience` for the reason to tell the story and the desired audience aftertaste;
- `story.hook` and `story.ending` for the opening and closing image bracket;
- character wants, needs, ghosts, and arcs as competing dramatic arguments;
- `block.emotionalTurn`, `setup`, `payoff`, and `pickleTurn` for block-level pressure, seeds, evidence, and audience reframes;
- `world.visualLanguage`, dialogue subtext, and recurring language for visual, spatial, behavioural, and verbal motifs.

The Resonance alignment signal measures coverage, not artistic quality. Ambiguity, contradiction, irony, silence, and justified exceptions remain valid creative choices.

The complete design is documented in `docs/architecture/resonance-engine.md`.

## PageFlow Engine

PageFlow is a diagnostic and revision layer, not a second screenplay database. It uses the existing canonical project fields:

- `block.scriptExcerpt` for the page-ready action or scene draft;
- `block.storyboardDirection` for the visible sequence and image progression;
- `block.goal`, `conflict`, `action`, `consequence`, and `emotionalTurn` for causal context;
- `character.description` for the character entrance and concise first impression;
- `block.notes` for revision decisions and unresolved PageFlow questions;
- `block.visuals` for the corresponding Visual Board images.

The PageFlow draft signal is an editorial prompt, not a grade. It highlights phrases worth inspecting while allowing justified exceptions for voiceover, genre, formal experimentation, and necessary shot design.

The complete design is documented in `docs/architecture/pageflow-engine.md`.

## DraftLens Engine

DraftLens is a whole-draft review and feedback layer, not an automated rewrite system or a second notes database. It organizes existing project evidence through six diagnostic lenses:

- story question and stakes;
- character want, need, Ghost, fatal flaw, and arc;
- structure, cause, choice, consequence, pacing, and pattern;
- page clarity, momentum, and visual evidence;
- dialogue distinction, subtext, status, and exposition;
- audience expectation, surprise, and distinctive execution.

It uses the existing project notes fields deliberately:

- `development.notes.general` for first-read observations;
- `development.notes.revisions` for root diagnosis and revision priorities;
- `development.notes.openQuestions` for questions that preserve multiple possible solutions;
- `development.notes.continuity` for supporting evidence;
- `development.notes.research` for craft references and comparisons;
- `development.notes.sources` for readers, drafts, dates, table reads, and feedback sources;
- `block.notes` for the selected block's review evidence.

DraftLens follows a diagnosis-before-prescription rule. It asks what the reader experienced, where the evidence appears, what deeper story function may be causing it, and which question could help the writer discover the strongest repair.

The complete design is documented in `docs/architecture/draftlens-engine.md`.

## Project data

Every new project uses schema version `1.3.0`. Import automatically upgrades compatible PlotPickle 1.0, 1.1, and 1.2 project files.

Version 1.3 added the Voiceprint Engine to the shared story architecture. Each character can store:

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

Application version 0.4 added the Resonance Engine without changing the project schema. Application version 0.5 adds DraftLens using the existing project notes, story, character, block, dialogue, and Pickle fields. Existing 1.3 projects remain compatible without migration.

The source of truth is documented in `schema/plotpickle-project.schema.json` and typed in `lib/project.ts`. The Voiceprint Engine design is documented in `docs/architecture/voiceprint-engine.md`.

The Pickle defines what the audience keeps trying to solve: the central tension, story promise, expected destination, unpredictable route, competing live answers, escalation pattern, final answer, and signature execution. Every block also records the audience expectation and the clue, reversal, complication, near-answer, or reframe that changes it. See `docs/architecture/the-pickle.md`.

The application autosaves the active project to browser storage. Export produces a readable `.plotpickle.json` file that can be imported into any compatible PlotPickle installation. A valid project contains exactly 24 blocks.

The Afterglow starter project is assembled in `data/afterglow.ts`. It includes the current world, character library, and 21 named storyboard blocks found in the source repository. Blocks 22–24 remain explicitly marked for screenplay reconciliation rather than being filled with invented material.

## Connected production chain

**Plan the cause → test the idea → shape the voice → write the page → review the draft → preserve the image.**

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
