# Issue #85 — PlotPickle product direction foundation

Issue #85 is the product-direction epic for navigation, collaboration, Visual Board behavior, Lighthouse auditing and public product language. This document defines the shared decisions that child issues #86–#90 must use.

## One obvious application

PlotPickle has one main application workspace. **Simple Start** is an optional beginner pathway inside Story Planner, not a mandatory splash screen. A returning writer must be able to open the main workspace in one action.

## Canonical primary navigation

1. Dashboard
2. Instructions
3. Read & Learn
4. Story Planner
5. Screenplay
6. Visual Board
7. Engines
8. Reports
9. Settings

Terminology belongs in Read & Learn. Reports belongs in the primary working navigation. GitHub, AI, music, image, voice and future providers belong under **Settings → Setup**.

## Five selling points

PlotPickle presents exactly five major product advantages:

1. Complete screenplay studio
2. 81-module learning system
3. Visual continuity engine
4. Local-first ownership with optional AI
5. Distributed PlotPickle collaboration

The exact reusable titles and descriptions live in `lib/product-direction.ts`.

## Collaboration model

Every participant uses the same complete PlotPickle product, running either locally or as a private web-based installation. Writer, Director, Producer, Actor and Reviewer are roles within PlotPickle rather than different server editions. One person may hold several roles.

An owner-controlled GitHub film repository carries the canonical `.ppf` project and reviewed proposals. Local work stays local until the user explicitly publishes, proposes or synchronizes it. The owner or maintainer decides what becomes canonical through reviewed merges.

## Storage language

The Dashboard and collaboration features must use explicit verified states rather than a generic “saved” label:

- Local only
- Local project and local images
- Connected to GitHub — unpublished changes
- Synchronized with GitHub
- Remote changes available
- Conflict or review required
- Backup recommended

Project data and binary assets must be reported separately when their protection differs. PlotPickle must never claim synchronization without verifying the local and remote revision.

## Implementation sequence

1. **#87 Navigation cleanup** — establishes Simple Start, Reports, Terminology and Setup placement.
2. **#88 Visual Board navigation** — replaces the inactive general hierarchy with visual-production navigation.
3. **#89 Dashboard and GitHub stories** — uses the shared role and storage-status model.
4. **#90 Front page and collaboration story** — uses the five selling points and corrected server model.
5. **#86 Lighthouse audit** — runs after the route inventory stabilizes, while remaining independently usable during development.

## Completion rule

Issue #85 remains open until #86, #87, #88, #89 and #90 are merged and the application, README, diagrams and public-facing language all use the same product contract.
