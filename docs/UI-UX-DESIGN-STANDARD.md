# PlotPickle Human-Centered UI/UX Design Standard

Status: Proposed operational standard  
Issue: #1713  
Applies to: product UI, desktop application shell, workspaces, forms, agent surfaces, boards, dashboards, dialogs, navigation, generated UI and future AI-assisted interface work.

## 1. Purpose

PlotPickle is a deep creative system. The interface must make that depth feel understandable rather than expose all of it at once.

This standard exists to make PlotPickle obvious, calm, predictable, efficient, resilient and difficult to misuse while preserving the underlying story architecture, agents, workflows, routes and provider flexibility.

This is a normative product standard, not a mood board. Human engineers, AI coding agents, reviewers and automated UI gates are expected to use the same rules.

When an older screen, component or test conflicts with this standard, the older rule must be reviewed deliberately rather than copied automatically.

## 2. Product design doctrine

Every PlotPickle screen should answer five questions quickly:

1. Where am I?
2. What am I working on?
3. What is the most important thing I can do here?
4. What happened after I acted?
5. What should I do next?

If a screen cannot answer those questions without explanation, the screen is not finished.

### Core rules

- One screen, one primary purpose.
- One visually dominant primary action whenever the view expects task completion.
- Do not display complexity merely because the system supports it.
- Preserve project and task context across navigation.
- Prefer familiar interaction patterns over novel controls.
- Make state visible. Never make the user guess whether something saved, loaded, failed or is still running.
- Put advanced, destructive and rarely used controls behind progressive disclosure.
- Reuse components and interaction patterns before inventing new ones.
- Brand styling must never reduce readability, accessibility or discoverability.
- AI-generated UI follows the same rules as human-authored UI.
- Design for failure, latency, sparse data, extreme data, zoom, localization and interruption, not only the ideal screenshot.
- A redesign must remove or consolidate old UI debt rather than layer a second system on top.

## 3. Cognitive foundations

### Fitts's Law

Important and frequent actions must be easy to acquire with pointer, touch or keyboard input.

PlotPickle rules:

- Normal interactive controls use generous hit targets.
- The product target is at least 44 x 44 CSS pixels for common clickable/tappable controls, matching `--pp-touch-target: 2.75rem`.
- Adjacent independent targets should normally have at least 8px separation.
- A visible icon may be smaller than 44px, but its interactive hit area should meet the target contract.
- Destructive actions are spatially separated from the primary action.
- Tiny icon-only actions must not be used to save space at the expense of usability.

WCAG 2.2 Success Criterion 2.5.8 defines a 24 x 24 CSS pixel minimum target size at AA, with documented exceptions. PlotPickle intentionally adopts the stronger 44 x 44 product standard for normal controls.

### Hick's Law

Decision time rises as the number and complexity of choices rise.

PlotPickle rules:

- Do not present the entire capability map as equal-weight choices.
- No ordinary view should expose more than seven top-level interactive choices simultaneously.
- Workflow choices beyond that baseline use progressive disclosure: grouped navigation, submenus, tabs, drawers, accordions or contextual controls.
- Secondary actions belong in menus, inspectors, drawers, disclosure panels or contextual toolbars.
- A screen with many equally prominent buttons fails hierarchy review even if every action is technically useful.

### Miller's Law

People process information more effectively when it is chunked into manageable groups.

PlotPickle rules:

- Group related information into meaningful sections.
- Prefer roughly 5-9 items per visible conceptual block as a working guideline, not a hard scientific limit.
- Long curricula, scene lists, agent lists and story structures require hierarchy, grouping, search, filtering or collapsible sections rather than one uninterrupted list.

### Jakob's Law

Users bring expectations from software they already know.

PlotPickle rules:

- Buttons look and behave like buttons.
- Tabs behave like tabs.
- Sidebars, inspectors, dialogs, breadcrumbs, search, menus and forms follow familiar desktop/web patterns.
- Do not invent lore-specific interaction mechanics when a standard control communicates the function better.
- PlotPickle personality belongs in language, illustration, texture and selective detail rather than unfamiliar mechanics.

## 4. Reference systems

Use established systems to resolve design questions, not to import an unrelated visual theme.

- Material Design 3: layout systems, interaction states, accessibility and cross-platform patterns.
- Apple Human Interface Guidelines: clarity, navigation, platform familiarity and input behavior.
- Nielsen Norman Group: usability research, cognitive load, progressive disclosure and interaction patterns.
- shadcn/ui: composable application component structure.
- Tailwind UI/Tailwind Plus: proven application shells, forms, lists and responsive patterns.

PlotPickle retains its own visual language and token system.

## 5. Progressive disclosure

PlotPickle is powerful enough that progressive disclosure is mandatory.

Show what is needed for the current task first. Reveal specialized configuration only when requested or contextually required.

### Level 1 — Current task

- task title;
- essential context;
- content being worked on;
- one primary action;
- the few secondary actions required to finish.

### Level 2 — Task tools

- contextual editing tools;
- filters;
- alternative views;
- supporting metadata;
- normal secondary actions.

### Level 3 — Advanced controls

- provider selection;
- model tuning;
- technical diagnostics;
- raw metadata;
- experimental controls;
- rarely changed preferences.

### Level 4 — System administration

- credentials;
- destructive maintenance;
- developer diagnostics;
- migration or repair tools.

A first-time user must be able to complete normal story work without seeing Levels 3 or 4.

## 6. Information architecture and navigation

PlotPickle currently has fourteen canonical workflow/destination identities:

Dashboard, Community, Wyrmwood, Learn, Plan, Build, Storyboard, Previs, Write, Edit, Feedback, Refine, Reports and Settings.

These may remain canonical routes and workflow identities. They must not automatically remain fourteen equal-weight visible navigation choices.

### Navigation contract

