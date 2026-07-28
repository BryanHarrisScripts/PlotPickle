# Issue #169 — Cross-platform open-source splash

## Product message

The PlotPickle splash page presents one complete, local-first film-development studio rather than a collection of disconnected tools. The official edition runs on the writer's own computer and does not require a PlotPickle cloud account.

## Scope lock

Issue #169 and this document are the acceptance contract for PR #173. A change belongs in the PR only when it:

1. satisfies an acceptance criterion in issue #169;
2. corrects a verified factual mismatch with the current `main` branch; or
3. fixes a splash-specific accessibility, responsive-layout or regression-test defect.

The following work remains outside PR #173:

- primary navigation order, containers or active-state presentation;
- Introduction placement inside Learn and Simple Start placement inside Plan;
- Settings information architecture;
- Refine ownership and workspace routing;
- launcher, packaging or release-workflow behaviour; and
- the separate public PlotPickle website.

New ideas belong in their own issue and PR. Existing wording may change only when the locked product meaning remains intact or a verified product change makes the wording inaccurate.

## Release builds

One codebase produces three clean-machine-tested release packages:

- `PlotPickle-Windows.zip` with `Start-PlotPickle.bat`;
- `PlotPickle-macOS.zip` with `Start-PlotPickle.command`; and
- `PlotPickle-Linux.zip` with `start-plotpickle.sh`.

Tagged releases publish all three archives with SHA-256 checksums. All builds expose the same complete product.

## Feature story

The first page connects:

- 81 learning modules and Introduction;
- four acts, twelve sequences, 24 Blocks and 96 mini-blocks;
- treatment, screenplay, complete-script reading and exchange formats;
- character identity locks, Visual Bible, directed shots and 96 storyboard positions;
- the automatic 24-page, 96-panel black-and-white comic pitch deck;
- Build, Feedback, Refine and Reports;
- production planning and readiness evidence;
- portable `.ppf` exchange packages; and
- optional, owner-controlled GitHub Story Proposals.

The current workspace boundary remains explicit: Refine diagnoses and proposes, Feedback owns discussion and approval, and Reports owns read-only summaries.

AI remains optional. Writers can use no AI, their own OpenAI API connection, a compatible or local model, or manual prompt export. Generated work never changes canonical project content without explicit approval.

## Open-source and ownership boundaries

- PlotPickle software is AGPL-3.0-or-later.
- Unless otherwise marked, the 24 Blocks method and reusable documentation are CC BY-SA 4.0 with attribution to Bryan Elgin Harris.
- Contributors and modifications remain documented.
- A writer's original story, screenplay, characters, images, notes and exports remain the writer's work.
- Portable project data, the plugin platform and the SDK reduce vendor lock-in.
