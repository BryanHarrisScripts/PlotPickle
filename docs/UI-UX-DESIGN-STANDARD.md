# PlotPickle Human-Centered UI/UX Design Standard

Status: Proposed foundation  
Issue: #1713  
Scope: Product UI, desktop application shell, workspaces, forms, agent surfaces, boards, dashboards, dialogs and future AI-generated interface work.

## 1. Why this document exists

PlotPickle has grown into a deep creative system. The interface must make that depth feel understandable rather than expose all of it at once.

The goal of this standard is not to make PlotPickle visually fashionable. The goal is to make the application obvious, calm, predictable, efficient and difficult to misuse while preserving the underlying story architecture, agents, workflows and provider flexibility.

This document becomes the default decision framework for UI/UX work. When an older screen pattern conflicts with this standard, the older pattern must be reviewed rather than copied automatically.

## 2. Product design doctrine

Every PlotPickle screen should answer these questions quickly:

1. Where am I?
2. What am I working on?
3. What is the most important thing I can do here?
4. What happened after I acted?
5. What should I do next?

If a screen cannot answer those questions without explanation, the screen is not finished.

### Core rules

- One screen, one primary purpose.
- One visually dominant primary action whenever an action is required.
- Do not display complexity merely because the system supports it.
- Preserve the user's project and task context across navigation.
- Prefer familiar interaction patterns over novel controls.
- Make state visible. Never make the user guess whether something saved, loaded, failed or is still running.
- Put advanced, destructive and rarely used controls behind progressive disclosure.
- Reuse components and interaction patterns before inventing new ones.
- Brand styling must never reduce readability, accessibility or discoverability.
- AI-generated UI must follow the same rules as human-authored UI.

## 3. Cognitive foundations

### Fitts's Law

Important and frequent actions must be easy to acquire with a pointer, touch input or keyboard.

PlotPickle rule:

- Primary controls should use generous targets.
- Do not place tiny icon-only actions beside high-frequency controls.
- Destructive actions must not sit immediately beside the primary action without clear separation.
- PlotPickle's preferred interactive target remains at least 44 x 44 CSS pixels where practical, matching the existing `--pp-touch-target: 2.75rem` token.

WCAG 2.2 Success Criterion 2.5.8 defines a 24 x 24 CSS pixel minimum target size at AA, with exceptions. PlotPickle intentionally adopts a more generous preferred target for primary and frequently used controls.

### Hick's Law

Decision time rises as the number and complexity of choices rise.

PlotPickle rule:

- Do not present the entire capability map as equal-weight choices.
- Keep primary decision groups small.
- Aim for approximately 3-7 meaningful choices in a visible decision area.
- Secondary actions belong in menus, inspectors, drawers, disclosure panels or contextual toolbars.
- A screen with many equally prominent buttons is a design failure even if every button is technically useful.

### Miller's Law

People process information more effectively when it is chunked into manageable groups.

PlotPickle rule:

- Group related information into meaningful sections.
- Prefer 5-9 items per visible conceptual block as a working guideline, not a hard scientific limit.
- Long curricula, scene lists, agent lists and story structures must use hierarchy, grouping, search, filtering or collapsible sections rather than one uninterrupted list.

### Jakob's Law

Users bring expectations from software they already know.

PlotPickle rule:

- Buttons should look and behave like buttons.
- Tabs should behave like tabs.
- Sidebars, inspectors, dialogs, breadcrumbs, search, menus and forms should follow familiar desktop/web patterns.
- Do not invent a magical or lore-specific interaction where a standard control communicates the function better.
- PlotPickle's personality should live in language, illustration, texture and selective visual detail rather than in unfamiliar interaction mechanics.

## 4. Progressive disclosure

PlotPickle is powerful enough that progressive disclosure is mandatory.

Show the user what is needed for the current task first. Reveal specialized configuration only when requested or contextually required.

### Disclosure levels

Level 1: Current task

- task title;
- essential context;
- content being worked on;
- one primary action;
- the few secondary actions needed to finish the task.

Level 2: Task tools

- contextual editing tools;
- filters;
- alternative views;
- supporting metadata;
- normal secondary actions.

