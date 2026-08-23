# Full-product visual audit evidence

Issue #371 adds direct visual evidence to PlotPickle's UI/UX review process.

## Why screenshots are required

Source review, DOM assertions, accessibility checks and Lighthouse-style metrics can confirm many technical properties, but they cannot reliably judge whether the finished interface is visually coherent or easy to understand. PlotPickle therefore captures the rendered application itself so typography, spacing, hierarchy, density, colour, status clarity, discoverability and responsive behaviour can be reviewed directly.

The retired Lighthouse runner is not restored. The capture pipeline uses the same browser technology already trusted by the packaged Windows interaction smoke: a clean Chrome or Edge profile controlled through the Chrome DevTools Protocol.

## What is captured

`config/visual-audit-captures.json` maps every entry in `config/ui-ux-screen-registry.json` to at least one rendered state. The initial registry includes:

- public and startup surfaces;
- the application shell and shared feedback surfaces;
- Dashboard, Learn, Plan, Storyboard, Write, Graphic Novel, Build, Feedback, Refine and Reports;
- Collab, Community and Suggest / Report entry points;
- the Settings overview, Sitemap and every independently configurable component;
- desktop, tablet and mobile viewports.

The capture system stores stable full-page PNG files, a JSON manifest, a Markdown review list, an HTML contact sheet and an identity-validation report.

## Windows capture stability

Very long full-page capture sessions can exhaust or destabilize the native Windows development-server process. `scripts/visual-audit-supervisor.mjs` therefore divides the complete inventory into small isolated batches. Each batch receives a fresh PlotPickle server, a clean browser profile and a bounded screen subset. The supervisor then combines all batch manifests into one complete visual inventory.

Each new batch first opens an internal Dashboard warmup route. This allows the application bundle and workspace-query effect to settle before the first requested screenshot. Without the warmup, the first screen in a fresh batch can briefly render the public splash even when the URL requests Learn, Feedback or Settings.

This isolation prevents one native process failure from erasing later screenshots and makes the exact failing batch visible. The canonical capture and screen registries are restored after every run, including failed runs.

## Screen identity validation

A screenshot existing is not enough. Every capture definition includes a rendered heading that uniquely identifies its intended screen. After all batches complete, `scripts/visual-audit-validate.mjs` verifies every requested viewport and rejects:

- missing screenshots;
- screenshots whose headings do not identify the requested screen;
- the public marketing splash appearing in place of an application workspace;
- silent fallback from a requested Settings component to General.

The validator writes `visual-audit-validation.json` into the artifact. CI does not pass merely because PNG files were produced.

AI Routing uses its real independent `/ai-routing` route. PlotPickle Runtime uses the currently exposed Local Story Mode surface. Plugins and connections currently has no independent destination, so its Sitemap evidence is marked reference-only rather than being misrepresented as a completed component screen. That gap remains visible for follow-up product work.

## Privacy boundary

Each batch uses a temporary PlotPickle home and a clean browser profile. It does not load a user's normal project or browser data. Before each screenshot it clears password and credential-like fields, masks secret-labelled controls and replaces common local user path prefixes. A credential-shaped value remaining in visible text fails the capture.

## Running locally

Install the normal repository dependencies, make Chrome or Edge available, then run:

```text
node scripts/visual-audit-supervisor.mjs . reports/visual-audit
node scripts/visual-audit-validate.mjs config/visual-audit-captures.json reports/visual-audit/visual-audit-manifest.json
```

The default batch size is six capture definitions. It can be adjusted between one and eight with `PLOTPICKLE_VISUAL_BATCH_SIZE`. `CHROME_PATH` or `EDGE_PATH` can point to a browser executable when automatic discovery is insufficient.

The lower-level single-batch runner remains available for diagnosis:

```text
node scripts/visual-audit-capture.mjs . reports/visual-audit-single
```

## CI evidence

The full Visual audit capture workflow runs after interface-related changes land on `main`, and it can also be manually dispatched on a feature branch when a reviewer specifically wants complete visual evidence before merge. It uploads `reports/visual-audit/` as a five-day GitHub Actions artifact.

This keeps the direct visual review capability without making every UI edit wait for a full-product Windows screenshot inventory. Focused source, accessibility, build and workspace-contract checks remain in the pull-request loop; full visual evidence remains part of canonical main validation.

## Review expectations

The reviewer should inspect the screenshots rather than relying only on the manifest. At minimum, review:

- type scale and readable hierarchy;
- alignment, spacing and information density;
- consistency of cards, forms, navigation and actions;
- red, yellow and green status communication;
- visibility of primary actions and recovery paths;
- technical provider language leaking into normal creative workflows;
- desktop, tablet and mobile composition;
- horizontal overflow, clipping, awkward empty space and overly dense surfaces.

Interaction video can be added later for workflows where sequence is essential, but screenshots remain the required baseline because they are deterministic, diffable and easy to inspect individually.
