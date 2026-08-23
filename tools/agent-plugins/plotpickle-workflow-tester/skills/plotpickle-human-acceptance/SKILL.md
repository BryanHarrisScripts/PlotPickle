---
name: plotpickle-human-acceptance
description: Exercise PlotPickle through its rendered UI like a first-time human user, preserve story context across the workflow, and report reproducible PASS, WARN, or FAIL findings with evidence.
---

# PlotPickle human acceptance

Use the Playwright MCP browser tools supplied by this plugin. Test PlotPickle through visible rendered controls only. Do not call internal application functions, mutate storage directly, or bypass the user interface unless a recovery diagnostic explicitly requires inspection.

Read `references/workflow-checklist.md` before starting and use `references/visual-continuity-contract.md` when judging visual consistency.

## Operating rules

1. Test only a disposable acceptance project or the bundled read-only Afterglow example plus a disposable copy.
2. Start from the actual splash page or dashboard at the configured localhost origin.
3. Follow the canonical workflow: Dashboard → Learn → Plan → Storyboard → Write → Edit → Graphic Novel → Build → Feedback → Refine → Reports/Export.
4. At every creative handoff, record the current Project, Act, Block, Scene and Mini-Block when those concepts apply. Treat unexplained context loss as a failure.
5. Prefer semantic navigation from the accessibility snapshot. Use screenshots as visual evidence and for appearance review, not as a substitute for actual interaction.
6. Exercise visible buttons, menus, forms, approval controls, return paths and Settings links as a human would.
7. Do not approve cloud spend, publish externally, mutate GitHub, send mail, or use real credentials. Local AI may be tested only through the product's normal local integration controls.
8. Refresh the browser at designated persistence checkpoints. If the packaged application restart capability is available in the runner, test one restart as well.
9. Capture evidence for failures and important warnings. Include the exact visible control used and the story position where the problem occurred.
10. Finish with a structured report containing PASS, WARN and FAIL findings, reproduction steps, screenshots/artifact names, console/runtime errors and the owning PlotPickle module.

## Human usability standard

Do not merely confirm that a control exists. Judge whether a reasonable new user can understand what the control does, what happens next, where they are in the story and how to recover from a mistake. Flag technically functional flows that are confusing, visually inconsistent, hidden, misleading or unexpectedly destructive.

## Stop conditions

Stop the run and report FAIL if the application leaves the configured local PlotPickle origins unexpectedly, requests a real credential or payment path, risks modifying a non-disposable project, or cannot recover enough story context to continue safely.
