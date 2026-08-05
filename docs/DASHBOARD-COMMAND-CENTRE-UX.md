# Dashboard command-centre UX audit

Issue: #355  
Programme: #336

## Dashboard boundary

Dashboard is a read-only status and navigation surface. It can explain the loaded story, summarize workflow readiness, show connection health and direct the writer to the exact workspace or Settings section that owns a problem. It does not collect credentials, choose providers, edit endpoints, select models or perform component configuration.

The writer should be able to answer four questions within five seconds:

1. Is the current project safe and ready to continue?
2. Which local, example or GitHub-backed story is actually loaded?
3. Which connection or workflow needs attention?
4. What is the single most useful next action?

## Audited flow

The command centre follows one predictable reading order:

1. overall readiness and one recommended action;
2. exact project source and working-copy state;
3. included and optional connection status, with handoff to the owning Settings section;
4. semantic workflow progress and direct continuation;
5. actionable warning list or an explicit all-clear empty state;
6. concise project snapshot.

## Status and loading rules

- Green means ready or verified.
- Yellow means setup, testing or review is required.
- Red means unavailable, failed or structurally critical.
- Colour is always paired with a symbol and plain-language status.
- Local-service and Buzz checks begin in an explicit `Checking live connections…` state.
- Saved status remains visible while live checks run; fallback text is not presented as a settled result until the check completes.
- The connection section exposes `aria-busy`, and its status summary is announced politely.

## Accessibility and interaction

- Dashboard section navigation is a labelled navigation landmark with visible keyboard focus.
- Readiness changes and project-source changes use polite status announcements without wrapping interactive controls in live regions.
- Each workflow meter is a semantic progress bar with a label, current value, minimum, maximum and readable value text.
- Every connection action names the component whose Settings page will open.
- Touch targets are at least 44 pixels where primary navigation or actions are involved.
- Reduced-motion and forced-colour modes preserve meaning, focus and borders.
- Anchored sections use scroll margins so sticky application chrome does not cover their headings.

## Data and credential safety

All calculations continue to use the canonical project, shared connection snapshot and local health APIs. No second Dashboard data store was added. Credentials, tokens, provider choices and model configuration remain outside project files and outside Dashboard controls.
