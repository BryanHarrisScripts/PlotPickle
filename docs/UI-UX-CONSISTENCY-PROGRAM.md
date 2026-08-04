# PlotPickle UI/UX Consistency Program

Programme issue: #336  
Foundation issue: #337

## Purpose

PlotPickle must feel like one product across every public surface, workflow, collaboration area and Settings screen. The program uses one focused issue and pull request per screen or tightly coupled screen family so changes remain understandable, testable and reversible.

The canonical queue lives in `config/ui-ux-screen-registry.json`. A screen moves from `planned` to `in-progress` when its issue and branch are opened, and to `audited` only after its pull request is merged and the registry records the merged PR number.

## Shared page anatomy

Every application screen should present the same hierarchy unless the task requires a documented exception:

1. application shell and active destination;
2. page title and concise purpose statement;
3. project or system context;
4. primary action, followed by secondary actions;
5. task content grouped into predictable sections;
6. status, validation and recovery guidance near the affected control;
7. optional help without obscuring the main task.

Primary actions should not move unpredictably between screens. Destructive and paid actions must be visibly distinct, explain consequences and require deliberate confirmation.

## Dashboard and Settings boundary

The Dashboard is a car-dashboard view of PlotPickle availability. It shows red, yellow and green status, a concise explanation and a link to the responsible Settings screen.

The Dashboard must not contain component configuration forms, API keys, endpoints, model selectors, account authorization controls or repair workflows. Those belong in independent Settings screens for Ollama, ComfyUI, Buzz, OpenAI, MiniMax, GitHub, Google, storage and other configurable components.

Status semantics are fixed:

- **Green:** ready or connected;
- **Yellow:** attention or setup required;
- **Red:** unavailable or error.

Colour never carries meaning alone; each status includes text and accessible semantics.

## Required review dimensions

Every screen audit addresses all applicable dimensions from the registry.

### Visual system

- typography, spacing, radii, borders, shadows and colour tokens;
- page headers, cards, sections, tables, forms, toolbars and empty states;
- consistent information density and readable line length;
- no unexplained hard-coded visual values when shared tokens exist.

### Interaction states

- default, hover, focus, active, selected and disabled;
- loading, empty, success, warning and error;
- confirmation and progress for destructive, costly or long-running actions;
- actionable recovery guidance rather than generic failure text.

### Responsive layout

- wide desktop, narrow desktop/tablet and mobile widths;
- no horizontal overflow, clipped controls or inaccessible off-screen actions;
- stable reading order and touch targets;
- safe-area and reduced-motion support.

### Keyboard and accessibility

- logical tab order and visible focus;
- native semantic controls wherever possible;
- valid headings, labels, descriptions, relationships and live feedback;
- useful alternative text for meaningful images;
- status meaning available without relying on colour alone.

### Data preservation

- screen refreshes and plan rebuilds do not replace completed user work;
- navigation does not silently discard edits;
- destructive actions state exactly what will be removed;
- credentials remain outside projects and rendered evidence.

## Per-screen workflow

1. Open a focused issue linked to #336.
2. Mark the registry entry `in-progress` and record the issue number.
3. Document the current user journey and concrete problems.
4. Implement the smallest coherent screen improvement.
5. Add focused regression tests for the screen contract and its critical states.
6. Run lint, build, the complete test suite, UI/UX Code Audit, Phase 1 validation, public/security gates and release-candidate packaging.
7. Merge only when all required checks are green and GitHub reports the PR mergeable.
8. Mark the registry entry `audited`, record the merged PR number and close the screen issue.

## Pull request evidence

Each screen PR should include:

- the linked programme and screen issues;
- the intended user flow;
- before/after problems described in plain language;
- focused test coverage;
- responsive, keyboard and state-matrix verification;
- screenshots or deterministic rendered evidence when available;
- any documented exception to the shared contract.

## Completion

The program is complete when every registry entry is `audited`, every entry records a merged PR, and a final verification PR confirms that navigation, page hierarchy, actions, cards, forms, statuses, feedback and recovery guidance remain consistent across PlotPickle.
