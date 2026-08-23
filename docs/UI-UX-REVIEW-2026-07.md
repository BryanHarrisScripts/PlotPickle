# PlotPickle UI/UX Review

Date: July 2026
Scope: Instructions, Read & Learn, Story Planner, Screenplay, Visual Board, Engines, Settings, primary navigation, project status strip, and the new two-card introductions.

## Review principles

1. One project should always feel like one product, even when the work changes from learning to planning, writing, visualization, or refinement.
2. The current workspace, project title, save state, and progress should remain easy to locate.
3. Introductions should explain a workspace without permanently consuming most of the screen.
4. Primary actions should be visually stronger than secondary and destructive actions.
5. Dense professional tools should remain usable on laptops and narrow windows, not only on large desktop displays.
6. Existing content and project data should not be changed by a visual cleanup.

## Primary navigation and project context

Observed issues:

- Seven primary tabs plus project actions exceeded the comfortable width of many laptop screens.
- Fixed tab widths encouraged clipping instead of graceful horizontal navigation.
- The project strip disappeared while scrolling even though the story context remained important.
- Small-screen layouts had no clear strategy for preserving the main workspaces and project actions.

Implemented cleanup:

- Reduced tab width and spacing while preserving the label and explanatory subtitle at wider sizes.
- Added horizontal tab scrolling when the available width is limited.
- Hid tab subtitles only at narrower breakpoints instead of removing the workspace labels.
- Made the project strip sticky below the primary navigation.
- Simplified the brand and secondary project actions progressively on smaller screens.
- Added consistent focus, placeholder, touch-target, and reduced-motion behaviour.

## Two-card workspace introductions

Observed issues:

- The new introductions successfully explained Screenplay, Visual Board, and Settings, but their large permanent footprint slowed repeat users.
- Their scale was larger than the controls and content that followed.
- There was no way to retain the guidance for new users while giving experienced users faster access.

Implemented cleanup:

- Reduced padding, headline scale, shadow strength, and card spacing.
- Added a persistent Hide overview / Show overview control for each workspace.
- Stored the collapsed state separately for Screenplay, Visual Board, and Settings on the current device.
- Added a compact collapsed summary instead of removing the explanation entirely.

## Instructions

Observed issues:

- The section hero was visually strong but oversized relative to the questions and deliverables below it.
- Guidance cards used excess minimum height, creating empty space.
- The left story rail became difficult to use on narrower screens.

Implemented cleanup:

- Reduced hero size and visual ornamentation while preserving its instructional identity.
- Tightened guidance-card spacing and removed unnecessary fixed height.
- Converted the story rail into a horizontal section navigator on narrower screens.
- Preserved all section questions, deliverables, and Afterglow examples.

## Read & Learn

Observed issues:

- The learning header, current story position, progress, anatomy, tabs, filters, and modules competed for attention.
- The tab treatment was visually weaker than the content it controlled.
- Module cards did not provide strong hover or equal-height feedback.
- The module reader could be difficult to re-enter after scrolling.

Implemented cleanup:

- Grouped the course introduction and licence guidance into balanced cards.
- Made Complete Learning Library and Guidance for this Block a clearer segmented control.
- Kept the view control visible while scrolling on larger screens.
- Improved selector and search-field height and focus states.
- Equalized module-card height, strengthened hover feedback, and retained recommendation badges.
- Improved module-reader spacing, scroll offset, and responsive side-reference layout.

## Story Planner

Observed issues:

- The planner forms were functional but visually denser than the overview dashboard.
- Section headings and forms used inconsistent spacing.
- Form controls and help text lacked a consistent interaction treatment.
- The story rail consumed too much width on medium screens.

Implemented cleanup:

- Standardized editor width, section-heading spacing, form-card radius, and field gaps.
- Added consistent control height, hover, focus, and resizable text areas.
- Reduced unused vertical space in section headings and cards.
- Converted the story rail to a horizontal navigator at medium widths.
- Preserved the Project Overview dashboard as the native Story Planner introduction.

## Screenplay

Observed issues:

- The stylesheet covered only the upper navigation portion of the Writer, leaving many screenplay, assistant, and responsive classes without a complete visual definition.
- The three-column layout had no reliable laptop or mobile fallback.
- Block navigation, page editing, metadata controls, and the optional assistant competed for space.
- Treatment / Screenplay mode switching disappeared during long writing sessions.

Implemented cleanup:

- Completed styling for the screenplay page, editable elements, screenplay grammar, format controls, assistant panel, AI approval area, and selected-element assignment.
- Made the Treatment / Screenplay switch sticky below the project strip.
- Added a two-column laptop layout and one-column narrow-screen layout.
- Converted the Block rail to a horizontal navigator on narrow screens.
- Moved the assistant below the draft when three columns no longer fit.
- Preserved Fountain, Final Draft, Print/PDF, keyboard, and block-position behaviour.

## Visual Board

Observed issues:

- The 24-block grid, 96-mini-block grid, filters, and inspector had limited responsive behaviour.
- The inspector could crowd the visual grid on laptop screens.
- Several inspector controls and statuses lacked complete styling.
- Long titles and prompts did not have consistent overflow behaviour.

Implemented cleanup:

- Completed styling for all board cards, mini-block cards, prompt controls, progress states, inspector fields, generated-image messages, and accessibility fields.
- Made the board toolbar sticky on larger screens.
- Reduced the block grid from three to two columns when space becomes limited.
- Moved the inspector below the board when a two-column workspace no longer fits.
- Added one-column mobile layouts and horizontal Act filtering.
- Preserved the story-derived prompt, optional AI generation, and local asset flow.

## Engines

Observed issues:

- The Engines page already had the strongest native introduction, but its hero and cards were slightly larger than the rest of the updated product.
- Card hover feedback was weaker than newer workspaces.

Implemented cleanup:

- Reduced hero and card padding without changing the six-engine content.
- Standardized headline scale and card radius.
- Added clearer hover elevation and border feedback.
- Preserved the recommended order, shared-project explanation, and expected results.

## Settings

Observed issues:

- Settings had a clear information architecture, but several component classes lacked a complete visual definition.
- Reports, terminology, AI, music, and plugin sections needed one consistent layout.
- The Settings menu was not optimized for laptop and mobile widths.
- Connection, warning, destructive, and neutral actions were too visually similar.

Implemented cleanup:

- Completed the Settings stylesheet for all menus, provider cards, fields, connection states, artist links, plugins, notices, and status messages.
- Made the Settings menu sticky on desktop and horizontally scrollable on smaller screens.
- Separated primary, secondary, connection, and remove actions visually.
- Added responsive provider, form, music-link, and plugin grids.
- Preserved local key handling and no-AI use.

## Non-goals

This pass does not change:

- PlotPickle project data or schema.
- The 24 Blocks method.
- Screenplay content, formatting rules, or exports.
- Storyboard prompts, images, or AI provider behaviour.
- Learning-module content or completion records.
- Licensing or ownership language.

## Validation targets

- Desktop: 1440 pixels and wider.
- Laptop: approximately 1024–1366 pixels.
- Tablet/narrow window: approximately 700–1024 pixels.
- Mobile reference: below 700 pixels.
- Keyboard focus remains visible.
- Reduced-motion preference is respected.
- Existing quality, build, smoke, and project tests remain green.
