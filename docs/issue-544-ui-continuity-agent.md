# Issue #544 — UI Continuity Agent

The UI Continuity Agent launches beside PlotPickle and the Full Story Builder from `Start-PlotPickle.bat`. It waits for the private local application, uses the existing local Playwright agent runtime to inspect the rendered product and writes one human-readable report to the local PlotPickle reports folder.

## Audit contract

The registered audit covers the canonical Dashboard, Learn, Plan, Storyboard, Write, Edit, Graphic Novel, Build, Feedback, Refine, Reports, Collab, Community and Settings workspaces, representative nested Plan routes, Core Curriculum and AI Routing.

For each applicable screen it checks:

- the shared application shell and canonical navigation;
- the fixed top-left Agent & Settings anchor and its accessible name;
- active-workspace state;
- persistent project, save, progress and status context;
- the matte-black/charcoal, antique-gold and editorial typography shell contract;
- named Back to or Return to destinations on nested and standalone screens;
- shell height, background, border and typography drift from Dashboard.

## Safety and approval boundary

The agent is read-only. It does not click destructive controls, change the active project, edit source files, rewrite CSS, approve generated work, send data or publish anything. It has no automatic fix path. Findings are advisory until a person reviews the report and explicitly approves a separate implementation change.

The report is overwritten on the next audit so one current, human-readable result remains instead of an accumulating collection of machine logs.