Level 3: Advanced controls

- provider selection;
- model tuning;
- technical diagnostics;
- raw metadata;
- experimental controls;
- rarely changed preferences.

Level 4: System administration

- credentials;
- destructive maintenance;
- developer diagnostics;
- migration or repair tools.

A first-time user should be able to complete normal story work without seeing Levels 3 or 4.

## 5. Information architecture and navigation

PlotPickle currently has a canonical set of destinations used by the continuity contract:

Dashboard, Community, Wyrmwood, Learn, Plan, Build, Storyboard, Previs, Write, Edit, Feedback, Refine, Reports and Settings.

These destinations may remain canonical routes and workflow identities. They should not automatically remain fourteen equal-weight visible navigation choices.

### Navigation standard

- Preserve route identity and deep-link compatibility.
- Group related destinations into a smaller set of recognizable top-level areas.
- Keep the user's active project visible while moving between workspaces.
- Use clear location indicators: selected navigation, page title and, where useful, breadcrumb/context path.
- Keep Settings as a utility destination, not a creative workflow step.
- Keep agent access available but subordinate to the user's current creative task unless the agent itself is the task.
- Avoid duplicated navigation controls that lead to the same place using different labels.
- Do not force users to remember where a feature lives when a contextual route can take them there directly.

### Important implementation consequence

The existing UI Continuity Agent currently validates an exact navigation order. Before a future navigation simplification is implemented, that audit contract must be deliberately updated so a better grouped presentation is not incorrectly treated as a regression.

The data model and workflow can remain stable while the presentation becomes simpler.

## 6. Screen anatomy

Every primary workspace should follow a predictable hierarchy.

### Required hierarchy

1. Global shell
   - product identity;
   - current project/context;
   - high-level navigation;
   - utility access.

2. Workspace header
   - clear screen title;
   - concise purpose or status;
   - one primary action when applicable.

3. Main work surface
   - the user's current content or task;
   - maximum useful space;
   - no decorative panel that competes with the work.

4. Contextual tools
   - inspector, supporting panel, filters or agent help only when relevant.

5. Feedback/status layer
   - save state;
   - generation state;
   - success/error messages;
   - background activity that affects the current task.

### Primary-action hierarchy

Primary action:

- one per decision context;
- highest visual emphasis;
- describes the outcome with a verb when possible;
- disabled only with a visible explanation when the reason is not obvious.

Secondary actions:

- visually quieter;
- support the same task;
- may appear beside or near the primary action.

Tertiary actions:

- low emphasis;
- use text buttons, menus or contextual actions;
- should not compete with task completion.

Destructive actions:

- never use the normal primary-action treatment;
- use plain language describing what will be destroyed;
- require confirmation when consequences are difficult to reverse.

## 7. Design tokens and visual system

PlotPickle already has a centralized token system in `app/design-tokens.css`. New UI must consume shared semantic tokens rather than define independent palettes, spacing systems, radii or motion rules.

### Existing brand foundation

- matte canvas: `--pp-matte`;
- surfaces: `--pp-surface`, `--pp-surface-raised`, `--pp-surface-hover`;
- primary text: `--pp-text` and `--pp-paper`;
- muted text: `--pp-muted`, `--pp-dim`;
- brand/action accents: teal and orange tokens;
- semantic status: success, warning and danger tokens;
- spacing: four-pixel base scale;
- interaction target: `--pp-touch-target`;
- reduced-motion support through shared motion tokens.

### 60 / 30 / 10 allocation guideline

Use this as a compositional guideline rather than literal screen arithmetic:

- approximately 60% neutral canvas/background;
- approximately 30% secondary surfaces and structural separation;
- approximately 10% accent, state and action emphasis.

Accent colour must communicate importance. If teal or orange appears everywhere, it stops functioning as emphasis.

### Colour meaning

- Teal: PlotPickle identity, selection, constructive emphasis and approved interactive emphasis.
- Orange: focus, important action or attention where defined by the component contract.
- Green: truthful success only.
- Warning orange/yellow family: truthful caution only.
- Red: destructive, unavailable or failed state only.
- Never communicate state through colour alone.

### Typography

