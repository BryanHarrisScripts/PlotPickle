# PlotPickle human acceptance workflow checklist

Run from the real rendered application and use visible controls only.

## Start and project safety

- Open PlotPickle at the configured localhost origin.
- Confirm the splash/dashboard loads without blocking console or runtime errors.
- Create a disposable project, or load Afterglow and make a disposable editable copy before changing canon.
- Record project title and initial save state.

## Dashboard

- Confirm project identity, progress/state and workflow navigation are understandable.
- Verify status/health indicators link to the relevant Settings component rather than exposing configuration on the dashboard.
- Confirm no primary creative action requires choosing an AI provider.

## Learn

- Open Learn through visible navigation and return to the main workflow.
- Confirm the four-Act / 24-Block / 96-mini-block method is discoverable without blocking progress.

## Plan

- Create or edit premise/story setup and establish a visible story position.
- Select an Act, Block and Mini-Block that can be followed through downstream modules.
- Record the expected Act / Block / Scene / Mini-Block identity.

## Storyboard

- Continue from Plan using the visible workflow.
- Verify the same story position is preserved.
- Add or inspect visual direction/shot information without changing provider settings.
- Verify return/back paths preserve context.

## Write

- Continue to Write at the same story moment.
- Enter or edit representative screenplay text.
- Confirm screenplay layout remains the canonical text source for that story position.
- Refresh once and verify the text and selected context persist.

## Edit

- Continue to Edit at the same screenplay element.
- Exercise Accept change, Rewrite myself, Ignore and Compare where available.
- Confirm candidate suggestions do not silently replace canon.
- Verify revision/recovery language is understandable.

## Graphic Novel

- Continue at the same Act / Block / Scene / Mini-Block.
- Exercise Keep, Change, Try, Compare and explicit Approve where available.
- Confirm approved Storyboard and screenplay context are reused rather than duplicated.

## Build

- Continue to Build from the approved Graphic Novel/story moment.
- Verify exact story position and source lineage.
- Reorder a candidate sequence if available; confirm canon remains unchanged until explicit approval.
- Approve a disposable sequence and verify source records are not rewritten.
- Test Send back to an owning source module and confirm the exact position survives.

## Feedback

- Open Feedback on the same canonical target.
- Add a disposable feedback item or use an existing fixture.
- Exercise Open / Considered / Deferred / Resolved language.
- Verify feedback never changes source content automatically.
- Continue to Refine and verify feedback ID/target/story position continuity.

## Refine

- Confirm Keep versus Needs Work is obvious.
- Send a Needs Work item back to the correct owning module and verify exact source position.
- Return to Refine and confirm it resolves into the same review item rather than creating a duplicate.
- Require explicit approval before retaining a refined result.

## Reports / Export

- Open Reports/Export as the delivery/readout endpoint.
- Confirm whole-project readiness plus scene, character, location, shot and production outputs are reachable as supported.
- Follow at least one missing/needs-work source-return link and verify context.
- Keep export/download actions visually separate from creative approval.

## Integration/recovery scenarios

When the environment supports them, exercise:
- Ollama missing, installed/not running and running/healthy.
- ComfyUI missing, installed/not running, PlotPickle-started background service and running/healthy.
- Dashboard red/yellow/green status and links to the exact component Settings page.
- No credentials appearing in screenshots, logs or browser snapshots.

## Final evidence

For each major module record PASS, WARN or FAIL. For every WARN/FAIL include:
- module and current story position;
- visible action taken;
- observed result;
- expected human result;
- reproduction steps;
- screenshot/artifact filename when available;
- console/runtime error if relevant;
- suggested owning issue/module.