- Preserve route identity and deep-link compatibility.
- Group related destinations into a smaller set of recognizable top-level areas.
- Keep active project context visible while moving between workspaces.
- Use selected navigation, a page title and, where useful, breadcrumb/context path.
- Keep Settings as a utility destination, not a creative workflow step.
- Keep agent access available but subordinate to the current creative task unless the agent itself is the task.
- Avoid duplicate navigation controls leading to the same place under different names.
- Contextual links should take users directly to the relevant destination rather than forcing them to remember where a feature lives.

### Continuity consequence

The existing UI Continuity Agent currently validates an exact navigation order. Before navigation is simplified, presentation-specific assertions must be updated deliberately so grouped navigation is not treated as a regression.

The route model and story workflow can remain stable while the presentation becomes simpler.

## 7. Screen anatomy

Every primary workspace follows a predictable hierarchy.

1. Global shell
   - product identity;
   - current project/context;
   - high-level grouped navigation;
   - utility access.

2. Workspace header
   - clear screen title;
   - concise purpose or status;
   - primary action when applicable.

3. Main work surface
   - current creative object or task;
   - maximum useful space;
   - no decorative panel competing with the work.

4. Contextual tools
   - inspector, supporting panel, filters or agent help only when relevant.

5. Feedback/status layer
   - save state;
   - generation state;
   - success/error messages;
   - background activity affecting the task.

## 8. Enforceable action hierarchy

| Action level | Maximum visible per decision context | Required treatment |
| --- | ---: | --- |
| Primary | Exactly 1 on action-bearing views | Solid/high-emphasis treatment, strongest contrast, prominent position, outcome-oriented verb label |
| Secondary | 1-3 | Outline, ghost or neutral treatment; visually quieter than primary |
| Tertiary | As needed, but grouped | Text link, menu item or icon action; must not compete with task completion |
| Destructive | Only when relevant | Subdued by default; danger treatment at point of decision; explicit confirmation for irreversible/high-impact actions |

A read-only status view may have zero primary actions. Any view that expects the user to complete a task must have exactly one visually dominant primary action.

### Primary actions

- One per decision context.
- Use a specific verb describing the outcome where possible.
- Never style multiple actions as equally primary.
- If disabled, expose the reason when it is not obvious.
- Do not place destructive actions immediately beside the primary action without separation.

### Secondary actions

- Support the same task.
- Remain visually quieter.
- More than three visible secondary actions requires grouping or progressive disclosure unless an expert-workspace exception is documented.

### Tertiary actions

- Use text, menus or icon actions.
- Icon-only controls require an accessible name and normally a tooltip.
- Repeated row-level tertiary actions should use one consistent overflow or contextual-action pattern.

### Destructive actions

- Never use normal primary-action styling before the user has chosen the destructive path.
- Label the object and consequence plainly, for example `Delete scene` rather than `Confirm`.
- Use an alert/confirmation dialog for irreversible or high-impact deletion, overwrite, purge, reset or destructive migration.
- Confirmation dialogs use the actual destructive verb and `Cancel`, not `Yes`/`No`.
- The destructive confirmation action is never the default-focused control.

## 9. Normative design-token schema

The source of truth is `app/design-tokens.css`. New UI must consume shared semantic tokens rather than define independent palettes, spacing systems, radii, shadows or motion rules.

The values are mirrored here so human engineers and AI agents have an enforceable contract. If `app/design-tokens.css` changes intentionally under an approved design-system issue, this section must change in the same PR.

```css
:root {
  /* Canvas and surfaces */
  --pp-matte: #070707;
  --pp-surface: #0b0b0a;
  --pp-surface-raised: #10100e;
  --pp-surface-hover: #15130e;

  /* Text */
  --pp-paper: #eee8dc;
  --pp-text: #e9e0d0;
  --pp-muted: #aaa296;
  --pp-dim: #777168;

  /* Brand and interaction */
  --pp-teal: #22bfae;
  --pp-teal-bright: #45d7c7;
  --pp-teal-deep: #0f776e;
  --pp-orange: #ff7a3d;
  --pp-orange-bright: #ffad73;

  /* Truthful status only */
  --pp-success: #4f8d68;
  --pp-warning: #ff9b57;
  --pp-danger: #a9574f;

  /* Boundaries and focus */
  --pp-line: rgba(34, 191, 174, 0.22);
  --pp-line-strong: rgba(34, 191, 174, 0.48);
  --pp-focus: rgba(34, 191, 174, 0.32);

  /* Typography */
  --pp-font-display: var(--font-geist-mono), "Courier New", "Lucida Console", Consolas, monospace;
  --pp-font-body: var(--font-geist-mono), "Courier New", "Lucida Console", Consolas, monospace;
  --pp-font-code: var(--font-geist-mono), "Courier New", Consolas, monospace;
  --pp-text-xs: 0.6875rem;
  --pp-text-sm: 0.8125rem;
  --pp-text-md: 0.9375rem;
  --pp-text-lg: 1.125rem;
  --pp-leading-tight: 1.15;
  --pp-leading-body: 1.6;
  --pp-tracking-label: 0.075em;

  /* Four-pixel spacing grid */
  --pp-space-1: 0.25rem;
  --pp-space-2: 0.5rem;
  --pp-space-3: 0.75rem;
  --pp-space-4: 1rem;
  --pp-space-5: 1.25rem;
  --pp-space-6: 1.5rem;
  --pp-space-8: 2rem;
  --pp-space-10: 2.5rem;
  --pp-space-12: 3rem;

  /* Controls and readable widths */
  --pp-control-height-sm: 2rem;
  --pp-control-height-md: 2.5rem;
  --pp-control-height-lg: 3rem;
  --pp-touch-target: 2.75rem;
  --pp-icon-sm: 1rem;
  --pp-icon-md: 1.25rem;
  --pp-icon-lg: 1.5rem;
  --pp-width-reading: 46rem;
  --pp-width-editor: 72rem;
  --pp-width-board: 96rem;
  --pp-width-inspector: 22rem;

  /* Shape and motion */
  --pp-radius-control: 2px;
  --pp-radius-panel: 2px;
  --pp-shadow: none;
  --pp-motion-fast: 120ms;
  --pp-motion-standard: 180ms;
}
```

