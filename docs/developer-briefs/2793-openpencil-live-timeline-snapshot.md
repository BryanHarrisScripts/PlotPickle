# Developer Brief — #2793 live Timeline → OpenPencil design bridge

## Human outcome

`OpenPencil open Timeline` should open an editable visual that starts from the Timeline the Human is actually using in PlotPickle, rather than a nearly empty design scaffold.

## Architecture

The authenticated PlotPickle browser is the design source because it owns the Human's current local profile and story state. WebMCP remains an isolated synthetic verification observer and must not inherit private Human cookies, credentials or story data.

The browser-side Timeline capture is bounded by `config/openpencil-design-snapshot.json`:

- root: `[data-dashboard-review-surface="timeline"]`;
- ready signal: `[data-timeline-assembly="previs-media"]`;
- maximum 900 rendered nodes;
- maximum 1.5 MB HTML and 50 KB supplemental CSS;
- runtime tags such as script/style/link/meta/template are excluded;
- computed visual styles and rendered geometry are flattened into a static editable design snapshot.

The Command flow asks the dashboard host to reveal the real Timeline, waits for the governed ready selector, captures that live rendered subtree, and posts the bounded snapshot through the existing authenticated `/api/openpencil/gui` boundary.

The pinned OpenPencil 0.15.1 CLI imports the HTML/CSS snapshot to a new `timeline-live.fig` target. The prior `timeline.fig` scaffold is intentionally left untouched. Once `timeline-live.fig` exists, PlotPickle never silently overwrites it; subsequent `OpenPencil open Timeline` commands open the Human-edited design.

If no live snapshot is supplied on a clean target, the existing `.pen` bootstrap remains the explicit fallback.

## WebMCP role

WebMCP continues using its synthetic Human/storage-state path. It independently proves the governed Timeline can be navigated and inspected with the same rendered-surface techniques already used by Visual Director: ready selectors, `page.evaluate()`, `getComputedStyle()`, geometry evidence and screenshots. It is verification authority, not a source of private Human story data.

## Acceptance

- Timeline capture comes from the rendered Human product surface.
- Snapshot scope/size is deterministic and bounded.
- OpenPencil imports the snapshot through its pinned CLI into `timeline-live.fig`.
- Existing Human design files are never overwritten.
- The old scaffold remains untouched and bootstrap-only.
- WebMCP isolation is preserved.
- The Windows Settings Command/OpenPencil lane executes the #2793 regression.
- Exact-head Architecture Verification is green before merge.
