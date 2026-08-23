# Issue #177 — Graphic Novel terminology and sequential image queue

## Product terminology

Graphic Novel is now the visible product term on the splash screen, Pitch workspace, progress controls, status messages and exports. Existing internal `comicDeck` project fields and IDs remain readable so older `.ppf` projects migrate without losing generated panels or provenance.

A shared client-side terminology guard updates remaining legacy user-facing labels without renaming unrelated descriptive uses of “comic” or changing canonical storage keys.

## One-at-a-time generation

The Graphic Novel workspace owns a persistent local queue containing all 96 panel positions. The user may queue the whole project, but PlotPickle sends exactly one image-provider request at a time.

Each queue item records only non-secret information:

- project and queue identifiers
- panel identifier and order
- state and attempt count
- timestamps
- generated local asset reference
- sanitized provider error

No API key, access token, refresh token or provider credential is written into queue storage, the project, exports or generated metadata.

## Progress and interruption

The queue shows the current panel, completed count, remaining count, failed count, skipped count and overall progress. Stop aborts the active browser request where possible and always prevents the next queued panel from starting. Completed assets are saved into the project immediately and are never regenerated during resume.

A failed item pauses the queue and presents Retry and Skip actions. Retrying affects only that item. Skipping preserves the rest of the queue and allows generation to resume at the next panel.

## Persistence and project boundary

Queue state is stored locally under a project-specific key. A stored queue whose project ID does not match the active project is rejected and removed. On restart, an interrupted generating item returns to the queued state while completed and skipped decisions are preserved.

## Gateway boundary

The local AI gateway rejects oversized image bodies and concurrent image requests before they reach the provider. The existing provider adapter still fixes `n` to `1`, so PlotPickle does not rely on a provider rejecting a large accepted request.

## Compatibility

The original workspace, pitch-plan engine and AI gateway remain as base modules. Public entry modules add the terminology, queue and single-request boundary while preserving existing import paths and legacy project data.
