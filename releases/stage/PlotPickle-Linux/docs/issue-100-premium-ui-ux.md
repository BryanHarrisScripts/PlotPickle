# Issue #100 — Premium UI/UX consistency

PlotPickle uses one shared visual and interaction language across the marketing splash, application shell and primary workspaces.

## Startup

The marketing splash opens first. It presents five current product components—Learn, Plan, Write, Storyboard and Refine—using original PlotPickle SVG illustrations. The installed workspace remains one action away.

## Primary shell

The primary menu is centred at desktop widths and becomes a horizontal, scrollable navigation control when space is limited. The PlotPickle logo always returns to the splash page. Project identity and save state remain in the shared project strip.

## Project health

Dashboard status follows one semantic contract:

- Green: ready, complete, connected or healthy.
- Yellow: incomplete, requires attention, review or setup.
- Red: missing, failed, blocked or critical.

Colour is never the only signal. Each status includes a symbol, a written status and explanatory text.

## Long workspaces

Long or multi-purpose screens use a left-hand section navigator when that reduces scrolling and improves orientation. Dashboard and Reports establish the reusable pattern; existing Story Planner, Instructions and Settings navigation continue the same approach.

## Premium design system

`app/premium-ui.css` owns the shared application tokens for surfaces, borders, typography colour, focus, shadows, status colours, spacing and responsive behaviour. Workspace-specific styles may extend these tokens but should not introduce a conflicting visual language.

## Accessibility and behaviour

Keyboard focus remains visible. Navigation keeps semantic labels and active states. Responsive layouts collapse without hiding essential controls. Project storage, screenplay editing, imports, exports, reports, learning, storyboard, engines and settings continue to use the canonical PlotPickle project model.