The current token system maps display, body and code roles to a mono/typewriter family. That supports the PlotPickle visual identity but should not be treated as untouchable where readability suffers.

Future implementation should separate typography by purpose:

- brand/display typography may retain the PlotPickle mono/typewriter character;
- code, technical data and structured identifiers should remain monospaced;
- long-form reading, lessons, help text and dense instructions should prioritize readability and may require a dedicated body face.

Readability outranks visual lore.

### Spacing

- Use the existing four-pixel base scale.
- Prefer 8px multiples for normal component spacing.
- Use whitespace to create hierarchy before adding borders.
- Do not solve hierarchy by placing every section in a separate card.
- Related controls must be visually closer to each other than to unrelated controls.

## 8. Component architecture

PlotPickle should use a small, composable component vocabulary.

Preferred reference systems:

- Material Design 3 for system thinking, layout and accessibility;
- Apple Human Interface Guidelines for clarity, platform familiarity and input behavior;
- Nielsen Norman Group for usability research and interaction principles;
- shadcn/ui for composable application components and explicit component structure;
- Tailwind UI/Tailwind Plus for proven application-shell, form, list and responsive-layout patterns.

These are references, not themes to copy. PlotPickle keeps its own visual language.

### Core component families

- App shell
- Workspace header
- Button
- Icon button
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
- Empty state
- Skeleton
- Error state
- Progress/status indicator
- Table/data grid where data is genuinely tabular
- Agent conversation primitives

### AI component rule

Before an AI agent creates a new component it must ask, in order:

1. Does an existing PlotPickle component already solve this?
2. Can an existing component be composed to solve it?
3. Is there an established shadcn/Material/Apple/Tailwind pattern for it?
4. Only then: is a new PlotPickle-specific component justified?

New components require a clear interaction reason, not merely a different visual appearance.

## 9. The five mandatory UI states

Every data-driven component or screen must be deliberately designed for these states.

### 1. Ideal state

The normal, populated experience.

Requirements:

- clear hierarchy;
- expected controls;
- obvious current state;
- obvious next action.

### 2. Empty state

The user has no content yet.

Requirements:

- explain what belongs here;
- explain why it matters in one short sentence;
- provide one useful first action;
- avoid dead empty panels and generic illustrations without guidance.

### 3. Loading state

Data or generated content is not ready yet.

Requirements:

- use skeletons for content whose shape is known;
- preserve layout to reduce movement;
- show meaningful progress text for long AI operations;
- never present a blank panel as if the app is frozen;
- use spinners only when a skeleton or progress state does not communicate better.

### 4. Partial state

Only some expected content exists.

Requirements:

- treat existing content as valid;
- make the missing next step obvious;
- do not visually punish an incomplete story/project;
- do not fill empty space with fake placeholder content that could be mistaken for saved work.

### 5. Error state

Something failed.

Requirements:

- say what failed in plain language;
- preserve the user's work whenever possible;
- say whether the failure affects saved data;
- provide the most useful recovery action;
- expose technical details behind a disclosure control when needed;
- do not make a raw error code the primary message.

## 10. Affordance and feedback

Every interactive control must visibly communicate that it can be interacted with.

### Affordance rules

- Clickable elements must have recognizable interactive styling.
- Do not make plain paragraph text clickable without link treatment.
- Icon-only controls require an accessible name and should normally provide a tooltip.
- Disabled controls must look disabled and remain understandable.
- Drag handles must look draggable.
- Resizable panels must expose a visible or discoverable resize affordance.

### Feedback rules

After a user action, immediately show one of:

- changed state;
- progress/loading state;
- success state;
- actionable error state.

Saving, generating, exporting, switching projects and invoking agents must never fail silently.

## 11. Accessibility baseline

Target: WCAG 2.2 AA as the minimum product baseline, with stricter PlotPickle defaults where practical.

### Required

- Normal text contrast of at least 4.5:1 unless a valid WCAG exception applies.
- Large text contrast of at least 3:1.
- Visible keyboard focus.
- Focus must not be obscured by sticky UI.
- All normal workflows operable by keyboard.
- Semantic HTML before ARIA.
- Accessible names for icon-only controls.
- Labels and instructions associated with form inputs.
- Errors identified in text, not colour alone.
- Reduced-motion preference respected.
- High-contrast/forced-colour behavior must preserve meaning.
- Zoom and text enlargement must not destroy the workflow.
- Status messages must be announced appropriately without wrapping entire interactive regions in live regions.

