# Issue #550 — Poster and image production slice

This slice adds the first bounded visual-production worker to the PlotPickle Production Supervisor.

## What it does

- discovers the Visual Production Agent from the local supervisor;
- launches the worker from `Start-Production-Supervisor.bat` and keeps its result window visible;
- finds the newest completed Full Story Builder PPF through PlotPickle's existing local project APIs;
- checks the image route already selected in Settings;
- when local ComfyUI is selected and generation-ready, creates one missing poster/key-art candidate and one missing story-image candidate;
- saves generated media through the existing `/api/local-ai/generate/image` path, so returned files are copied into PlotPickle local asset storage;
- attaches the story image to its existing Block / mini-block storyboard identity;
- attaches poster/key art as a schema-safe project asset with explicit `unreviewed` approval state and provenance;
- saves the same PPF with a rolling backup;
- keeps exact prompts and route-specific recovery guidance when generation fails;
- updates the supervisor coverage audit so schema-safe poster candidates are reported as `Needs review` rather than missing.

## Boundaries

- No generated image is automatically approved as canon.
- Local ComfyUI may run only when it is already the selected, ready image route.
- There is no local-to-cloud fallback.
- OpenAI or MiniMax image generation remains blocked unless exact per-job paid consent matches the bounded request count.
- The worker does not install software, expose provider credentials, publish, send messages, or modify collaboration permissions.
- This slice does not implement video/animatic production; that is delivery step 4 of #550.
