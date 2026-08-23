# Issue #85 — PlotPickle product direction

Issue #85 is the product-direction epic for navigation, collaboration, Visual Board behavior, Lighthouse auditing and public product language. Child issues #86–#90 implement one shared product contract.

## One obvious application

PlotPickle has one main application workspace. **Simple Start** is an optional beginner pathway inside Story Planner, not a mandatory splash screen. A returning writer can open the main workspace in one action.

## Canonical primary navigation

1. Dashboard
2. Instructions
3. Learn
4. Plan
5. Write
6. Storyboard
7. Refine
8. Reports
9. Settings

Terminology belongs in Learn (the Read & Learn workspace). Reports belongs in the primary working navigation. GitHub, AI, music, image, voice and future providers belong under **Settings → Setup**.

## Five selling points

PlotPickle presents exactly five major product advantages:

1. Visual storyworld in one PPF
2. Story logic you can see
3. Connected visual development
4. A clearer case for the movie
5. Local-first ownership with optional connections

The exact reusable titles and descriptions live in `lib/product-direction.ts` and are rendered on the Simple Start/front page.

## Collaboration model

Every participant uses the same complete PlotPickle product, running either locally or as a private web-based installation. Writer, Director, Producer, Actor and Reviewer are roles within PlotPickle rather than different server editions. One person may hold several roles.

An owner-controlled GitHub film repository carries the canonical `.ppf` project and reviewed proposals. Local work stays local until the user explicitly publishes, proposes or synchronizes it. Pull requests may carry controlled screenplay edits, character notes, production plans or visual updates. The owner or maintainer decides what becomes canonical through reviewed merges.

## Storage language

The Dashboard and collaboration features use explicit verified states rather than a generic “saved” label:

- Local only
- Local project and local images
- Connected to GitHub — unpublished changes
- Synchronized with GitHub
- Remote changes available
- Conflict or review required
- Backup recommended

Project data and binary assets are reported separately when their protection differs. PlotPickle never claims synchronization without verifying the local and remote revision.

## Completion status

- **#86 — complete and merged:** repeatable Lighthouse whole-application audit and exportable review package.
- **#87 — complete and merged:** primary navigation, Simple Start, Reports, Terminology and Setup cleanup.
- **#88 — complete and merged:** functional visual-production navigation for Visual Board.
- **#89 — complete and merged:** Dashboard foundation, verified repository discovery and storage/synchronization states.
- **#90 — final implementation:** front-page repository link, prominent 81-module learning system, exactly five selling points and corrected complete-installation collaboration diagram.

## Completion rule

The #90 merge completes issue #85 after the application, README, diagram, regression coverage and public-facing language have passed the permanent PlotPickle checks using this same product contract.