### Target sizing

WCAG 2.2 AA target-size minimum: 24 x 24 CSS pixels with documented exceptions.

PlotPickle preferred target: at least 44 x 44 CSS pixels for primary navigation, common actions and touch-relevant controls.

This distinction is intentional: 24px is the conformance floor; 44px is the product usability target.

## 12. Forms and configuration

Forms should reveal only the information needed to make a decision.

- Put labels above or beside fields; never rely on placeholder text as the label.
- Group related fields.
- Validate near the field.
- Preserve entered values after recoverable errors.
- Explain constraints before submission when possible.
- Use sensible defaults.
- Do not ask the user for values PlotPickle can already know.
- Provider/model/credential configuration belongs in Settings unless a creative task genuinely requires an in-context choice.
- Advanced technical controls should be collapsed by default.

## 13. Agent and AI interaction surfaces

Agents should support the creative task rather than dominate every screen.

### Agent UX rules

- The current creative object remains visually primary.
- Agent presence is persistent only where persistence helps the workflow.
- Agent suggestions must distinguish suggestion from committed project data.
- The user must know what an agent changed, generated or proposed.
- Long operations must show progress/status.
- Agent failures must not erase the user's current work.
- Technical model/provider details stay behind progressive disclosure unless the user is configuring them.
- The same conversation component should be reused across agents unless a different interaction model is genuinely required.

## 14. Content and language

PlotPickle copy should be concise, plain and task-oriented.

Prefer:

- "Create scene"
- "Save project"
- "Try again"
- "Open Settings"
- "Generate storyboard"

Avoid vague labels such as:

- "Proceed"
- "Execute"
- "Process"
- "Magic"
- "Do it"

Lore and personality can enrich supporting copy, but action labels must remain literal and predictable.

## 15. Responsive and desktop behavior

PlotPickle is a desktop-first creative application, but screens must degrade safely at smaller widths.

- Do not shrink complex multi-column workspaces until they become unusable.
- Collapse secondary inspectors before compressing the main work surface.
- Convert horizontal navigation to a familiar overflow/menu pattern when necessary.
- Keep primary actions reachable.
- Prevent accidental horizontal page scrolling.
- Support keyboard and pointer use as first-class inputs.

## 16. Motion

Motion exists to explain state change, not decorate the interface.

- Keep transitions short and consistent using shared tokens.
- Do not animate every hover.
- Avoid large parallax, pulsing surfaces or persistent movement in work areas.
- Respect `prefers-reduced-motion`.
- Loading animation must never be the only indication that work is occurring.

## 17. PlotPickle UI debt rules

A redesign must reduce complexity, not merely restyle it.

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
- retain an old interaction solely because a test currently encodes it.

Tests and audit contracts should protect good product behavior. When an existing test protects an interaction that conflicts with this standard, update the contract deliberately as part of the approved implementation issue rather than working around it in CSS.

## 18. AI implementation contract

Any AI or coding agent asked to design or modify PlotPickle UI should receive this instruction set:

> Design for the user's current task first. Use PlotPickle's shared design tokens and existing components. Apply Fitts's Law, Hick's Law, Miller's Law, Jakob's Law and progressive disclosure. Keep one primary action per decision context. Use familiar application patterns. Design ideal, empty, loading, partial and error states. Meet WCAG 2.2 AA and prefer 44 x 44 CSS pixel targets for common controls. Preserve project context and existing data/workflow architecture. Do not invent a new palette, navigation model or component when an existing PlotPickle or established component pattern can solve the problem. Make all state changes visible and errors actionable. Complexity belongs behind progressive disclosure, not on the initial screen.

Before returning UI code, the agent should state internally or in its implementation notes:

- screen purpose;
- primary user action;
- information hierarchy;
- reused components;
- five-state handling;
- keyboard/focus behavior;
- responsive behavior;
- any reason a new component was unavoidable.

## 19. Review checklist