### Token enforcement rules

- No new page-local HEX, RGB, HSL or named product colours when a semantic token exists.
- Exceptions are limited to authored media, generated art, data visualizations requiring a distinct scale, and documented migration code.
- No second spacing scale.
- Layout gaps, padding and margins use the four-pixel token system; normal component spacing prefers 8px multiples.
- Avoid arbitrary Tailwind values such as `mt-[13px]` or `bg-[#123456]` for product UI.
- Do not create screen-specific radius, shadow or font systems.
- One-pixel structural hairlines and intrinsic media dimensions are allowed where semantically appropriate.
- High-contrast and reduced-motion modes continue to resolve through shared tokens.

### 60 / 30 / 10 composition guideline

Use as a composition guide, not literal screen arithmetic:

- approximately 60% neutral canvas/background;
- approximately 30% secondary surfaces and structure;
- approximately 10% accent, state and action emphasis.

Teal or orange used everywhere ceases to function as emphasis.

### Colour meaning

- Teal: PlotPickle identity, selection and constructive emphasis.
- Orange: focus and important action where defined by the component contract.
- Green: truthful success only.
- Warning token: truthful caution only.
- Danger/red: destructive, unavailable or failed state only.
- State is never communicated through colour alone.

### Typography

The current token system maps display, body and code roles to the PlotPickle mono/typewriter family. Long-form lessons, help and dense reading may move to a dedicated body face only through an approved token-level change. Screens do not choose their own font stacks.

Readability outranks visual lore.

## 10. Component architecture

PlotPickle uses a small composable component vocabulary.

### Core component families

- App shell
- Workspace header
- Button and icon button
- Link
- Tabs
- Breadcrumb/context path
- Sidebar/navigation group
- Command/search
- Card only where a real content boundary exists
- List/item row
- Form field
- Select/combobox
- Checkbox/radio/switch
- Dialog/alert dialog
- Drawer/sheet/inspector
- Tooltip
- Toast/status message
- Alert banner
- Empty state
- Skeleton
- Error state
- Progress/status indicator
- Table/data grid for genuinely tabular data
- Agent conversation primitives

### AI component rule

Before creating a new component, an AI agent must check in order:

1. Does an existing PlotPickle component already solve this?
2. Can existing components be composed to solve it?
3. Is there an established shadcn/Material/Apple/Tailwind pattern that fits?
4. Only then: is a new PlotPickle-specific component justified?

A new component requires a clear interaction reason, not merely a different appearance.

## 11. Five mandatory UI states

Every new or altered data-driven component explicitly supports all applicable states.

### Ideal state

- clear hierarchy;
- expected controls;
- obvious current state;
- obvious next action.

### Empty state

- explain what belongs here;
- explain why it matters in one short sentence;
- provide one useful first action;
- never leave a dead empty panel.

### Loading state

- use skeletons when content shape is known;
- preserve layout to reduce movement;
- show meaningful progress text for long AI operations;
- never present a blank panel as if the app froze;
- use a spinner only when skeleton/progress treatment is not more informative.

### Partial state

- treat existing content as valid;
- make the missing next step obvious;
- do not visually punish incomplete stories/projects;
- do not use fake placeholder content that could be mistaken for saved work.

### Error state

- say what failed in plain language;
- preserve user work whenever possible;
- say whether saved data is affected;
- provide a local `Retry` or other useful recovery action when retry is safe;
- expose technical details behind disclosure when useful;
- never make a raw error code the primary message;
- never require a full-page reload merely to retry a recoverable operation.

A PR introducing a new data-driven surface without all applicable states is incomplete.

## 12. Affordance and feedback

Every interactive control visibly communicates that it can be interacted with.

- Clickable elements use recognizable interactive styling.
- Plain paragraph text is not clickable without link treatment.
- Icon-only controls require an accessible name and normally a tooltip.
- Disabled controls look disabled and remain understandable.
- Drag handles look draggable.
- Resizable panels expose a visible or discoverable resize affordance.

After an important action, immediately show changed state, progress, success or actionable error.

Saving, generating, exporting, switching projects and invoking agents must never fail silently.

## 13. Accessibility contract

Target: WCAG 2.2 AA minimum, with stricter PlotPickle defaults where practical.

### Required behavior

- Normal text contrast is at least 4.5:1 unless a valid WCAG exception applies.
- Large text contrast is at least 3:1.
- Applicable meaningful UI components and graphical boundaries meet WCAG non-text contrast requirements.
- Keyboard focus is visible and not obscured by sticky UI.
- Normal workflows are operable by keyboard.
- Semantic HTML is preferred before ARIA.
- Form fields have programmatic labels.
- Errors are identified in text, not colour alone.
- Reduced motion is respected.
- Forced-colour/high-contrast modes preserve meaning.
- Browser zoom and text enlargement do not destroy the workflow.
- The normal application remains usable at 200% browser zoom without clipped task-critical content or controls.
- Dynamic status messages use appropriate live/status behavior without wrapping entire interactive regions in live regions.

### ARIA rules

- Native semantic elements are mandatory when they already provide the required role and keyboard behavior.
- An icon-only interactive control must have a valid accessible name through visible text, `aria-label`, `aria-labelledby` or another semantic naming source.
- Do not add redundant `aria-label` when visible text already gives the correct accessible name unless a specific accessibility need requires it.
- `aria-labelledby` and `aria-describedby` references must resolve to real IDs.
- Error/help text uses `aria-describedby` when association is necessary for comprehension.
- Dynamic non-interactive status messages use an appropriate status/live pattern.
- Do not add redundant roles to native controls.
- Do not make non-interactive elements focusable.

