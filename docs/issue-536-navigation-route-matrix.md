# Issue 536 navigation depth and return matrix

## Governing contract

The visible workflow order is Dashboard → Learn → Plan → Storyboard → Write → Edit → Graphic Novel → Build → Feedback → Refine → Reports. Settings remains a separate application control. All story handoffs preserve the same local PPF project and, where supplied, Act → Block → Scene → Mini-Block context.

The PlotPickle brand is an application exit from the current workspace. It returns to Dashboard. The marketing splash is not a workspace return destination.

## Visible route matrix

| Start | Visible descent | Required return | Preserved context |
| --- | --- | --- | --- |
| Learn | Complete Learning Library → Core Curriculum → lesson | Back to Learn / Complete Learning Library | project, learning progress, lesson evidence |
| Plan | Structure Map → full Structure Engine | Back to Plan | project, Structure Map section, Block/mini-block query |
| Storyboard | selected story moment → Write | Back to Storyboard or named source moment | project, Block, mini-block |
| Write | selected story moment → Edit | Back to Write N.N | project, Block, mini-block, screenplay scene |
| Graphic Novel | selected panel/moment → Build or Edit | Back to Graphic Novel N.N | project, Block, mini-block, selected source |
| Build | selected source → Feedback | Back to Build N.N | project, source target |
| Feedback | anchored record → Refine | Back to Feedback / source owner | project, feedback target |
| Refine | Diagnostic Queue → diagnostic tool | Back to Refine | project, diagnostic owner |
| Reports | report metric → exact workspace target | Return to named report | project, report section |
| Settings | modes overview → Local/Writers’ Room/Cloud setup | Back to modes | project, settings state |
| Any workspace | PlotPickle brand | Dashboard | active project |

## Compatibility contract

Current `?workspace=<public name>` links and older `?workspace=1&tab=<internal id>` links must resolve to the same workspace. Plan `section`, Block `block`, mini-block `mini`, and Write `view` parameters hydrate the named visible destination rather than opening a generic page.

## Visual contract

The route is not accepted merely because it functions. Every current top-level workspace and standalone tool reached through these paths must stay inside the approved matte-black/charcoal surface, muted antique-gold trim, thin-border, editorial/typewriter typography and compact-control system. Red/yellow/green status meaning remains unchanged.
