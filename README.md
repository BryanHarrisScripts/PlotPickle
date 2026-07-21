# PlotPickle

PlotPickle is a local-first story development application built around Bryan Harris's 24 Blocks method. One canonical project object powers three connected workspaces:

- Instructions explains the four-act, 24-block process.
- Story Planner develops the foundation, world, characters, and block-by-block cause-and-effect spine.
- Visual Board attaches storyboard frames, prompts, shot notes, and continuity information to the same blocks.

## Project data

Every project uses schema version `1.4.0`. Version 1.4 adds Opening Move inside Act I Launch while preserving the shared story column—Story Setup, Pitch & Vision, World, Characters, Ghost, Catalyst, Foundations, The Pickle, Act I Launch, Dialogue, 24 Blocks, Storyboard, and Notes. Project files from versions 1.0–1.3 upgrade automatically during import. The source of truth is documented in `schema/plotpickle-project.schema.json` and typed in `lib/project.ts`.

The Pickle defines what the audience keeps trying to solve: the central tension, story promise, expected destination, unpredictable route, competing live answers, escalation pattern, final answer, and signature execution. Every block also records the audience expectation and the clue, reversal, complication, near-answer, or reframe that changes it. See `docs/architecture/the-pickle.md` for the full design.

Act I Launch treats Blocks 1–6 as the foundation the remaining story must carry. Its launch contract and twelve flexible signals check world rules, cast orientation, opposition, audience tension, emotional stakes, and the irreversible choice into Act II. The functions matter more than rigid placement; an intentional omission should identify what stronger choice replaces it. See `docs/architecture/act-one-launch.md` for the full design.

Opening Move strengthens Block 1 without adding another story column. It designs the audience's first contact through an entry strategy, first signal, and seven effects: Anchor, Grip, Compass, Question, Imprint, Echo, and Handoff. See `docs/architecture/opening-move.md` for the full design.

The application autosaves the active project to browser storage. Export produces a readable `.plotpickle.json` file that can be imported into any PlotPickle installation. A valid project contains exactly 24 blocks.

The Afterglow starter project is assembled in `data/afterglow.ts`. It includes the current world, character library, and 21 named storyboard blocks found in the source repository. Blocks 22–24 remain explicitly marked for screenplay reconciliation rather than being filled with invented material.

## Brand assets

The complete PlotPickle Playhouse logo kit lives in `public/brand`. The horizontal lockup is used by the product page, the icon-only mark is used inside the application, and the supplied favicon, Apple touch icon, and web-app sizes are connected through the site metadata and `public/manifest.webmanifest`.

## Development

Install dependencies and run the development server:

```bash
npm ci
npm run dev
```

Run the production checks:

```bash
npm run lint
npm run build
```

## Deployment

The application has no required database, account system, or server-side storage. It can be deployed as a standard PlotPickle Site and the same source can later be adapted for GitHub Pages, Plesk, or another static/web host.