### Target sizing

- WCAG 2.2 AA floor: 24 x 24 CSS pixels with documented exceptions.
- PlotPickle normal-control target: at least 44 x 44 CSS pixels.
- Adjacent independent targets should normally have at least 8px separation.
- Any normal control below the PlotPickle target requires a documented reason in the PR.

## 14. Forms, editing and input mechanics

PlotPickle's complex story structures require consistent editing rules.

### Inline editing

Use inline editing when:

- editing one low-risk field or short value;
- surrounding context helps the decision;
- the change is easy to undo;
- opening another surface would interrupt a rapid editing flow.

### Drawer or inspector

Use a drawer/inspector when:

- several related fields belong to the selected story object;
- the user benefits from seeing the source object while editing;
- settings are contextual but should not dominate the main work surface.

### Modal dialog

Use a modal when:

- the user must complete or cancel a short blocking decision before continuing;
- creating a compact object requires a focused set of fields;
- confirmation is required for an irreversible/high-impact action.

Do not use a modal for routine multi-step editing, long forms, browsing, reading or tasks that need comparison with the underlying work surface.

### Validation mechanics

- Put labels above or beside fields; never rely on placeholder text as the label.
- Group related fields.
- Validate near the field.
- Do not show ordinary validation errors on every keystroke while the user is still entering a valid value.
- Validate on blur, submit, or another meaningful completion boundary.
- Once an error is visible, clear or update it as soon as the value becomes valid.
- Preserve entered values after recoverable errors.
- Explain constraints before submission where possible.
- Use sensible defaults.
- Do not ask for values PlotPickle already knows.
- Provider/model/credential configuration belongs in Settings unless a creative task genuinely requires an in-context choice.
- Advanced technical controls are collapsed by default.

### Native input attributes

Use the browser's native input semantics rather than treating every field as generic text.

- Choose the correct `type` such as `email`, `tel`, `url`, `number`, `date` or `search` where the data model genuinely matches it.
- Use `inputmode` such as `numeric`, `decimal`, `tel`, `email` or `url` when it improves the input keyboard without changing validation semantics.
- Declare meaningful `autocomplete` values where browser autofill is appropriate.
- Set `autocapitalize`, `autocorrect` and spelling behavior deliberately for names, prose, identifiers, code, URLs and technical values.
- Do not disable helpful browser behavior globally because one technical field needs different behavior.
- Input restrictions must not block valid international names, punctuation or localized text without a real data requirement.

### Unsaved draft preservation

Normal creative work must survive accidental interruption.

- Long forms, scene text, notes and other meaningful unsaved creative input use an approved local draft or working-copy persistence mechanism.
- Draft persistence is debounced and must not create a write on every keystroke.
- Restore interrupted drafts after an accidental refresh, renderer restart or authentication timeout where applicable.
- Clearly distinguish restored draft content from the last committed/saved project state.
- Clear obsolete draft state after a confirmed save or explicit discard.
- Never persist credentials, secrets or sensitive authentication material in ordinary browser/local-storage draft mechanisms.
- Where a field is intentionally transient and not persisted, the UX must make that boundary understandable.

## 15. Data density, extreme content and localization

Real user content is not constrained to design-mockup lengths.

### Table vs list vs card

Use a table/data grid when users need to compare several consistent attributes across multiple objects, sort/filter by columns, scan statuses or perform bulk operations.

Use a list when objects share a simple repeated structure and the user primarily scans title, status and one or two metadata values.

Use cards when objects are heterogeneous, media-rich, visually identifiable or require a compact summary rather than column comparison.

Working threshold:

- if the user must compare three or more consistent fields across roughly six or more items, start from a table/list model rather than a card wall;
- if visual/media identity is primary, cards may remain appropriate at higher counts, but search/filter/grouping becomes mandatory as density rises;
- never solve density by shrinking type or controls below usable sizes.

### Bulk actions

- Bulk actions appear only after one or more items are selected.
- Selection count remains visible.
- Bulk destructive actions state the number/type of affected objects.
- Provide `Select all`, `Clear selection` and escape paths where scale justifies them.
- Do not leave destructive bulk controls permanently prominent when nothing is selected.

### Text overflow and long strings

- Layouts must remain intact with long story, project, scene, character, agent and file names.
- Test representative strings of at least 200 characters where user-entered names or labels can be unconstrained.
- Use wrapping for content whose full meaning is important and space permits it.
- Use `text-overflow: ellipsis` only where preserving row/column geometry is more important than showing the full string.
- Truncated content must be available through an accessible tooltip, title/detail surface, expansion or other discoverable full-text path.
- Never allow long unbroken strings, URLs or identifiers to overlap adjacent controls.
- Use appropriate `overflow-wrap`, `word-break` and min-width constraints rather than fixed clipping hacks.
- Do not assume English word length or left-to-right string shape in component sizing.

### Readability and fluid width

- Long-form reading surfaces should target roughly 60-75 characters per line and should not exceed roughly 80 characters per line without a clear editorial reason.
- Use shared readable-width tokens and maximum container widths rather than allowing prose to stretch across ultra-wide monitors.
- Boards, timelines and media workspaces may be wider, but explanatory prose inside them still uses a readable measure.

## 16. Agent and AI interaction surfaces

Agents support the creative task rather than dominate every screen.

