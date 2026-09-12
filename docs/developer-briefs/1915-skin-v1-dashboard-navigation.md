# Developer Brief — #1915 Skin V1 Dashboard Navigation

## Purpose

This build combines two tightly related Skin V1 navigation repairs:

1. restore the wired green status indicators that the later Cloud/Local Story Mode consolidation accidentally removed from the #1874/#1875 menu contract; and
2. simplify the Human-facing Dashboard hierarchy so Profile means the Human profile, while runtime/system destinations live under Options & Settings.

The work is intentionally bounded to navigation, session exit, and one Writer's Craft submenu. It does not redesign the underlying story, provider, Agent, PPF, Node lifecycle, or curriculum systems.

## Locked Human-facing hierarchy

Dashboard shell title becomes `PLOTPICKLE DASHBOARD`. The menu-section title becomes `*** PLOTPICKLE BBS ***` beneath the dragon / PlotPickle brand block.

Top Dashboard entries include Community, Story Library, and `Log Off`. Log Off ends only the current Human browser session. It must use the existing profile session boundary, persist/flush private profile work, clear browser-private profile authority, return to the existing LOGON chooser, and leave the PlotPickle Node/runtime running.

`User Profile` opens the actual User Profile directly. The intermediate PROFILE directory is no longer a live navigation surface.

`Local Story Mode` and `Node Info` move into `Options & Settings`. Cloud Story Mode and PlotPickle Agents remain Settings destinations. Local Story Mode breadcrumbs must say `SETTINGS / LOCAL STORY MODE`.

## Writer's Craft scope

`[1] Writer's Craft — Learn Storytelling Essentials` opens exactly one new Skin V1 keyboard-directory submenu. It reuses the existing Learning Studio collection names and order:

1. Screenwriting Foundations
2. Visual Writing & PlotPickle
3. The 24 Blocks Method
4. AI-Assisted Revision
5. Characters in Motion
6. Dialogue in Motion
7. Story Craft Essentials
8. Working Together
9. Collaboration, Formats & Ownership

This build deliberately stops there. Selecting a collection may update explanatory status text, but it must not open lessons/modules yet. Those rows therefore remain truthful preview/unwired rows rather than pretending the next level is implemented.

## Story Mode indicator repair

Cloud Story Mode and Local Story Mode retain the shared Skin V1 keyboard-directory contract:

- every visible row exposes `data-skin-menu-row`, one-letter `data-skin-menu-shortcut`, and `data-skin-menu-connected`;
- every wired row contains a right-side `pp-skin-v1-dashboard-status-box is-active` descendant;
- the descendant exposes `data-skin-menu-indicator="connected"` at runtime;
- the active square resolves to `--pp-skin-accent-bright`;
- the live WebMCP audit remains the behavioral authority for indicator state/color.

The historical static #1793 assertion that rejects a literal hard-coded JSX attribute is preserved by using a JSX expression, while #1915 adds the positive regression that requires the connected indicator to exist. The live WebMCP audit is updated to the new navigation path.

## WebMCP navigation contract

The audit must prove:

- Dashboard menu conformance;
- Community remains reachable;
- Settings remains reachable;
- Cloud Story Mode opens from Settings and its menu passes indicator/navigation checks;
- Local Story Mode opens from Settings and its menu passes indicator/navigation checks;
- Node Info opens from Settings;
- User Profile opens directly from Dashboard;
- Writer's Craft opens exactly the first collection submenu and keyboard selection works there.

## Non-goals

- no Node stop/restart/shutdown behavior from Log Off;
- no new authentication/session implementation;
- no curriculum lesson/module expansion beyond the first Writer's Craft submenu;
- no provider, Agent, PPF, canon, Story, or Score authority changes;
- no new Skin V1 visual language.

## Acceptance evidence

Focused test: `tests/issue-1915-skin-v1-dashboard-navigation.test.mjs`.

Required gate evidence before merge:

- focused #1915 regression passes;
- current Experience/Skin V1 regression group passes;
- WebMCP menu-contract UAT reports no findings for the changed paths;
- production build passes;
- PR Gate and Product Gate are green on the same exact PR head.