A screen should not be considered complete until all applicable answers are yes.

### Purpose and hierarchy

- Is the screen's purpose obvious within five seconds?
- Is there one dominant task?
- Is the primary action unambiguous?
- Are secondary actions visually secondary?
- Can advanced controls be hidden until needed?

### Navigation and context

- Can the user tell where they are?
- Is the active project/context clear?
- Can the user move back or onward without guessing?
- Are there fewer visible decisions than the raw feature set would imply?

### Components

- Does the screen reuse shared components?
- Does it use shared tokens?
- Are controls familiar and self-explanatory?
- Are cards used only for real content boundaries?

### States

- Ideal state designed?
- Empty state designed?
- Loading state designed?
- Partial state designed?
- Error state designed?

### Accessibility

- Keyboard complete?
- Focus visible and unobscured?
- Contrast verified?
- Accessible names/labels present?
- Colour not the only carrier of meaning?
- Common targets approximately 44 x 44 where practical?
- Reduced motion preserved?

### Feedback

- Does every important action produce immediate feedback?
- Is save state visible?
- Are long AI operations understandable?
- Are errors written in plain language with recovery actions?

## 20. Relationship to existing PlotPickle verification

This standard extends rather than discards the existing UI quality work.

The current `scripts/ui-ux-code-audit.mjs` already checks 25 useful implementation criteria, including token adherence, layout, contrast, interaction states, touch targets, readability, motion, forms, semantic HTML, keyboard behavior, ARIA, performance, viewport safety, empty/error states and code hygiene.

The current `lib/verification/ui-continuity-audit.mjs` protects shared-shell, theme, project context, status and route continuity.

The next implementation phase should align those automated contracts with this document, especially where an older exact-layout assumption conflicts with progressive disclosure or simplified navigation.

## 21. Implementation phases

### Phase 0 — Standard and inventory

- Approve this document.
- Inventory existing global components, navigation patterns and major screen layouts.
- Identify duplicate patterns and test contracts that encode obsolete presentation decisions.

### Phase 1 — Foundations

- Confirm design tokens.
- Confirm typography roles.
- Confirm button/action hierarchy.
- Confirm shared component primitives.
- Confirm shell and grouped navigation model.
- Align automated UI audits.

### Phase 2 — Shell and navigation

- Simplify visible navigation without breaking route identity.
- Preserve current project context.
- Establish consistent workspace headers and primary-action placement.

### Phase 3 — Core workflow screens

Refactor in user-flow order rather than by whichever file is easiest:

Learn -> Plan -> Build -> Storyboard/Previs -> Write -> Edit -> Feedback -> Refine -> Reports.

Each screen must satisfy the five mandatory states and review checklist before moving on.

### Phase 4 — Community, Wyrmwood and specialized surfaces

Apply the same component hierarchy and interaction rules while allowing appropriate visual personality.

### Phase 5 — UAT and consolidation

- Run end-to-end keyboard and pointer UAT.
- Run accessibility audit.
- Run UI continuity audit.
- Remove superseded CSS and components.
- Confirm that redesign reduced component and interaction duplication rather than adding another layer.

## 22. One known risk and its solution

Risk: PlotPickle's existing verification suite may reject an intentionally simpler interface because some tests currently encode exact historical presentation rules, particularly navigation order and visual contracts.

Solution: Treat the verification layer as part of the UI refactor. Before changing a protected interaction, identify the user behavior the test was intended to preserve, retain that behavior, and update only the presentation-specific assertion that is now obsolete. Never bypass or weaken a test merely to make a redesign pass.

## 23. Reference hierarchy

When guidance conflicts, use this order:

1. User safety, data integrity and accessibility.
2. PlotPickle's task and workflow requirements.
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

## 24. Definition of success

The UI redesign is successful when PlotPickle still has deep capability but no longer feels deep at every moment.

A new user should be able to enter the application, understand the current project, identify the next action and begin meaningful story work without learning PlotPickle's entire architecture first.

An expert user should still be able to reach advanced tools quickly, but those tools should appear because the user requested them or because the current task requires them.

The interface should reveal PlotPickle's power progressively rather than display its complexity all at once.