- The current creative object remains visually primary.
- Agent presence is persistent only where persistence helps the workflow.
- Agent suggestions are visually distinct from committed project data.
- Users can tell what an agent changed, generated or proposed.
- Long operations show progress/status.
- Long-running generation exposes cancellation when cancellation is technically safe and meaningful.
- Agent failures do not erase current work.
- Technical model/provider details stay behind progressive disclosure unless the user is configuring them.
- Reuse the same conversation primitives across agents unless a different interaction model is genuinely required.

## 17. Content and language

Copy is concise, plain and task-oriented.

Prefer:

- `Create scene`
- `Save project`
- `Try again`
- `Open Settings`
- `Generate storyboard`

Avoid vague action labels such as `Proceed`, `Execute`, `Process`, `Magic`, `Do it`, `Yes` or `No` when a concrete outcome can be named.

Lore and personality may enrich supporting copy, but action labels remain literal and predictable.

## 18. Responsive behavior and zoom

PlotPickle is desktop-first but must degrade safely at smaller widths and higher zoom levels.

- Do not compress complex multi-column workspaces until they become unusable.
- Collapse secondary inspectors before compressing the main work surface.
- Convert horizontal navigation to a familiar overflow/menu pattern when necessary.
- Keep primary actions reachable.
- Prevent accidental page-level horizontal scrolling.
- Support keyboard and pointer use as first-class inputs.
- Prefer fluid grids, `minmax()`, `clamp()` and shared max-width contracts over brittle per-screen pixel layouts.
- At 200% browser zoom, task-critical content, controls, dialogs and navigation must remain reachable without clipping.
- Reflow is preferred over forcing the user to pan both horizontally and vertically to complete a normal task.

Representative desktop acceptance sizes remain:

- 1440 x 900 — normal desktop;
- 1280 x 720 — constrained desktop;
- 1024 x 768 — narrow desktop/fallback layout.

## 19. Motion and cognitive ergonomics

Animation clarifies spatial orientation or state change. It does not decorate the work surface.

### Timing

- Use shared motion tokens.
- Normal micro-interactions should complete within approximately 150-300ms.
- Existing `--pp-motion-fast: 120ms` is acceptable for simple hover/focus/state feedback.
- Avoid decorative UI transitions longer than 400ms; they make the product feel sluggish and delay task completion.
- Avoid ultra-short motion that creates flicker rather than meaningful feedback.
- Long-running operations use progress/status UI rather than extending transition animation to represent work.

### Reduced motion

Every CSS and JavaScript motion path must respect `prefers-reduced-motion`.

When reduced motion is requested:

- remove slide, zoom, parallax, bounce and large spatial transforms;
- use an instant state change where possible;
- if a visual transition is still needed for comprehension, use a subtle opacity change of approximately 100ms or less;
- keep state and focus changes understandable without relying on motion;
- do not animate every hover;
- loading animation is never the only indication that work is occurring.

## 20. Asynchronous operations and network resiliency

The interface must remain truthful when local services, remote APIs or provider networks are slow, offline or unreliable.

### Optimistic vs pessimistic UI

Use optimistic UI only for actions that are fast, low-risk, reversible and easy to reconcile, such as a lightweight preference toggle, star/favourite or other local reversible state.

Optimistic flow:

1. update the visible state immediately;
2. send the request;
3. confirm silently or with lightweight feedback;
4. if the request fails, roll back the state and explain what happened with an appropriate notification.

Use pessimistic UI for consequential or expensive work, including:

- deleting or overwriting a project;
- destructive resets or migrations;
- exporting deliverables where duplicate output matters;
- committing significant generated content when the operation is not safely reversible;
- long AI generation, rendering or provider operations where the result is not yet known.

Pessimistic flow:

1. keep the requested outcome uncommitted;
2. put the triggering control into a visible pending state;
3. prevent duplicate submission;
4. show progress or status when the operation can take noticeable time;
5. commit the UI state only after confirmed success;
6. preserve the prior state and show recovery options on failure.

### Double-submit prevention

- A control that starts a non-idempotent async operation disables or enters a locked pending state immediately after activation.
- Keyboard activation and pointer activation share the same submission lock.
- Re-enable only after success, failure, cancellation or a defined timeout/recovery boundary.
- Do not rely on visual disabling alone; the event/request layer must also reject duplicate in-flight submissions.
- Repeated clicks must never create duplicate scenes, exports, payments, remote jobs or destructive requests.

### Retry and idempotency

- Recoverable network/provider errors expose a contextual `Retry` action in the error surface.
- Retry must re-run the failed operation without requiring a full-page reload where technically possible.
- Retry must preserve user input and project context.
- Create/update operations that may be retried should use stable request identifiers or an idempotency strategy when the backend/provider supports it.
- A retry must not silently duplicate a previously successful request whose response was lost.

### Slow, offline and stale conditions

- Show a distinct pending/checking state before presenting network-derived status as settled fact.
- Surface offline or unreachable-provider state in plain language.
- Distinguish cached/stale data from confirmed live data when the difference affects a decision.
- Use reasonable request timeouts and a recoverable timeout message rather than an infinite loading state.
- Preserve local creative work if a remote provider fails.
- If an operation can safely continue in the background, show where its status can be found after navigation.

## 21. Notification and feedback architecture

Notifications have distinct jobs and must not compete with the creative surface.

### Toasts

Use for transient, non-critical confirmation or lightweight rollback feedback.

Examples: saved, copied, preference changed, reversible optimistic action failed.

Rules:

- normally auto-dismiss after approximately 4-5 seconds;
- do not use auto-dismiss for information the user must act on or remember;
- pausing/reading behavior must remain accessible to keyboard and assistive-technology users;
- use concise language and no more than one optional action;
- maximum three visible stacked toasts at once;
- additional toasts queue, collapse or replace an equivalent duplicate rather than covering the viewport;
- repeated identical events should coalesce rather than spam the user.

### Alert banners

Use for non-transient warnings or status tied to the current view, project or connection.

