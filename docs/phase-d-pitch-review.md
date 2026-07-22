# PlotPickle 0.16 — Phase D Pitch and Review Workflows

Phase D connects local review, revision comparison and pitch-package creation to the same canonical PlotPickle project. It does not create a separate notes database or a disconnected presentation file as the source of truth.

## Guided logline workshop

The workshop asks seven concrete questions: protagonist, identity, disruption, goal, opposition, stakes and distinction. PlotPickle assembles a candidate from the writer's answers and existing story fields. Candidates can be saved for comparison, but the canonical story logline changes only when the writer explicitly approves one.

## Local anchored comments

Review threads can anchor to the complete project, a story field, block, flexible scene, screenplay element or character. Anchors use stable project IDs so a thread remains attached when scenes or screenplay elements move. Each thread records priority, local reviewer name, comments, timestamps and a resolution state.

## Review threads and states

Threads move through open, in-review, resolved and deferred states. Replies preserve the discussion and the final decision inside the project. Resolving a thread records the resolution timestamp; reopening it clears that timestamp.

## Revision snapshot comparison

The comparison interface reads any two existing canonical revision snapshots. It reports changed project sections plus added and removed payload paths. Comparison never restores or mutates either revision.

## Pitch Package builder

The builder saves title, subtitle, tagline, approved logline, synopsis, creator statement, audience, comparable titles, visual statement, contact line, selected characters, selected locations and included package sections. It reads the active story, world, rights and visual data rather than copying them into an external system.

## Exports

- **PDF:** a clean browser print layout intended for Save as PDF.
- **HTML:** a self-contained shareable pitch package.
- **Presentation-ready:** a slide-separated Markdown deck outline for presentation software.

## Completion standard

PlotPickle 0.16 passes Phase D when a writer can review the draft, create and resolve anchored comments, compare revisions, approve a logline, assemble a pitch package and create all three shareable export formats without leaving PlotPickle.