Examples: provider unavailable, unsaved restored draft, stale connection status, project needs attention.

Rules:

- remain visible until resolved, dismissed when appropriate, or the user leaves the relevant context;
- sit near the content they affect;
- include an actionable recovery or destination when one exists;
- do not duplicate the same problem as both a permanent banner and repeated toasts.

### Modals / alert dialogs

Use only for blocking decisions that genuinely require acknowledgement before the user can continue.

Examples: destructive deletion, overwrite, destructive reset, flow-critical conflict resolution.

Rules:

- never use a modal merely to announce success;
- never use a modal for routine warnings that can remain inline;
- manage focus correctly on open/close;
- default focus goes to the safe action when a destructive choice is present;
- labels describe the consequence with explicit verbs.

## 22. UI debt rules

A redesign must reduce complexity rather than restyle it.

Do not:

- add another local colour palette;
- add another button hierarchy;
- create one-off cards for each screen;
- create screen-specific navigation conventions;
- duplicate project state in presentation code;
- expose technical settings on normal creative screens;
- solve overcrowding by making everything smaller;
- hide critical actions behind unlabeled icons;
- add decorative borders around every block;
- create a second toast/notification framework for one screen;
- implement per-screen draft persistence that conflicts with the canonical project/working-copy model;
- retain an old interaction solely because a test currently encodes it.

Tests should protect good behavior. When an existing test protects presentation that conflicts with this standard, update that test deliberately in the same approved implementation issue rather than working around it in CSS.

## 23. AI implementation contract

Any AI or coding agent modifying PlotPickle UI must load or be given this standard.

Required agent instruction:

> Design for the user's current task first. Use PlotPickle's shared design tokens and existing components. Apply Fitts's Law, Hick's Law, Miller's Law, Jakob's Law and progressive disclosure. Keep one primary action per decision context. Use familiar application patterns. Design ideal, empty, loading, partial and error states. Meet WCAG 2.2 AA and use 44 x 44 CSS pixel hit targets for normal controls. Preserve project context and existing data/workflow architecture. Design for slow networks, retries, duplicate-submit prevention, interrupted drafts, extreme content, localization, reduced motion and 200% browser zoom. Do not invent a new palette, spacing system, navigation model, notification system or component when an existing PlotPickle or established pattern can solve the problem. Make all state changes visible and errors actionable. Complexity belongs behind progressive disclosure, not on the initial screen.

Before returning UI code, implementation notes must identify:

- screen purpose;
- primary user action;
- information hierarchy;
- reused components;
- token usage;
- five-state handling;
- keyboard/focus behavior;
- responsive and 200% zoom behavior;
- form/editing and validation pattern where relevant;
- draft-preservation behavior where relevant;
- data-density/overflow behavior where relevant;
- optimistic or pessimistic async boundary where relevant;
- duplicate-submit/retry behavior where relevant;
- notification pattern where relevant;
- reduced-motion behavior;
- any reason a new component or token was unavoidable.

An AI agent must not invent local HEX/HSL values, arbitrary spacing, new font stacks or new interaction patterns simply to make a screen look different.

## 24. Automated UI/UX PR gate

This standard becomes enforceable through static audit, rendered continuity checks, browser acceptance and reviewer attestation.

The repository already provides:

- `scripts/ui-ux-code-audit.mjs`;
- `lib/verification/ui-continuity-audit.mjs`;
- Playwright-based local acceptance/UAT infrastructure.

### Existing 25 code-audit criteria

The current UI/UX code audit checks:

1. Design System & Token Adherence
2. Fluid Typography Scale
3. Layout Mechanics & Grid Integrity
4. Color Contrast & Theme Readiness
5. Micro-Visual Polish
6. Interactive State Matrix
7. Touch Target Standard
8. Line-Length & Readability
9. Motion & Reduced Motion Support
10. Form UX & Inline Feedback
11. Semantic HTML Architecture
12. Heading Hierarchy Integrity
13. Asset Alt Text Strategy
14. Keyboard Navigation & Tab Order
15. ARIA Minimization & Validity
16. Asset Loading Optimization
17. Critical CSS & Render Blocking
18. Font Loading Strategy
19. DOM Depth & Node Count
20. Icon & Graphic Delivery
21. Container Overflow & Edge Defense
22. Viewport & Safe-Area Bounds
23. SEO & Social Graph Metadata
24. Empty & Error States
25. Dead Code & Scope Hygiene

### Mandatory blocking conditions for changed UI

A UI-changing PR fails review when any applicable condition is true:

- a new product colour literal is introduced where a shared semantic token exists;
- arbitrary one-off spacing, radius, shadow or font systems are introduced;
- more than one primary action is visually dominant in one decision context;
- an ordinary view exposes more than seven top-level interactive choices without progressive disclosure;
- normal controls fall below the 44 x 44 PlotPickle target without a documented exception;
- normal text contrast is below 4.5:1 or large text contrast is below 3:1 without a valid WCAG exception;
- an interactive icon has no accessible name;
- a form input lacks a programmatic label;
- an input has inappropriate generic semantics when a relevant native type/inputmode/autocomplete contract applies;
- validation aggressively interrupts ordinary typing instead of using an appropriate completion boundary;
- meaningful unsaved creative input can be lost on a routine recoverable interruption without an intentional documented exception;
- an ARIA reference points to a missing ID;
- keyboard users cannot reach, operate or escape a normal workflow;
- visible focus is missing, obscured or trapped;
- an irreversible/high-impact destructive action lacks explicit confirmation;
- a data-driven surface omits an applicable ideal, empty, loading, partial or error state;
- loading, saving, generation or error state can fail silently;
- an async action permits accidental duplicate non-idempotent submissions;
- a recoverable network/provider failure has no contextual recovery path;
- long or localized user content overlaps or destroys the layout;
- task-critical UI clips or becomes unreachable at 200% browser zoom;
- page-level horizontal overflow appears at supported desktop widths except for an intentional horizontal workspace such as a board/timeline;
- reduced-motion preference is ignored by a CSS or JavaScript motion path;
- transient notifications can grow without a queue/collapse limit;
- a new component duplicates an existing shared component without documented justification;
- an audit/test is bypassed, suppressed or weakened merely to make the PR green.

### Rendered acceptance expectations

For substantial shell, navigation, workspace or component changes, Playwright/UAT should verify at minimum:

- normal pointer journey;
- keyboard-only journey for the primary workflow;
- accessible name/role snapshot for interactive controls;
- focus visibility and logical order;
- empty/loading/partial/error rendering where applicable;
- destructive confirmation behavior where applicable;
- project context preserved across navigation;
- duplicate-submit prevention for non-idempotent async actions where applicable;
- retry behavior for a simulated recoverable failure where applicable;
- restored draft behavior for meaningful unsaved creative input where applicable;
- long-string/overflow behavior;
- no navigation overlap or accidental page-level horizontal overflow;
- representative desktop and narrow-desktop behavior;
- 200% browser zoom behavior;
- `prefers-reduced-motion` behavior;
- notification queue/collapse behavior where multiple notifications can occur.

### Visual regression baseline rules

- Shared shell, grouped navigation and reusable component primitives should gain approved screenshot baselines when the reset is implemented.
- Baselines protect hierarchy, clipping, overlap, missing controls and major layout regression.
- Baselines should include representative long-content cases for components vulnerable to overflow.
- Baselines should not fail solely on incidental antialiasing or dynamic content pixels.
- Intentional baseline changes require explicit review in the same PR.
- Never update snapshots only to make a failing PR green without confirming the new state against this standard.

### Gate rollout

Until every deterministic rule is automated, the PR template checklist is a mandatory review contract. Phase 1 should convert as many deterministic checks as practical into CI gates.

## 25. UI/UX & Continuity Compliance Checklist

> **Note for authors and reviewers:** All PRs modifying visual components, views or user workflows must pass every applicable check below before merging. This checklist is also included in `.github/PULL_REQUEST_TEMPLATE.md` so it appears during normal PR authoring.

- [ ] **1. Single Primary Action:** Every action-bearing view/screen contains exactly one primary CTA. Read-only status views may contain zero. Secondary and tertiary actions use lower-emphasis variants.
- [ ] **2. Nav & Destination Grouping:** No ordinary view exposes more than seven top-level interactive choices simultaneously; additional choices use progressive disclosure.
- [ ] **3. Interactive Target Sizing:** Normal clickable/tappable controls maintain a minimum 44 x 44 CSS px hit target using `--pp-touch-target`, with at least 8px spacing between adjacent independent targets unless a documented exception applies.
- [ ] **4. Hardcoded Style Prohibition:** No new hardcoded product colour, one-off spacing, independent radius/shadow system or arbitrary styling token is introduced when a shared `--pp-*` token exists.
- [ ] **5. Five-State Coverage:** Every altered/new data-driven surface handles all applicable ideal, empty, loading, partial and error states.
- [ ] **6. Color Contrast & WCAG 2.2 AA:** Text/background and applicable non-text contrast meet WCAG 2.2 AA; colour is never the sole carrier of meaning.
- [ ] **7. Keyboard & Focus Management:** The normal workflow is keyboard-operable with visible, unobscured, logical focus behavior.
- [ ] **8. Screen Reader & ARIA Contract:** Controls have valid accessible names; native semantics are preferred; ARIA references and status regions are correct.
- [ ] **9. Destructive Action Safeguards:** High-impact destructive operations use explicit confirmation and safe default focus behavior.
- [ ] **10. Audit & Test Gate Pass:** Existing UI/UX audit, continuity, accessibility, Playwright/UAT and applicable visual-regression checks pass without bypassing rules.
- [ ] **11. Form & Draft Resilience:** Relevant fields use correct native input attributes and non-disruptive validation; meaningful unsaved creative work survives routine recoverable interruption.
- [ ] **12. Async & Retry Safety:** Non-idempotent actions prevent double submission; optimistic UI is limited to safe reversible actions; recoverable errors provide contextual retry without losing input.
- [ ] **13. Extreme Content & Zoom:** Long/localized strings do not break layout; prose remains readable; task-critical UI remains usable at 200% browser zoom.
- [ ] **14. Motion & Reduced Motion:** Motion remains within the timing contract and every CSS/JS motion path respects `prefers-reduced-motion`.
- [ ] **15. Notification Discipline:** Toasts, banners and modals are used for their defined roles; no more than three toasts are visible at once and duplicate notifications coalesce/queue.

## 26. Review criteria

A screen is not complete until all applicable answers are yes.

### Purpose and hierarchy

- Is the purpose obvious within five seconds?
- Is there one dominant task?
- Is there no more than one visible primary action in the decision context?
- Are secondary actions visually secondary and limited/grouped?
- Are advanced controls hidden until needed?
- Are destructive actions separated and confirmed when required?

### Navigation and context

- Can the user tell where they are?
- Is active project/context clear?
- Can the user move back or onward without guessing?
- Are there seven or fewer top-level interactive choices?

### Components and tokens

- Does the screen reuse shared components?
- Does it use shared PlotPickle tokens?
- Are there no unjustified local product colours or spacing rules?
- Are controls familiar and self-explanatory?
- Are cards used only for real content boundaries?

### Data, forms and interruption

- Is inline editing used only for low-risk contextual edits?
- Are dialogs reserved for short blocking decisions/confirmations?
- Is a table/list used when comparison density calls for it?
- Do bulk actions appear only after selection?
- Does validation avoid interrupting ordinary typing?
- Are native input type/inputmode/autocomplete attributes correct?
- Is meaningful unsaved work recoverable after a routine interruption?
- Are long/localized strings safe?

### States and network

- Ideal state designed?
- Empty state designed?
- Loading state designed?
- Partial state designed?
- Error state designed?
- Optimistic/pessimistic boundary appropriate?
- Duplicate submission prevented?
- Recoverable failures have Retry?
- Slow/offline/stale status is truthful?

### Accessibility and motion

- Keyboard complete?
- Focus visible and unobscured?
- Contrast verified?
- Accessible names/labels present?
- ARIA references valid and minimal?
- Colour not the only carrier of meaning?
- Normal controls at least 44 x 44 or exception documented?
- Functional at 200% zoom?
- Reduced motion preserved?

### Feedback and notifications

- Does every important action produce immediate feedback?
- Is save state visible?
- Are long AI operations understandable?
- Are errors plain-language and recoverable where possible?
- Are toasts limited/queued?
- Are persistent warnings banners rather than transient toasts?
- Are blocking modals reserved for genuinely blocking decisions?

## 27. Relationship to existing PlotPickle verification

This standard extends rather than discards existing UI quality work.

`scripts/ui-ux-code-audit.mjs` already checks the 25 implementation criteria listed above. `lib/verification/ui-continuity-audit.mjs` protects shared-shell, theme, project context, status and route continuity. PlotPickle also uses Playwright-based acceptance infrastructure.

The implementation phase must align those automated contracts with this document, especially where an older exact-layout assumption conflicts with progressive disclosure or simplified navigation.

Do not bypass tests. Preserve the intended user behavior and update only obsolete presentation-specific assertions through an approved issue/PR.

## 28. Implementation phases

### Phase 0 — Standard and inventory

- Approve this document.
- Inventory global components, navigation patterns and major screen layouts.
- Identify duplicate patterns and tests that encode obsolete presentation decisions.
- Inventory async operations, draft-loss risks, notifications and overflow-sensitive components.

### Phase 1 — Foundations and enforcement

- Confirm token source of truth.
- Confirm typography roles.
- Confirm action hierarchy and component variants.
- Confirm shared component primitives.
- Confirm grouped shell/navigation model.
- Confirm canonical toast/banner/dialog architecture.
- Confirm canonical draft-persistence boundary.
- Add deterministic lint/audit checks for token use, target sizing, action hierarchy and accessibility where practical.
- Add deterministic tests for duplicate-submit prevention, reduced-motion and notification limits where practical.
- Establish baseline visual-regression coverage for the shared shell and primitives.

### Phase 2 — Shell and navigation

- Simplify visible navigation without breaking route identity.
- Preserve current project context.
- Establish consistent workspace headers and primary-action placement.
- Update continuity tests to protect grouped navigation behavior rather than fourteen equal-weight presentation slots.

### Phase 3 — Core workflow screens

Refactor in user-flow order:

Learn -> Plan -> Build -> Storyboard/Previs -> Write -> Edit -> Feedback -> Refine -> Reports.

Each screen must satisfy the five states, action hierarchy, accessibility contract, operational-resilience rules and compliance checklist before moving on.

### Phase 4 — Community, Wyrmwood and specialized surfaces

Apply the same component hierarchy and interaction rules while allowing appropriate visual personality.

### Phase 5 — UAT and consolidation

- Run end-to-end keyboard and pointer UAT.
- Run accessibility and contrast audit.
- Run UI code audit and continuity audit.
- Test slow/error/retry conditions for material async workflows.
- Test draft restoration for material creative input.
- Test long content and 200% zoom.
- Test reduced motion.
- Test notification queuing/collapse.
- Run applicable visual regression checks.
- Remove superseded CSS and components.
- Confirm the reset reduced component and interaction duplication rather than adding another layer.

## 29. Known risk and solution

Risk: PlotPickle's existing verification suite may reject an intentionally simpler interface because some tests currently encode historical presentation rules, particularly navigation order and visual contracts.

Solution: Treat verification as part of the UI refactor. Before changing a protected interaction, identify the user behavior the test was intended to preserve, retain that behavior, and update only the presentation-specific assertion that is now obsolete. Never bypass or weaken a test merely to make a redesign pass.

A second operational risk is introducing local one-off recovery mechanisms while fixing individual screens.

Solution: Draft persistence, notifications, retries and async state should be implemented as shared infrastructure or shared patterns. Do not solve reliability screen-by-screen if the behavior belongs to the application platform.

## 30. Reference hierarchy

When guidance conflicts, use this order:

1. User safety, data integrity and accessibility.
2. PlotPickle task and workflow requirements.
3. This human-centered UI/UX standard.
4. Existing PlotPickle shared components and tokens.
5. Platform conventions and established usability research.
6. Visual preference and decorative brand expression.

Reference resources:

- Material Design 3: https://m3.material.io/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Apple Accessibility guidance: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Nielsen Norman Group: https://www.nngroup.com/articles/
- Nielsen Norman Group progressive disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG 2.2 new success criteria: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- shadcn/ui components: https://ui.shadcn.com/docs/components
- Tailwind application UI patterns: https://tailwindcss.com/plus/ui-blocks/application-ui

## 31. Definition of success

The UI reset is successful when PlotPickle still has deep capability but no longer feels deep at every moment.

A new user should be able to enter the application, understand the current project, identify the next action and begin meaningful story work without learning PlotPickle's entire architecture first.

An expert user should still be able to reach advanced tools quickly, but those tools should appear because the user requested them or because the current task requires them.

The system should remain understandable when a provider is slow, a request fails, a title is unexpectedly long, the browser is zoomed to 200%, motion is reduced, several notifications arrive together, or the user returns after an interrupted edit.

The interface should reveal PlotPickle's power progressively rather than display its complexity all at once.
